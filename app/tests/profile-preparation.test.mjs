import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createProfilePreparation } = require('../main/profile-preparation');
const { createPaperDraftStore } = require('../main/paper-draft-store');
const { controller, writerForStore } = require('../main/writer-admission');
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };

function restart(f, t, options = {}) {
  const profiles = createProfileService({ registry: f.registry });
  const goals = createGoalService({ registry: f.registry, profiles, heartbeatMs: 0 }); t.after(() => goals.close());
  return { profiles, service: f.service({ profiles, goals, ...options }) };
}

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-preparation-'));
  const registry = createProfileRegistry(root), a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
  const profiles = createProfileService({ registry, ...options.profiles });
  const goals = createGoalService({ registry, profiles, heartbeatMs: 0 }); t.after(() => goals.close());
  const store = createStore(registry.storeFor(a.id).storeDir, { create: false });
  const drafts = createPaperDraftStore({ store, profileId: a.id });
  const cap = drafts.open({ id: 'same-slug', paperOwner: 'a'.repeat(64) });
  const retained = drafts.retain(cap, { sessionId: crypto.randomUUID(), inputVersion: 3, baseRevision: 1,
    title: 'Unsaved title', snapshot: { mode: 'rich', blocks: [{ id: 'a', type: 'paragraph', text: 'Unsaved human text' }] } });
  let releaseCount = 0, valid = true, captures = 0;
  const frozen = { profileId: a.id, sessionId: crypto.randomUUID(), draftKeys: [retained.key],
    assertCurrent: async () => valid, release: async () => { releaseCount++; } };
  const adapters = { registry, profiles, goals, freezeForeground: async profileId => { captures++; assert.equal(profileId, a.id); return frozen; },
    drainForeground: async () => true, drainTerminals: async () => true };
  const service = overrides => createProfilePreparation({ ...adapters, ...overrides });
  return { root, a, b, registry, profiles, goals, store, drafts, retained, frozen, adapters, service,
    control: controller(store), captures: () => captures, releases: () => releaseCount, invalidate: () => { valid = false; } };
}

test('abort preserves drafts, retires both old generations and requires fresh host adapters', async t => {
  const f = fixture(t), prep = f.service(), old = writerForStore(f.store);
  const prepared = await prep.prepare(f.a.id), closed = writerForStore(f.store);
  const copy = f.drafts.read(f.retained.key), aborted = await prep.abort(f.a.id);
  assert.equal(aborted.phase, 'aborted'); assert.equal(aborted.id, prepared.id);
  assert.notEqual(aborted.writerReopened.generation, prepared.writerBefore.generation);
  assert.notEqual(aborted.writerReopened.generation, prepared.writerAfter.generation);
  assert.throws(() => old.run('test:old', () => {}), /earlier library generation/);
  assert.throws(() => closed.run('test:closed', () => {}), /earlier library generation/);
  assert.equal(f.profiles.launchAdmission.isClosed(f.a.id), true);
  assert.equal(f.profiles.launchAdmission.requiresRestart(f.a.id), true);
  assert.deepEqual(f.drafts.read(f.retained.key), copy); assert.equal(f.releases(), 0);
  await assert.rejects(prep.prepare(f.a.id), /Restart/);
  const fresh = restart(f, t);
  fresh.profiles.launchAdmission.assertOpen(f.a.id);
  assert.equal(writerForStore(f.store).run('test:new', () => 42), 42);
  const next = await fresh.service.prepare(f.a.id);
  assert.notEqual(next.id, prepared.id); assert.notEqual(next.closureId, prepared.closureId);
  assert.equal(JSON.parse(fs.readFileSync(f.store.filePath(`preparation-history/${aborted.id}.json`))).phase, 'aborted');
  assert.equal(JSON.parse(fs.readFileSync(f.store.filePath(`launch-admission-history/${aborted.closureId}.json`))).phase, 'launches-open');
  assert.deepEqual(f.drafts.read(f.retained.key), copy);
  assert.throws(() => f.control.reopen(next.writerAfter, { generation: prepared.writerBefore.generation }), /retired/);
});

