import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.dirname(here);
for (const scenario of ['error', 'nonzero', 'no-effect', 'empty', 'incomplete']) test(`actual live runner fails ${scenario}`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-provider-runner-'));
  const trace = path.join(root, 'trace.txt');
  const child = spawnSync(process.execPath, ['--require', path.join(here, 'fixtures/provider-truth-transport.cjs'), path.join(here, 'providers.live.mjs'), 'claude', '--timeout-ms=150', '--cleanup-ms=150'], {
    cwd: app, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PROVIDER_TRUTH_SCENARIO: scenario, PROVIDER_TRUTH_TRACE: trace },
  });
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr }, null, 2));
  assert.equal(child.error, undefined, `runner itself hung: ${root}`);
  assert.equal(child.status, 1, `false pass retained at ${root}: ${child.stdout}\n${child.stderr}`);
});
