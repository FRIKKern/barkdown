import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.dirname(here);
const cases = ['error', 'nonzero', 'no-effect', 'empty', 'incomplete', 'cancelled-cleanup', 'late-error', 'error-note', 'tool-error', 'cleanup-failed', 'unverified', 'approval', 'wrong-content', 'no-receipt', 'wrong-revision', 'no-read', 'success', 'delayed-finish', 'invalid-provider'];
for (const scenario of cases) test(`actual live runner classifies ${scenario}`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-provider-runner-'));
  const trace = path.join(root, 'trace.txt');
  const child = spawnSync(process.execPath, ['--require', path.join(here, 'fixtures/provider-truth-transport.cjs'), path.join(here, 'providers.live.mjs'), scenario === 'invalid-provider' ? 'typo' : 'claude', '--timeout-ms=250', '--cleanup-ms=150'], {
    cwd: app, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PROVIDER_TRUTH_SCENARIO: scenario, PROVIDER_TRUTH_TRACE: trace },
  });
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr }, null, 2));
  assert.equal(child.error, undefined, `runner itself hung: ${root}`);
  const pass = ['success', 'delayed-finish'].includes(scenario);
  assert.equal(child.status, scenario === 'invalid-provider' ? 2 : pass ? 0 : 1, `result retained at ${root}: ${child.stdout}\n${child.stderr}`);
  if (scenario === 'invalid-provider') { assert.equal(fs.existsSync(trace), false); return; }
  const reportPath = /Retained provider evidence: (.+)/.exec(child.stdout)?.[1].trim();
  assert.ok(reportPath, 'report path retained');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const result = report.results[0];
  assert.equal(result.pass, pass);
  assert.ok(fs.existsSync(path.join(report.root, 'claude', 'documents', result.documentId + '.json')), 'document evidence is retained');
  if (pass) { assert.equal(result.driverFinished, true); assert.equal(result.terminationVerified, true); assert.equal(result.afterRev, result.beforeRev + 1); }
  if (scenario === 'incomplete') { assert.equal(result.driverFinished, false); assert.equal(result.terminationVerified, false); assert.match(fs.readFileSync(trace, 'utf8'), /cancel/); }
  if (scenario === 'cancelled-cleanup') { assert.equal(result.driverFinished, true); assert.equal(result.terminationVerified, true); }
  if (scenario === 'approval') { assert.match(fs.readFileSync(trace, 'utf8'), /approval:false/); assert.doesNotMatch(fs.readFileSync(trace, 'utf8'), /approval:true/); }
  if (scenario === 'delayed-finish') assert.match(fs.readFileSync(trace, 'utf8'), /finished\nverify/);
  if (scenario === 'no-effect') assert.match(result.error, /Persisted document revision\/content/);
});