for (const boundary of ['after-reopening', 'after-reopened-writer', 'after-aborted', 'after-reopened-launches']) {
  test(`abort interruption ${boundary} resumes exact authority without losing recovery records`, async t => {
    const f = fixture(t); let tripped = false;
    const service = f.service({ checkpoint(name) { if (name === boundary && !tripped) { tripped = true; throw Error('Interrupted abort'); } } });
    await service.prepare(f.a.id); const copy = f.drafts.read(f.retained.key);
    await assert.rejects(service.abort(f.a.id), /Interrupted abort/);
    const partial = service.inspect(f.a.id), planned = partial.writerReopened;
    const fresh = restart(f, t); const result = await fresh.service.abort(f.a.id);
    assert.equal(result.id, partial.id); assert.deepEqual(result.writerReopened, planned);
    assert.equal(f.control.inspect().phase, 'open'); assert.deepEqual(f.drafts.read(f.retained.key), copy);
    assert.equal(fresh.profiles.launchAdmission.requiresRestart(f.a.id), true);
    restart(f, t).profiles.launchAdmission.assertOpen(f.a.id);
  });
}

test('abort refuses unresolved writes without removing pending evidence', async t => {
  const f = fixture(t), prep = f.service();
  assert.throws(() => writerForStore(f.store).run('test:uncertain', () => { throw Error('unknown'); }));
  await assert.rejects(prep.prepare(f.a.id), /uncertain/);
  const bytes = fs.readFileSync(f.store.filePath('writer-state.json'));
  await assert.rejects(prep.abort(f.a.id), /uncertain/);
  assert.deepEqual(fs.readFileSync(f.store.filePath('writer-state.json')), bytes);
  assert.equal(f.profiles.launchAdmission.isClosed(f.a.id), true);
});

test('reopened launches require the retained abort receipt and cannot borrow B authority', async t => {
  const f = fixture(t), prep = f.service(); await prep.prepare(f.a.id); const result = await prep.abort(f.a.id);
  assert.throws(() => f.profiles.launchAdmission.reopen(f.b.id, { closureId: result.closureId, preparationId: result.id, writerReopened: result.writerReopened }), /exact reconciled/);
  const file = f.store.filePath('profile-preparation.json'); fs.renameSync(file, file + '.retained');
  assert.throws(() => restart(f, t).profiles.launchAdmission.assertOpen(f.a.id), /abort receipt/);
});

