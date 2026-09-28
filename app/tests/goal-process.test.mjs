import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { launchOwnedWorker, verifyOwnedWorker } = require('../main/goal-process');
const script = fileURLToPath(new URL('./fixtures/goal-process-tree.cjs', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const alive = pid => { try { process.kill(pid, 0); return true; } catch(e) { if(e.code === 'ESRCH')return false; throw e; } };
test('invalid pre-dispatch owner reports positively that no new process was launched', {}, async () => {
  const storeDir=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-pre-dispatch-'));
  await assert.rejects(launchOwnedWorker({storeDir,profileId:'invalid',attemptId:randomUUID(),script}), error => error.ownedProcessNotDispatched === true && /identity/.test(error.message));
  assert.deepEqual(fs.readdirSync(storeDir), []);
});
async function fixture(t) {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-owned-goal-'));
  const owner = { storeDir, profileId: randomUUID(), attemptId: randomUUID() }, marker = path.join(storeDir, 'effects.txt');
  let treeResolve; const tree = new Promise(resolve => { treeResolve = resolve; });
  const worker = await launchOwnedWorker({ ...owner, script, args: [marker], onMessage: message => { if(message.type === 'tree') treeResolve(message); } });
  t.after(async () => { worker.stop(); await worker.finished.catch(() => {}); });
  await worker.ready;
  const pids = await Promise.race([tree, worker.finished.then(() => { throw new Error('Worker exited before tree'); })]);
  await delay(150); return { owner, marker, worker, pids };
}
async function stopped(f) {
  await f.worker.finished;
  assert.ok([f.pids.root, f.pids.pid, f.pids.leaf].every(pid => !alive(pid)));
  const before = fs.readFileSync(f.marker, 'utf8'); await delay(150); assert.equal(fs.readFileSync(f.marker,'utf8'), before);
  assert.equal(await verifyOwnedWorker(f.owner), true);
}
test('owned cancellation stops a real child/grandchild tree before acknowledging', { timeout: 30000 }, async t => {
  const f = await fixture(t); assert.equal(await verifyOwnedWorker(f.owner), false);
  f.worker.stop(); await stopped(f);
});
test('forced supervisor death closes job and restart verifier proves the entire owned tree stopped', { timeout: 30000 }, async t => {
  const f = await fixture(t); process.kill(f.worker.helperPid, 'SIGKILL'); await stopped(f);
  const record = JSON.parse(fs.readFileSync(f.worker.receiptPath)); assert.equal(record.phase, 'assigned');
  record.nonce = randomUUID(); fs.writeFileSync(f.worker.receiptPath, JSON.stringify(record));
  await assert.rejects(verifyOwnedWorker(f.owner), /owner mismatch/);
});
test('normal worker exit drains descendants and duplicate attempt launch is refused', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await assert.rejects(launchOwnedWorker({ ...f.owner, script }), /EEXIST/);
  f.worker.send({ type: 'finish' }); await stopped(f);
});
test('abrupt main host exit closes its control pipe and restart verifies descendant shutdown', { timeout: 30000 }, async () => {
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-goal-host-crash-'));
  const owner = { storeDir, profileId: randomUUID(), attemptId: randomUUID() };
  const host = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/goal-host-crash.cjs', import.meta.url)), JSON.stringify(owner)], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  let diagnostic='';host.stderr.on('data',b=>diagnostic+=b);
  const code = await new Promise((resolve,reject)=>{host.once('error',reject);host.once('exit',resolve);});
  assert.equal(code,23,diagnostic);
  const pids=JSON.parse(fs.readFileSync(path.join(storeDir,'tree.json')));
  let verified=false;
  for(let i=0;i<20&&!verified;i++){await delay(100);verified=await verifyOwnedWorker(owner);}
  assert.equal(verified,true);assert.ok([pids.root,pids.pid,pids.leaf].every(pid=>!alive(pid)));
  const marker=path.join(storeDir,'effects.txt'),before=fs.readFileSync(marker,'utf8');await delay(150);assert.equal(fs.readFileSync(marker,'utf8'),before);
});
