import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GoalScheduler, openJournal } = require('../main/goals');
const { GoalAdmission } = require('../main/goal-admission');
const A = randomUUID(), B = randomUUID();
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, adapter) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goals-'));
  let now = 1000;
  const calls = [];
  const controlled = { execute(request, hooks) { return new Promise(resolve => calls.push({ request, hooks, resolve })); } };
  const journal = openJournal(root);
  const scheduler = new GoalScheduler({ journal, adapter: adapter || controlled, now: () => now });
  t.after(async () => { const closing = scheduler.close(); calls.forEach(c => c.resolve({ status: 'cancelled' })); await closing; });
  const create = (options = {}) => scheduler.create({ profileId: A, chatId: 'main', objective: 'Prove bounded work', deadline: 10000,
    tasks: [1, 2, 3].map(i => ({ id: `t${i}`, chatId: `worker${i}`, prompt: `Bounded task ${i}`, context: { provider: 'codex', folder: '/captured', model: 'test-model', effort: 'high' } })), ...options });
  return { scheduler, journal, root, calls, create, setNow(value) { now = value; } };
}

test('missing authentication persists assistance without retrying or marking work complete', async t => {
  let dispatched=0;
  const f=fixture(t,{async execute(){dispatched++;throw Object.assign(Error('Sign in to Codex to continue.'),{code:'BARKDOWN_SEND_NOT_STARTED',authProvider:'codex'});}});
  const g=f.create();f.scheduler.start(A,g.id);await flush();await flush();
  assert.equal(dispatched,3);
  assert.ok(f.scheduler.get(A,g.id).tasks.every(task=>task.status==='failed'&&task.attempts.at(-1).result.authProvider==='codex'));
  f.scheduler.tick();await flush();assert.equal(dispatched,3);
});

test('three reserved workers run concurrently, snapshots cannot mutate owners, results require review', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); f.scheduler.tick(); await flush();
  assert.equal(f.calls.length, 3);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'goals.json'))).goals[0].tasks.filter(t => t.status === 'running').length, 3);
  f.calls[0].request.context.folder = '/tampered';
  assert.equal(f.scheduler.get(A, g.id).tasks[0].context.folder, '/captured');
  for (const c of f.calls) c.resolve({ status: 'succeeded', text: c.request.taskId });
  await flush(); assert.ok(f.scheduler.get(A, g.id).tasks.every(t => t.status === 'review'));
  assert.throws(() => f.scheduler.complete(A, g.id, { note: 'done', evidence: ['test'] }), /Unfinished/);
  for (const task of g.tasks) f.scheduler.reviewTask(A, g.id, task.id, { accepted: true, note: 'Observed output verified', evidence: ['test-output'] });
  assert.equal(f.scheduler.get(A, g.id).status, 'review');
  assert.equal(f.scheduler.complete(A, g.id, { note: 'All acceptance checked', evidence: ['integration output'] }).status, 'completed');
});

test('dependencies wait for evidence, cap is global, same chat is serialized across goals', async t => {
  const f = fixture(t);
  const first = f.create({ tasks: [
    { id: 'a', chatId: 'worker', prompt: 'first', context: { provider: 'api' } },
    { id: 'b', chatId: 'worker', prompt: 'second', dependsOn: ['a'], context: { provider: 'api' } },
  ] });
  const second = f.create({ tasks: [{ id: 'c', chatId: 'worker', prompt: 'third', context: { provider: 'api' } }] });
  f.scheduler.start(A, first.id); f.scheduler.start(A, second.id); await flush(); assert.equal(f.calls.length, 1);
  f.calls[0].resolve({ status: 'succeeded', text: 'first' }); await flush();
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].request.goalId, second.id);
  f.scheduler.reviewTask(A, first.id, 'a', { accepted: true, note: 'verified', evidence: ['result'] });
  await flush(); assert.equal(f.calls.length, 2);
  f.calls[1].resolve({ status: 'succeeded' }); await flush(); assert.equal(f.calls.length, 3);
  assert.equal(f.calls[2].request.taskId, 'b');
});

