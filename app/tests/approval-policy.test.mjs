// Approvals (D-no-approvals): every approval goes through requestApproval, and a policy handed in by the main
// process decides whether the person is asked. Without a policy (the goal worker's process) the request is
// emitted, so the main process decides.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const runs = require('../main/providers/runs');
const fakeRun = () => { const events = []; return { approvals: new Map(), emit: event => events.push(event), events }; };
const settle = promise => Promise.race([promise.then(value => ({ value })), new Promise(resolve => setTimeout(() => resolve({ pending: true }), 20))]);

test('without a policy the person is asked and the answer decides', async () => {
  runs.setApprovalPolicy(null);
  const run = fakeRun(), asked = runs.requestApproval(run, { kind: 'command', command: 'rm -rf build' });
  assert.deepEqual(await settle(asked), { pending: true });
  assert.equal(run.events.length, 1); assert.equal(run.events[0].type, 'approval'); assert.equal(run.events[0].request.command, 'rm -rf build');
  run.approvals.get(run.events[0].approvalId)(false);
  assert.equal(await asked, false);
});

test('a policy that skips approves at once and shows no card', async () => {
  let skips = true; runs.setApprovalPolicy(() => skips);
  const run = fakeRun();
  assert.equal(await runs.requestApproval(run, { kind: 'tool', tool: 'mcp__claude_ai_Claude_Docs__update' }), true);
  assert.equal(run.events.length, 0); assert.equal(run.approvals.size, 0);
  // The policy is asked each time: switching back in the middle of a run asks again.
  skips = false;
  const asked = runs.requestApproval(run, { kind: 'write_file', path: 'notes.md' });
  assert.deepEqual(await settle(asked), { pending: true }); assert.equal(run.events.length, 1);
  run.approvals.get(run.events[0].approvalId)(true); assert.equal(await asked, true);
  runs.setApprovalPolicy(null);
});

test('a policy that fails asks', async () => {
  runs.setApprovalPolicy(() => { throw new Error('settings unreadable'); });
  const run = fakeRun(), asked = runs.requestApproval(run, { kind: 'command', command: 'ls' });
  assert.deepEqual(await settle(asked), { pending: true }); assert.equal(run.events.length, 1);
  run.approvals.get(run.events[0].approvalId)(true); await asked;
  runs.setApprovalPolicy(null);
});