test('a second preparation interrupted after launch closure resumes without discarding the prior abort', async t => {
  const f = fixture(t), first = f.service(); await first.prepare(f.a.id); const old = await first.abort(f.a.id);
  const next = restart(f, t, { checkpoint(name, record) { if (name === 'after-launch-closure' && record.previousId) throw Error('Interrupted second preparation'); } });
  await assert.rejects(next.service.prepare(f.a.id), /Interrupted second/);
  const recovered = restart(f, t), result = await recovered.service.prepare(f.a.id);
  assert.notEqual(result.id, old.id); assert.notEqual(result.closureId, old.closureId);
  assert.equal(JSON.parse(fs.readFileSync(f.store.filePath(`preparation-history/${old.id}.json`))).phase, 'aborted');
  assert.deepEqual(f.drafts.read(f.retained.key).content.draft.title, 'Unsaved title');
});
test('preparation joins real profile/goal drains, verified draft records and writer closure without affecting B', async t => {
  const f = fixture(t), prep = f.service(), old = writerForStore(f.store);
  const other = createStore(f.registry.storeFor(f.b.id).storeDir, { create: false });
  const result = await prep.prepare(f.a.id);
  assert.equal(result.phase, 'prepared'); assert.deepEqual(result.draftKeys, [f.retained.key]);
  assert.equal(result.closureId, f.profiles.launchAdmission.read(f.a.id).id);
  assert.equal(f.control.assertQuiescent(result.writerAfter).quiescent, true);
  assert.throws(() => old.run('test:stale', () => assert.fail()), /earlier library generation/);
  assert.equal(writerForStore(other).run('test:other', () => 42), 42);
  assert.equal(f.profiles.launchAdmission.isClosed(f.b.id), false);
  assert.equal(f.releases(), 0, 'successful preparation keeps the foreground frozen');
  assert.deepEqual(await prep.prepare(f.a.id), result); assert.equal(f.captures(), 1);
  assert.deepEqual(f.drafts.read(f.retained.key).content.draft.title, 'Unsaved title');
});
test('concurrent callers share one capture and do not prepare before delayed foreground/terminal completion', async t => {
  const f = fixture(t), foreground = deferred(), terminal = deferred(), entered = deferred();
  const prep = f.service({ drainForeground: async () => { entered.resolve(); return foreground.promise; }, drainTerminals: () => terminal.promise });
  const first = prep.prepare(f.a.id), second = prep.prepare(f.a.id); assert.equal(first, second);
  await entered.promise; assert.equal(prep.inspect(f.a.id).phase, 'draining'); assert.equal(f.control.inspect().phase, 'open');
  foreground.resolve(true); await Promise.resolve(); assert.equal(f.control.inspect().phase, 'open');
  terminal.resolve(true); assert.equal((await first).phase, 'prepared'); assert.equal(f.captures(), 1);
});
test('a changed human buffer refuses before writer closure and retains the recovery version', async t => {
  const f = fixture(t), prep = f.service({ drainForeground: async () => { f.invalidate(); return true; } });
  await assert.rejects(prep.prepare(f.a.id), /not verified frozen/);
  assert.equal(f.control.inspect().phase, 'open'); assert.equal(f.releases(), 1);
  assert.equal(f.profiles.launchAdmission.isClosed(f.a.id), true);
  assert.equal(f.drafts.read(f.retained.key).key, f.retained.key);
  assert.equal(prep.inspect(f.a.id).phase, 'draining');
});
test('a refused drain still awaits every independent cleanup before releasing the foreground', async t => {
  const f = fixture(t), pending = deferred(), entered = deferred();
  const prep = f.service({ drainForeground: async () => { throw Error('IPC did not drain'); }, drainTerminals: async () => { entered.resolve(); return pending.promise; } });
  let finished = false;
  const result = assert.rejects(prep.prepare(f.a.id), /IPC did not drain/).then(() => { finished = true; });
  await entered.promise; await new Promise(r => setImmediate(r));
  assert.equal(finished, false); assert.equal(f.releases(), 0);
  pending.resolve(true); await result; assert.equal(f.releases(), 1); assert.equal(f.control.inspect().phase, 'open');
});
for (const kind of ['ordinary', 'goals']) test(`foreign ${kind} drain evidence is refused`, async t => {
  const f = fixture(t), override = kind === 'ordinary' ? { profiles: { ...f.profiles, drainOrdinary: async () => ({ profileId: f.b.id, scope: 'ordinary' }) } } :
    { goals: { drain: async () => ({ profileId: f.a.id, scope: 'goals', closureId: crypto.randomUUID() }) } };
  const prep = f.service(override);
  await assert.rejects(prep.prepare(f.a.id), /foreign preparation evidence/);
  assert.equal(f.control.inspect().phase, 'open');
});
test('unverified terminal completion cannot be replaced by an empty IPC queue', async t => {
  const f = fixture(t), prep = f.service({ drainTerminals: async () => false });
  await assert.rejects(prep.prepare(f.a.id), /terminal shutdown is unverified/);
  assert.equal(f.control.inspect().phase, 'open');
});
test('active writer after drain closes admission but cannot mint a prepared receipt until settled', async t => {
  const f = fixture(t), gate = deferred(), old = writerForStore(f.store);
  const write = old.run('test:delayed', () => gate.promise);
  const prep = f.service();
  await assert.rejects(prep.prepare(f.a.id), /Active or uncertain writers/);
  assert.equal(prep.inspect(f.a.id).phase, 'quiescing'); assert.equal(f.releases(), 0);
  assert.throws(() => old.run('test:late', () => {}), /earlier library generation/);
  gate.resolve(); await write;
  assert.equal((await prep.prepare(f.a.id)).phase, 'prepared');
});
test('failed writer remains uncertain across restart and cannot be inferred absent from shutdown', async t => {
  const f = fixture(t), old = writerForStore(f.store);
  assert.throws(() => old.run('test:uncertain', () => { throw Error('Lost acknowledgment'); }));
  const prep = f.service(); await assert.rejects(prep.prepare(f.a.id), /Active or uncertain writers/);
  const freshProfiles = createProfileService({ registry: f.registry }), freshGoals = createGoalService({ registry: f.registry, profiles: freshProfiles, heartbeatMs: 0 });
  t.after(() => freshGoals.close());
  const fresh = f.service({ profiles: freshProfiles, goals: freshGoals });
  await assert.rejects(fresh.prepare(f.a.id), /Active or uncertain writers/);
  assert.equal(fresh.inspect(f.a.id).phase, 'quiescing'); assert.equal(f.control.inspect().pending[0].status, 'uncertain');
});
for (const step of ['after-collecting', 'after-draining', 'after-quiescing', 'after-writer-closure', 'after-prepared']) {
  test(`interruption ${step} retains exact ownership and resumes with new service instances`, async t => {
    const f = fixture(t), prep = f.service({ checkpoint: name => { if (name === step) throw Error('Injected interruption'); } });
    await assert.rejects(prep.prepare(f.a.id), /Injected interruption/);
    const before = prep.inspect(f.a.id); assert.equal(f.profiles.launchAdmission.isClosed(f.a.id), true);
    await f.goals.close();
    const profiles = createProfileService({ registry: f.registry }), goals = createGoalService({ registry: f.registry, profiles, heartbeatMs: 0 });
    t.after(() => goals.close());
    let observed;
    const restarted = f.service({ profiles, goals, freezeForeground: async (_, context) => { observed = context; return { ...f.frozen, sessionId: crypto.randomUUID() }; } });
    const result = await restarted.prepare(f.a.id);
    assert.equal(result.phase, 'prepared'); assert.equal(result.id, before.id); assert.equal(result.closureId, before.closureId);
    assert.deepEqual(result.draftKeys, [f.retained.key]);
    assert.equal(observed.writerOpen, !['after-writer-closure', 'after-prepared'].includes(step));
    if (!observed.writerOpen) assert.deepEqual(result.writerAfter, before.writerAfter);
  });
}
test('changed retained draft and preparation record are never repaired or silently reset', async t => {
  const f = fixture(t), prep = f.service(); await prep.prepare(f.a.id);
  const file = f.store.filePath(`paper-drafts/${f.retained.key}.json`), original = fs.readFileSync(file);
  fs.writeFileSync(file, '{}'); await assert.rejects(prep.prepare(f.a.id), /projection|ownership|checksum/);
  fs.writeFileSync(file, original);
  const recordFile = f.store.filePath('profile-preparation.json');
  fs.writeFileSync(recordFile, '{broken'); assert.throws(() => prep.inspect(f.a.id), /unreadable/);
  await assert.rejects(prep.prepare(f.a.id), /unreadable/); assert.equal(fs.readFileSync(recordFile, 'utf8'), '{broken');
  assert.equal(f.releases(), 0, 'corrupt evidence must not thaw a pane whose writer is already closed');
});
test('foreign foreground freeze is never adopted or released on behalf of another profile', async t => {
  const f = fixture(t); let released = 0;
  const prep = f.service({ freezeForeground: async () => ({ ...f.frozen, profileId: f.b.id, release() { released++; } }) });
  await assert.rejects(prep.prepare(f.a.id), /another owner/);
  assert.equal(released, 0); assert.equal(f.control.inspect().phase, 'open');
});
test('foreign writer generation refuses even if a valid preparation record remains', async t => {
  const f = fixture(t), prep = f.service({ checkpoint: name => { if (name === 'after-draining') throw Error('Pause'); } });
  await assert.rejects(prep.prepare(f.a.id), /Pause/);
  f.control.quiesce(f.control.capture());
  await assert.rejects(f.service().prepare(f.a.id), /no longer owns the writer generation/);
});
test('independent coordinator cannot steal the in-flight profile lease', async t => {
  const f = fixture(t), gate = deferred(), entered = deferred();
  const first = f.service({ freezeForeground: async () => { entered.resolve(); await gate.promise; return f.frozen; } }).prepare(f.a.id);
  await entered.promise;
  await assert.rejects(f.service().prepare(f.a.id), /already has a preparation coordinator/);
  gate.resolve(); assert.equal((await first).phase, 'prepared');
});