test('same IDs in different profiles retain independent progress and result ownership', async t => {
  const f = fixture(t); const id = randomUUID();
  const tasks = [{ id: 'same', chatId: 'same', prompt: 'independent', context: { provider: 'api' } }];
  f.create({ id, tasks }); f.create({ id, profileId: B, tasks });
  f.scheduler.start(A, id); f.scheduler.start(B, id); await flush();
  assert.equal(f.calls.length, 2);
  f.calls[0].hooks.progress({ text: 'A progress', profileId: B, taskId: 'spoof' });
  f.calls[0].resolve({ status: 'succeeded', text: 'A only', profileId: B }); await flush();
  assert.equal(f.scheduler.get(A, id).tasks[0].attempts[0].result.text, 'A only');
  assert.equal(f.scheduler.get(B, id).tasks[0].status, 'running');
  assert.throws(() => f.scheduler.get(randomUUID(), id), /Unknown owned/);
});

test('pause stops new work, waits for actual termination, and does not silently replay', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  f.scheduler.stop(A, g.id, 'paused');
  assert.ok(f.calls.every(c => c.hooks.signal.aborted));
  assert.throws(() => f.scheduler.start(A, g.id), /Reconcile/);
  assert.throws(() => f.scheduler.reviewTask(A, g.id, 't1', { accepted: false, retry: true, note: 'retry', evidence: ['observed'] }), /not stopped/);
  f.calls.forEach(c => c.resolve({ status: 'succeeded', text: 'late external effect' })); await flush();
  assert.ok(f.scheduler.get(A, g.id).tasks.every(t => t.status === 'interrupted'));
  for (const task of g.tasks) f.scheduler.reviewTask(A, g.id, task.id, { accepted: false, retry: true, note: 'External effects reconciled; safe retry', evidence: ['authoritative read'] });
  f.scheduler.start(A, g.id); await flush(); assert.equal(f.calls.length, 6);
});

test('deadline handles sleep/wake and prevents late success or new dispatch', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  f.setNow(11000); f.calls[0].resolve({ status: 'succeeded' }); await flush();
  assert.equal(f.scheduler.get(A, g.id).status, 'expired');
  assert.ok(f.calls.slice(1).every(c => c.hooks.signal.aborted));
  assert.ok(f.scheduler.get(A, g.id).tasks.every(t => t.status === 'interrupted'));
  assert.throws(() => f.scheduler.start(A, g.id), /cannot start/);
});

test('cancel before adapter microtask prevents provider launch', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); f.scheduler.stop(A, g.id, 'cancelled'); await flush();
  assert.equal(f.calls.length, 0); assert.equal(f.scheduler.get(A, g.id).status, 'cancelled');
});

test('reopen interrupts reserved attempts and requires explicit reconciliation', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  // Simulate abrupt death by copying only acknowledged on-disk journal to a fresh isolated process root.
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goals-restart-'));
  fs.copyFileSync(path.join(f.root, 'goals.json'), path.join(recoveredRoot, 'goals.json'));
  const calls = [];
  const recovered = new GoalScheduler({ journal: openJournal(recoveredRoot), adapter: { execute(r) { calls.push(r); } }, now: () => 2000 });
  t.after(() => recovered.close()); recovered.tick();
  assert.equal(recovered.get(A, g.id).status, 'paused'); assert.equal(calls.length, 0);
  assert.ok(recovered.get(A, g.id).tasks.every(t => t.status === 'interrupted'));
  assert.throws(() => recovered.start(A, g.id), /Reconcile/);
});

test('cycles, recursive coordinator workers, unknown dependencies and fourth worker are rejected', t => {
  const f = fixture(t); const one = { id: 'a', chatId: 'worker', prompt: 'task', context: { provider: 'api' } };
  assert.throws(() => f.create({ tasks: [{ ...one, dependsOn: ['a'] }] }), /Cyclic/);
  assert.throws(() => f.create({ tasks: [{ ...one, dependsOn: ['missing'] }] }), /Unknown dependency/);
  assert.throws(() => f.create({ tasks: [{ ...one, chatId: 'main' }] }), /own worker/);
  assert.throws(() => f.create({ tasks: [1,2,3,4].map(i => ({ ...one, id: `${i}`, chatId: `worker${i}` })) }), /at most three/);
  assert.throws(() => f.create({ profileId: '../unsafe' }), /profile ID/);
  assert.throws(() => openJournal(f.root), /already open/);
});

