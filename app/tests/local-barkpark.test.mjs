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
console.log('Local Barkpark lifecycle: duplicate starts, health recovery, retry budget, cancellation, ownership refusal and Windows worker failure detection passed.');
