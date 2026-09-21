import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || '../../barkpark-editor');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-sidecar-'));
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const driver = new SourceDriver({ source, port: 4549, pgPort: 5549 }, data, secrets);
const runtime = new LocalBarkpark(driver, { interval: 1000, retries: 1 });
runtime.on('status', s => console.log(s.phase, s.error || ''));
console.log('Isolated runtime data:', data);
try {
  await runtime.start();
  assert.equal(runtime.status().phase, 'ready');
  const response = await fetch(driver.server + '/v1/data/query/production/paper?limit=10', { headers: { Authorization: 'Bearer ' + secrets.token } });
  assert.equal(response.status, 200);
  // Kill only this test's PostgreSQL cluster, never the shared developer server.
  await driver.run('pg_ctl', ['-D', driver.pgData, '-m', 'immediate', '-w', 'stop']);
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline && !(runtime.status().phase === 'ready' && runtime.status().attempts > 0)) await new Promise(r => setTimeout(r, 500));
  assert.equal(runtime.status().phase, 'ready'); assert.ok(runtime.status().attempts > 0);
  await runtime.stop();
  await runtime.start();
  assert.equal(runtime.status().phase, 'ready');
  console.log('PASS real private Postgres + Barkpark startup, authenticated read, database crash recovery, restart.');
} finally { await runtime.stop(); }