test('offline and failed runs cannot satisfy dependencies', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  f.calls[0].resolve({ status: 'succeeded', offline: true, text: 'navigation only' });
  f.calls[1].resolve({ status: 'failed', text: 'provider failure' }); await flush();
  assert.equal(f.scheduler.get(A, g.id).tasks[0].status, 'failed');
  assert.throws(() => f.scheduler.reviewTask(A, g.id, 't1', { accepted: true, note: 'pretend done', evidence: ['offline reply'] }), /cannot be accepted/);
});

test('corrupt journal fails closed without replacing original data', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goals-corrupt-'));
  const file = path.join(root, 'goals.json'); fs.writeFileSync(file, '{truncated');
  assert.throws(() => openJournal(root), /JSON|position|property/i);
  assert.equal(fs.readFileSync(file, 'utf8'), '{truncated');
});

test('lost persistence acknowledgement halts all dispatch and leaves reserved work recoverable', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  const write = f.journal.write;
  f.journal.write = () => { throw new Error('disk unavailable'); };
  f.calls[0].resolve({ status: 'succeeded', text: 'external change happened' }); await flush();
  assert.match(f.scheduler.fault.message, /disk unavailable/);
  assert.ok(f.calls.every(c => c.hooks.signal.aborted));
  assert.throws(() => f.scheduler.tick(), /halted/);
  assert.equal(f.scheduler.get(A, g.id).tasks[0].status, 'running');
  f.journal.write = write;
});

test('failed reservation never launches the provider', async t => {
  const f = fixture(t); const g = f.create(); const write = f.journal.write; let writes = 0;
  f.journal.write = data => { if (++writes === 2) throw new Error('reservation failed'); return write(data); };
  assert.throws(() => f.scheduler.start(A, g.id), /reservation failed/); await flush();
  assert.equal(f.calls.length, 0); assert.equal(f.scheduler.get(A, g.id).tasks[0].status, 'pending');
  f.journal.write = write;
});

test('reentrant observers cannot overlap a chat or dispatch past stop', async t => {
  const f = fixture(t); const g = f.create(); let stopped = false;
  f.scheduler.onChange = changed => {
    f.scheduler.tick();
    if (!stopped && changed.tasks.some(t => t.status === 'running')) { stopped = true; f.scheduler.stop(A, g.id, 'paused'); }
  };
  f.scheduler.start(A, g.id); await flush();
  assert.equal(f.calls.length, 0); assert.equal(f.scheduler.live.size, 0);
  assert.equal(f.scheduler.get(A, g.id).status, 'paused');
});

test('close retains the journal lease until actual adapter termination', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  const closing = f.scheduler.close();
  assert.throws(() => openJournal(f.root), /already open/);
  f.calls.forEach(c => c.resolve({ status: 'cancelled' })); await closing;
  const journal = openJournal(f.root); journal.close();
});

test('post-deadline reconciliation preserves terminal goal without permitting retry', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  f.setNow(20000); f.scheduler.tick(); f.calls.forEach(c => c.resolve({ status: 'succeeded' })); await flush();
  f.scheduler.reviewTask(A, g.id, 't1', { accepted: true, note: 'Observed actual persisted output after deadline', evidence: ['authoritative read'] });
  assert.equal(f.scheduler.get(A, g.id).status, 'expired'); assert.equal(f.scheduler.get(A, g.id).tasks[0].status, 'completed');
  assert.throws(() => f.scheduler.reviewTask(A, g.id, 't2', { accepted: false, retry: true, note: 'retry', evidence: ['inspection'] }), /cannot retry/);
});

