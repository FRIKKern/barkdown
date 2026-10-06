import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function driver() {
  return { starts: 0, stops: 0, acquired: false, up: false,
    async acquire() { this.acquired = true; }, async release() { this.acquired = false; },
    async start() { this.starts++; this.up = true; }, async stop() { this.stops++; this.up = false; },
    async healthy() { return this.up; }, async checkFailure() {},
  };
}
{
  const d = driver(), r = new LocalBarkpark(d, { interval: 10 });
  await Promise.all([r.start(), r.start(), r.start()]); assert.equal(d.starts, 1);
  d.up = false;
  for (let i = 0; i < 100 && d.starts < 2; i++) await sleep(5);
  await r.ready(); assert.equal(d.starts, 2);
  await r.stop(); assert.equal(d.up, false); assert.equal(d.acquired, false);
}
{
  const d = driver(); d.start = async () => { d.starts++; throw new Error('spawn failure 487'); };
  const r = new LocalBarkpark(d, { interval: 1, retries: 2 });
  await assert.rejects(r.start(), /487/); assert.equal(d.starts, 3);
  assert.equal(r.status().phase, 'failed'); assert.equal(d.acquired, false);
  await assert.rejects(r.ready(), /487/);
  d.start = async () => { d.starts++; d.up = true; };
  await r.start(); assert.equal(r.status().phase, 'ready'); assert.equal(r.status().attempts, 0);
  await r.stop();
}
{
  const d = driver(); d.healthy = async () => false;
  const r = new LocalBarkpark(d, { interval: 10 });
  const pending = r.start(); await sleep(10); await r.stop();
  await assert.rejects(pending); assert.equal(d.up, false); assert.equal(d.acquired, false);
  assert.equal(r.status().phase, 'stopped');
}
{
  // Two missed probes in a row are a slow runtime, not a dead one; the third restarts it.
  const d = driver(); let answers = 0; d.healthy = async () => { answers++; return answers <= 1 || answers > 3; };
  const r = new LocalBarkpark(d, { interval: 10 });
  await r.start(); assert.equal(d.starts, 1);
  for (let i = 0; i < 100 && answers < 4; i++) await sleep(5);
  assert.equal(d.starts, 1, 'two misses do not restart');
  const flaky = driver(); flaky.healthy = async () => flaky.up && false; flaky.start = async () => { flaky.starts++; flaky.up = true; flaky.healthy = async () => flaky.up; };
  await r.stop();
  const s = new LocalBarkpark(flaky, { interval: 10 });
  flaky.healthy = async () => flaky.up; await s.start(); flaky.healthy = async () => false;
  for (let i = 0; i < 200 && flaky.starts < 2; i++) await sleep(5);
  assert.equal(flaky.starts, 2, 'the third miss restarts'); await s.stop();
}
{
  const d = driver(); d.acquire = async () => { throw new Error('owned elsewhere'); };
  const r = new LocalBarkpark(d); await assert.rejects(r.start(), /owned elsewhere/);
  assert.equal(d.starts, 0); assert.equal(d.stops, 0);
}
{
  const d = driver(); d.healthy = async () => false;
  const r = new LocalBarkpark(d, { interval: 2, startupTimeout: 5, retries: 0 });
  await assert.rejects(r.start(), /deadline/); assert.equal(d.up, false); assert.equal(d.acquired, false);
}
{
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-sidecar-log-'));
  const d = Object.assign(Object.create(SourceDriver.prototype), { child: { exitCode: null }, pgLog: path.join(data, 'pg.log'), logOffset: 0 });
  fs.writeFileSync(d.pgLog, 'database system is ready\n'); await d.checkFailure();
  fs.appendFileSync(d.pgLog, 'could not reserve shared memory region: error 487\n');
  await assert.rejects(d.checkFailure(), /487/);
  d.child.exitCode = 1; await assert.rejects(d.checkFailure(), /exited/);
}
{
  // A data folder from another Postgres major is refused in plain words before anything starts.
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-pg-major-')); const pgBin = path.join(data, 'bin'); fs.mkdirSync(pgBin);
  const childProcess = require('node:child_process'), originalExec = childProcess.execFileSync;
  childProcess.execFileSync = (file, args, options) => {
    assert.equal(file, path.join(pgBin, 'pg_ctl')); assert.deepEqual(args, ['--version']);
    return originalExec(process.execPath, ['-e', 'console.log("pg_ctl (PostgreSQL) 16.4")'], options);
  };
  try {
  const d = Object.assign(Object.create(SourceDriver.prototype), { pgData: path.join(data, 'pgdata'), pgBin, exe: '', packaged: null });
  d.assertDatabaseCompatible();
  fs.mkdirSync(d.pgData); fs.writeFileSync(path.join(d.pgData, 'PG_VERSION'), '15\n');
  assert.throws(() => d.assertDatabaseCompatible(), /made by PostgreSQL 15, and this runtime brings PostgreSQL 16\. Nothing was changed\. Export the profile/);
  fs.writeFileSync(path.join(d.pgData, 'PG_VERSION'), '16\n'); d.assertDatabaseCompatible();
  // A packaged runtime names its Postgres in the release mark; that wins over asking the binary.
  d.packaged = { postgres: { postgres: '15.18' } }; assert.throws(() => d.assertDatabaseCompatible(), /made by PostgreSQL 16, and this runtime brings PostgreSQL 15/);
  } finally { childProcess.execFileSync = originalExec; }
}
console.log('Local Barkpark lifecycle: duplicate starts, health recovery after three misses, retry budget, cancellation, ownership refusal, Windows worker failure detection and the Postgres major guard passed.');
