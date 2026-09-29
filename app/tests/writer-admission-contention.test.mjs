// Two processes of one profile write through the same admission lock: the second waits for the
// first instead of failing with a raw EEXIST (found by the switch rehearsal: the assistant's
// edit lost the lock to the app saving its workspace).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { controller } = require('../main/writer-admission');
const holder = `
const { acquireFileLease } = require(${JSON.stringify(fileURLToPath(new URL('../main/file-lease.js', import.meta.url)))});
const fs = require('node:fs');
const lease = acquireFileLease(process.argv[1], { completeOwner: true, busy: 'Writer admission is busy' });
fs.writeFileSync(process.argv[2], 'held');
setTimeout(() => { lease.release(); }, Number(process.argv[3]));
`;
test('a writer waits for another process holding the admission lock, then runs', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-contention-')));
  const store = createStore(path.join(root, 'store'));
  const control = controller(store); control.capture();
  const lock = store.filePath('writer-admission.lock'), marker = path.join(root, 'held');
  const child = spawn(process.execPath, ['-e', holder, lock, marker, '300'], { stdio: 'inherit' });
  const exited = new Promise(resolve => child.on('exit', resolve));
  for (let i = 0; i < 200 && !fs.existsSync(marker); i++) await new Promise(r => setTimeout(r, 10));
  assert.ok(fs.existsSync(marker), 'the other process holds the lock');
  const started = Date.now(), token = control.capture();
  assert.equal(await control.run(token, 'test:write', () => 'written'), 'written');
  assert.ok(Date.now() - started >= 100, 'the write waited for the holder');
  await exited;
  assert.ok(!fs.existsSync(lock), 'the lock is free again');
});
test('a lock held longer than the wait budget is reported busy, never as a raw file error', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-writer-contention-')));
  const store = createStore(path.join(root, 'store'));
  const control = controller(store); control.capture();
  const lock = store.filePath('writer-admission.lock'), marker = path.join(root, 'held');
  const child = spawn(process.execPath, ['-e', holder, lock, marker, '4000'], { stdio: 'inherit' });
  const exited = new Promise(resolve => child.on('exit', resolve));
  for (let i = 0; i < 200 && !fs.existsSync(marker); i++) await new Promise(r => setTimeout(r, 10));
  const token = control.capture();
  await assert.rejects(async () => control.run(token, 'test:write', () => 'written'), /Writer admission is busy/);
  child.kill(); await exited;
});