test('native coordinator drains A ordinary and three goal trees while B continues, then verifies restart', { timeout: 30000 }, async t => {
  const trees = new Map(), readyA = deferred(), readyB = deferred(), started = [];
  const receive = event => {
    if (event.type !== 'text_delta') return;
    trees.set(event.profileId + '/' + event.chatId, JSON.parse(event.text));
    if (trees.size === 4) readyA.resolve(); if (trees.size === 5) readyB.resolve();
  };
  const agent = require('../main/goal-worker-agent').createOwnedWorkerAgent({ script: require.resolve('./fixtures/profile-drain-worker.cjs') });
  const f = fixture(t, { profiles: { agent, sendEvent: receive } });
  const goals = createGoalService({ registry: f.registry, profiles: f.profiles, agent, heartbeatMs: 0, sendProviderEvent: receive,
    verifyTermination: ({ request, runId }) => agent.verifyTermination({ request: { ...request, storeDir: f.registry.storeFor(request.profileId).storeDir }, runId }) });
  t.after(async () => { for (const run of started) { agent.cancel(run.runId); await agent.waitForRunFinish(run.runId).catch(() => {}); } await goals.close(); });
  const snapshot = { version: 1, chats: { main: { id: 'main', title: 'Main', provider: 'api', folder: null, messages: [], tabs: [] } }, order: ['main'], current: 'main' };
  const owner = f.profiles.view(); f.profiles.save(owner, snapshot);
  started.push(await f.profiles.start(owner, { chatId: 'main', prompt: 'Run A' }));
  const goalOwner = { ...owner, chatId: 'main' };
  const goal = goals.create(goalOwner, { objective: 'Drain three real goal workers', durationMinutes: 60,
    assignments: [1, 2, 3].map(i => ({ title: 'Worker ' + i, prompt: 'Keep working ' + i })) });
  await goals.command(goalOwner, goal.id, 'start'); await readyA.promise;
  await f.profiles.select(owner, f.b.id); const bOwner = f.profiles.view(); f.profiles.save(bOwner, snapshot);
  started.push(await f.profiles.start(bOwner, { chatId: 'main', prompt: 'Continue B' })); await readyB.promise;
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  assert([...trees.values()].flatMap(Object.values).every(alive));
  const prep = f.service({ goals }), result = await prep.prepare(f.a.id);
  assert.equal(result.phase, 'prepared');
  const aTrees = [...trees].filter(([key]) => key.startsWith(f.a.id + '/')).map(([, tree]) => tree);
  assert.equal(aTrees.length, 4); assert(aTrees.flatMap(Object.values).every(pid => !alive(pid)));
  assert(Object.values(trees.get(f.b.id + '/main')).every(alive));
  const attempts = Object.entries(f.profiles.workspaces.load(f.a.id).ownership.attempts).map(([attemptId, value]) => ({ ...value, attemptId }));
  assert.equal(attempts.length, 4); assert(attempts.every(a => a.driverFinished));
  const nativeReceipts = attempts.map(a => {
    const receipt = JSON.parse(fs.readFileSync(f.store.filePath(`goal-processes/${a.attemptId}.receipt.json`)));
    assert.equal(receipt.phase, 'stopped'); assert.equal(receipt.activeProcesses, 0); return { attemptId: a.attemptId, stopped: receipt.phase };
  });
  const profiles = createProfileService({ registry: f.registry, agent });
  const restartedGoals = createGoalService({ registry: f.registry, profiles, heartbeatMs: 0 }); t.after(() => restartedGoals.close());
  assert.deepEqual(await f.service({ profiles, goals: restartedGoals }).prepare(f.a.id), result);
  assert(Object.values(trees.get(f.b.id + '/main')).every(alive));
  agent.cancel(started[1].runId); await f.profiles.wait(bOwner, started[1].runId);
  assert(Object.values(trees.get(f.b.id + '/main')).every(pid => !alive(pid)));
  t.diagnostic(JSON.stringify({ root: f.root, preparationId: result.id, nativeReceipts, trees: Object.fromEntries(trees),
    scope: 'Actual services, draft files and Windows jobs; foreground/terminal adapters supplied, not Electron preparation UI proof.' }));
});

