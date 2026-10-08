// Keep the historical runner entry while guarding against its former pruning.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { captureWithCleanup } from './helpers/capture-lifecycle.mjs';

for (const exitCode of [0, 7]) test(`capture exit ${exitCode} preserves older runtimes and their bytes`, async () => {
  const parent = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-capture-retention-'));
  const current = path.join(parent, 'barkdown-shots-runtime-current');
  fs.mkdirSync(current);
  const snapshots = [];
  for (const [name, result] of [['successful', { success: true }], ['failed', { success: false, primaryError: 'retained failure' }], ['unreceipted', null]]) {
    const dir = path.join(parent, `barkdown-shots-runtime-${name}`);
    fs.mkdirSync(path.join(dir, 'pgdata'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pgdata', 'retained.bin'), Buffer.from([0, 255, 42, 10]));
    if (result) fs.writeFileSync(path.join(dir, 'capture-result.json'), JSON.stringify(result));
    const at = new Date(Date.now() - 5 * 3600000);
    fs.utimesSync(dir, at, at);
    snapshots.push({ dir, files: fs.readdirSync(dir, { recursive: true }).filter(file => fs.statSync(path.join(dir, file)).isFile()).map(file => [file, fs.readFileSync(path.join(dir, file))]), mtime: fs.statSync(dir).mtimeMs });
  }
  let started = 0, stopped = 0;
  const capture = captureWithCleanup({
    data: current,
    runtime: { async start() { started++; }, async stop() { stopped++; } },
    launch: () => spawn(process.execPath, ['-e', `process.exit(${exitCode})`], { windowsHide: true, stdio: 'ignore' })
  });
  if (exitCode) await assert.rejects(capture, /Live screenshot capture failed with exit 7/);
  else await capture;
  assert.equal(started, 1);
  assert.equal(stopped, 1);
  const receipt = JSON.parse(fs.readFileSync(path.join(current, 'capture-result.json')));
  assert.equal(receipt.success, exitCode === 0);
  for (const { dir, files, mtime } of snapshots) {
    assert.equal(fs.statSync(dir).mtimeMs, mtime, `${dir} stays untouched`);
    for (const [file, bytes] of files) assert.deepEqual(fs.readFileSync(path.join(dir, file)), bytes, `${dir}/${file} stays byte-identical`);
  }
  // These tiny fixtures stay available; this regression must not delete its proof.
  console.log(`Retained capture control: ${parent}`);
});
