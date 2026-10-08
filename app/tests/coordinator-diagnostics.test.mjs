import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coordinatorDiagnostics, descendants } from './helpers/coordinator-diagnostics.mjs';

test('diagnostics retain only the fixture process family, in arbitrary enumeration order', () => {
  const rows = [{ ProcessId: 3, ParentProcessId: 2 }, { ProcessId: 9, ParentProcessId: 8 }, { ProcessId: 2, ParentProcessId: 1 }, { ProcessId: 1, ParentProcessId: 8 }];
  assert.deepEqual(descendants(rows, 1).map(row => row.ProcessId), [3, 2, 1]);
});

test('startup failure distinguishes launches, corrupt receipts, absent directories and failed process enumeration', async () => {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-coordinator-diagnostics-'));
  const missing = await coordinatorDiagnostics({ store, rootPid: 1, stderr: [], platform: 'win32', readProcesses: async () => { throw new Error('fixture query unavailable'); } });
  assert.match(missing.filesError, /ENOENT/); assert.match(missing.processesError, /fixture query unavailable/);
  fs.mkdirSync(path.join(store, 'goal-processes'));
  fs.writeFileSync(path.join(store, 'goal-processes/fixture.launch.json'), '{"nonce":"fixture"}');
  fs.writeFileSync(path.join(store, 'goal-processes/fixture.receipt.json'), '{');
  fs.writeFileSync(path.join(store, 'goal-processes/unrelated.json'), '{"excluded":true}');
  const result = await coordinatorDiagnostics({ store, rootPid: 1, stderr: [{ pid: 1, text: 'fixture error' }], platform: 'win32', readProcesses: async () => [{ ProcessId: 1, ParentProcessId: 0, Name: 'fixture' }] });
  assert.equal(result.files.length, 2); assert.equal(result.files[0].value.nonce, 'fixture'); assert.ok(result.files[1].error);
  assert.deepEqual(result.processes, [{ ProcessId: 1, ParentProcessId: 0, Name: 'fixture' }]);
  assert.equal(result.stderr[0].text, 'fixture error');
});