test('another process cannot acquire the journal while its owner lives', async t => {
  const f = fixture(t);
  const script = `const {openJournal}=require(process.argv[1]);try{openJournal(process.argv[2]);process.exit(3)}catch(e){process.stdout.write(e.message)}`;
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, require.resolve('../main/goals'), f.root], { windowsHide: true }); let text = '';
    child.stdout.on('data', c => text += c); child.on('error', reject); child.on('close', code => code === 0 ? resolve(text) : reject(new Error(`unexpected exit ${code}`)));
  });
  assert.match(output, /live process/);
});

test('dead journal owner is recovered with lease evidence retained', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goals-dead-'));
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', 'require(process.argv[1]).openJournal(process.argv[2]);process.exit(0)', require.resolve('../main/goals'), root], { windowsHide: true });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
  });
  const journal = openJournal(root); journal.close();
  assert.equal(fs.readdirSync(root).filter(f => f.startsWith('goals.lease-recovered-')).length, 1);
});

test('real three-process execution integrates independent outputs with the persistent scheduler', async t => {
  let active = 0, max = 0;
  const children = [];
  const adapter = { execute(request, { signal, progress }) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', 'setTimeout(() => process.stdout.write(process.argv[1]), 120)', request.taskId], { windowsHide: true });
      children.push(child); active++; max = Math.max(max, active); let output = '';
      child.stdout.on('data', chunk => { output += chunk; progress({ text: output }); });
      const cancel = () => child.kill(); signal.addEventListener('abort', cancel, { once: true });
      child.on('error', reject); child.on('close', code => { active--; signal.removeEventListener('abort', cancel); resolve({ status: code === 0 ? 'succeeded' : 'failed', text: output }); });
    });
  } };
  t.after(() => children.forEach(c => { if (c.exitCode === null) c.kill(); }));
  const f = fixture(t, adapter); const g = f.create(); f.scheduler.start(A, g.id);
  const until = Date.now() + 10000;
  while (f.scheduler.get(A, g.id).tasks.some(t => t.status === 'running') && Date.now() < until) await new Promise(r => setTimeout(r, 20));
  assert.equal(max, 3);
  assert.deepEqual(f.scheduler.get(A, g.id).tasks.map(t => t.attempts[0].result.text), ['t1', 't2', 't3']);
  assert.ok(f.scheduler.get(A, g.id).tasks.every(t => t.status === 'review'));
  // These are real child processes, deliberately not a claim of authenticated model integration.
});

test('uncertain termination is visibly interrupted and cannot be reviewed while slot remains live', async t => {
  const f = fixture(t); const g = f.create(); f.scheduler.start(A, g.id); await flush();
  f.calls[0].hooks.progress({ text: 'Termination not confirmed', terminationUnknown: true });
  assert.equal(f.scheduler.get(A, g.id).tasks[0].status, 'interrupted');
  assert.throws(() => f.scheduler.reviewTask(A, g.id, 't1', { accepted: false, retry: true, note: 'try again', evidence: ['guess'] }), /not stopped/);
  f.calls[0].resolve({ status: 'interrupted', text: 'Driver later reconciled; effects still require review' }); await flush();
  assert.equal(f.scheduler.get(A, g.id).tasks[0].status, 'interrupted');
});

test('assignment attachments are captured independently and survive restart', async t => {
  const f = fixture(t); const images = [{ id: 'image', path: '/owned/attachments/a.png', mime: 'image/png' }];
  const g = f.create({ tasks: [{ id: 'image-task', chatId: 'worker', prompt: 'Inspect image', images, context: { provider: 'api' } }] });
  images[0].path = '/changed'; f.scheduler.start(A, g.id); await flush();
  assert.equal(f.calls[0].request.images[0].path, '/owned/attachments/a.png');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'goals.json'))).goals[0].tasks[0].images[0].path, '/owned/attachments/a.png');
});

