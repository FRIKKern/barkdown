// A runtime left by a dead host is stopped only when the launch record proves it is this
// profile's own: same process id and same start time. A live host is never robbed, a recycled
// process id is never signalled, and the private database is stopped through its own directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createRuntimeRecord } = require('../main/runtime-orphan');
const dir = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-orphan-')));
function world(processes) {
  const stopped = [], logs = [];
  return { stopped, logs, startedAt: pid => processes.get(pid) || '', alive: pid => processes.has(pid),
    stop: async pid => { stopped.push(pid); processes.delete(pid); }, log: line => logs.push(line) };
}
test('no record means nothing to reclaim, and nothing is asked of the database', async () => {
  const w = world(new Map()), record = createRuntimeRecord({ dataDir: dir(), hostPid: 10, ...w });
  assert.deepEqual(await record.reclaim({ databaseRunning: async () => assert.fail('not asked') }), { reclaimed: false, runtime: false, database: false });
});
test('a runtime and a database left by a dead host are stopped and the record is cleared', async () => {
  const processes = new Map([[10, 'Mon 10:00'], [500, 'Mon 10:01']]), dataDir = dir();
  createRuntimeRecord({ dataDir, hostPid: 10, ...world(processes) }).write({ pid: 500, port: 1, pgPort: 2, bootId: 'b' });
  processes.delete(10); processes.set(20, 'Mon 11:00');
  const w = world(processes), next = createRuntimeRecord({ dataDir, hostPid: 20, ...w });
  let database = true;
  const result = await next.reclaim({ databaseRunning: async () => database, stopDatabase: async () => { database = false; } });
  assert.deepEqual(result, { reclaimed: true, runtime: true, database: true, hostPid: 10 });
  assert.deepEqual(w.stopped, [500]); assert.equal(next.read(), null); assert.match(w.logs[0], /reclaimed after host 10 ended: runtime 500, private database/);
});
test('a recycled process id is never signalled; a live host keeps its runtime', async () => {
  const processes = new Map([[10, 'Mon 10:00'], [500, 'Mon 10:01']]), dataDir = dir();
  createRuntimeRecord({ dataDir, hostPid: 10, ...world(processes) }).write({ pid: 500, port: 1, pgPort: 2 });
  const w = world(processes), other = createRuntimeRecord({ dataDir, hostPid: 20, ...w });
  await assert.rejects(other.reclaim(), { code: 'runtime_owned' });
  assert.deepEqual(w.stopped, []); assert.ok(other.read());
  processes.delete(10); processes.set(500, 'Tue 09:00');
  assert.deepEqual(await other.reclaim(), { reclaimed: false, runtime: false, database: false, hostPid: 10 });
  assert.deepEqual(w.stopped, [], 'process 500 now belongs to someone else'); assert.equal(other.read(), null);
});
test('a leftover that will not stop is an error and the record stays', async () => {
  const processes = new Map([[500, 'Mon 10:01']]), dataDir = dir();
  createRuntimeRecord({ dataDir, hostPid: 10, ...world(new Map([[10, 'x'], [500, 'Mon 10:01']])) }).write({ pid: 500, port: 1, pgPort: 2 });
  const stubborn = createRuntimeRecord({ dataDir, hostPid: 20, startedAt: pid => processes.get(pid) || '', alive: pid => processes.has(pid), stop: async () => {}, log: () => {} });
  await assert.rejects(stubborn.reclaim(), { code: 'runtime_reclaim' });
  assert.ok(stubborn.read());
  fs.writeFileSync(stubborn.file, '{"version":2}');
  await assert.rejects(stubborn.reclaim(), /invalid; nothing was stopped/);
});
test('a real detached process group left behind is stopped by its record', { skip: process.platform === 'win32' && 'POSIX process groups' }, async () => {
  const dataDir = dir();
  const child = spawn('/bin/sh', ['-c', 'sleep 120 & wait'], { detached: true, stdio: 'ignore' }); child.unref();
  await new Promise(resolve => setTimeout(resolve, 300));
  // The launch is recorded by a host that no longer exists.
  const dead = createRuntimeRecord({ dataDir, hostPid: 2147483600, startedAt: pid => pid === 2147483600 ? 'gone' : createRuntimeRecord.real(pid), alive: pid => pid !== 2147483600 && createRuntimeRecord.alive(pid), log: () => {} });
  dead.write({ pid: child.pid, port: 1, pgPort: 2 });
  const next = createRuntimeRecord({ dataDir, log: () => {} });
  const result = await next.reclaim();
  assert.equal(result.runtime, true);
  assert.throws(() => process.kill(-child.pid, 0), { code: 'ESRCH' }, 'the whole group is gone');
});