for (const boundary of ['after-collecting', 'after-draining', 'after-quiescing', 'after-writer-closure', 'after-prepared', 'after-reopening', 'after-reopened-writer', 'after-aborted', 'after-reopened-launches']) {
  test(`abrupt process death ${boundary} recovers its retained lease and exact generation`, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-preparation-crash-'));
    const mode = ['after-reopening', 'after-reopened-writer', 'after-aborted', 'after-reopened-launches'].includes(boundary) ? 'abort' : 'prepare';
    const child = require('node:child_process').spawnSync(process.execPath, [require.resolve('./fixtures/profile-preparation-crash.cjs'), root, boundary, mode], {
      windowsHide: true, encoding: 'utf8', timeout: 20000,
    });
    assert.equal(child.status, 23, child.stderr || child.error?.message);
    const identity = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json')));
    const registry = createProfileRegistry(path.join(root, 'registry')), profileId = identity.profileId;
    const store = createStore(registry.storeFor(profileId).storeDir, { create: false });
    const before = JSON.parse(fs.readFileSync(store.filePath('profile-preparation.json')));
    assert.equal(fs.existsSync(store.filePath('profile-preparation.json.lock')), true, 'the dead process never ran finally cleanup');
    const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 }); t.after(() => goals.close());
    const prep = createProfilePreparation({ registry, profiles, goals,
      freezeForeground: async id => ({ profileId: id, sessionId: crypto.randomUUID(), draftKeys: [identity.key], assertCurrent: () => true, release() {} }),
      drainForeground: async () => true, drainTerminals: async () => true,
    });
    const result = await prep[mode](profileId);
    assert.equal(result.phase, mode === 'abort' ? 'aborted' : 'prepared'); assert.equal(result.id, before.id); assert.equal(result.closureId, before.closureId);
    if (mode === 'abort') assert.deepEqual(result.writerReopened, before.writerReopened);
    if (['after-writer-closure', 'after-prepared'].includes(boundary)) assert.deepEqual(result.writerAfter, before.writerAfter);
    assert.deepEqual(result.draftKeys, [identity.key]);
    assert.equal(createPaperDraftStore({ store, profileId }).read(identity.key).content.draft.snapshot.raw_source, 'Exact **source**\n');
    assert.equal(fs.existsSync(store.filePath('profile-preparation.json.lock')), false);
    t.diagnostic(JSON.stringify({ root, boundary, profileId, preparationId: result.id }));
  });
}