test('abrupt process death after an external effect never replays the reserved attempt', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goals-crash-'));
  const script = `const fs=require('fs'),path=require('path');const {GoalScheduler,openJournal}=require(process.argv[1]);
    const root=process.argv[2],profileId=process.argv[3];const scheduler=new GoalScheduler({journal:openJournal(root),adapter:{async execute(){fs.appendFileSync(path.join(root,'effect.log'),'one effect\\n');process.exit(42)}}});
    const goal=scheduler.create({profileId,chatId:'main',objective:'Crash test',deadline:Date.now()+60000,tasks:[{id:'t',chatId:'worker',prompt:'One effect',context:{provider:'api'}}]});scheduler.start(profileId,goal.id);`;
  const code = await new Promise((resolve,reject) => {
    const child = spawn(process.execPath, ['-e', script, require.resolve('../main/goals'), root, A], { windowsHide:true });
    child.on('error',reject); child.on('close',resolve);
  });
  assert.equal(code,42); assert.equal(fs.readFileSync(path.join(root,'effect.log'),'utf8'),'one effect\n');
  let replayed = 0;
  const recovered = new GoalScheduler({journal:openJournal(root),adapter:{execute(){replayed++;}}}); t.after(() => recovered.close());
  const goal = recovered.list(A)[0]; recovered.tick();
  assert.equal(goal.status,'paused'); assert.equal(goal.tasks[0].status,'interrupted');
  assert.throws(() => recovered.start(A,goal.id),/Reconcile/); assert.equal(replayed,0);
  assert.equal(fs.readFileSync(path.join(root,'effect.log'),'utf8'),'one effect\n');
});

test('shared admission caps profile-local schedulers at three and holds uncertain termination', async t => {
  const admission = new GoalAdmission(); const calls = []; const schedulers = [];
  for (const profileId of [A,B]) {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-goals-admission-'));
    const scheduler=new GoalScheduler({journal:openJournal(root),admission,adapter:{execute(request,hooks){return new Promise(resolve=>calls.push({request,hooks,resolve}));}}});
    const goal=scheduler.create({profileId,chatId:'main',objective:'Owned work',deadline:Date.now()+60000,tasks:[1,2,3].map(i=>({id:`t${i}`,chatId:`same-${i}`,prompt:'Bounded',context:{provider:'api'}}))});
    schedulers.push({scheduler,goal,root});scheduler.start(profileId,goal.id);
  }
  t.after(async()=>{const closing=schedulers.map(({scheduler})=>scheduler.close());calls.forEach(c=>c.resolve({status:'cancelled'}));await Promise.all(closing);});
  await flush();assert.equal(calls.length,3);assert.equal(admission.snapshot().length,3);
  assert.equal(JSON.parse(fs.readFileSync(path.join(schedulers[1].root,'goals.json'))).goals[0].tasks.filter(t=>t.status==='running').length,0);
  calls[0].hooks.progress({text:'Termination unknown',terminationUnknown:true});
  schedulers[0].scheduler.stop(A,schedulers[0].goal.id,'paused');await flush();assert.equal(calls.length,3);
  calls[0].resolve({status:'interrupted'});await flush();
  assert.equal(calls.length,4);assert.equal(calls[3].request.profileId,B);assert.equal(admission.snapshot().length,3);
  // Same chat IDs in B are distinct owners, but total admission remains app-wide.
  assert.ok(admission.snapshot().some(owner=>owner.profileId===B));
});

test('failed reservation and cancelled-before-launch release shared admission exactly once', async t => {
  const admission=new GoalAdmission();const root=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-goals-admission-fail-'));
  const journal=openJournal(root);let dispatched=0;
  const scheduler=new GoalScheduler({journal,admission,adapter:{execute(){dispatched++;return {status:'succeeded'};}}});
  t.after(()=>scheduler.close());const goal=scheduler.create({profileId:A,chatId:'main',objective:'Reservation failure',deadline:Date.now()+60000,tasks:[{id:'t',chatId:'worker',prompt:'work',context:{provider:'api'}}]});
  const write=journal.write;let writes=0;journal.write=data=>{if(++writes===2)throw Error('disk');return write(data);};
  assert.throws(()=>scheduler.start(A,goal.id),/disk/);assert.equal(admission.snapshot().length,0);assert.equal(dispatched,0);journal.write=write;
  const release=admission.acquire({profileId:B,chatId:'worker',attemptId:'test'});assert.equal(release(),true);assert.equal(release(),false);assert.equal(admission.snapshot().length,0);
});
