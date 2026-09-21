import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { acquireFileLease } = require('../main/file-lease');
const modulePath = require.resolve('../main/file-lease');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-file-lease-'));
const file = path.join(root, 'owner.json');
const waitFor = async condition => { const until = Date.now() + 10000; while (!condition()) { assert.ok(Date.now() < until, 'child fixture timed out'); await new Promise(r => setTimeout(r, 10)); } };
fs.writeFileSync(file, JSON.stringify({ pid: 2147483647 }));
const ready = path.join(root, 'stale-read'), resume = path.join(root, 'resume'), acquired = path.join(root, 'acquired'), finish = path.join(root, 'finish');
const script = `const fs=require('fs');const {acquireFileLease}=require(${JSON.stringify(modulePath)});const pause=p=>{while(!fs.existsSync(p))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5)};const lease=acquireFileLease(${JSON.stringify(file)},{checkpoint:()=>{fs.writeFileSync(${JSON.stringify(ready)},'ready');pause(${JSON.stringify(resume)})}});fs.writeFileSync(${JSON.stringify(acquired)},lease.lease);pause(${JSON.stringify(finish)});lease.release();`;
const child = spawn(process.execPath, ['-e', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let error = ''; child.stderr.on('data', text => error += text);
try {
  await waitFor(() => fs.existsSync(ready));
  assert.throws(() => acquireFileLease(file), /recovery is already owned/);
  assert.equal(JSON.parse(fs.readFileSync(file)).pid, 2147483647, 'second reader cannot rename stale file under first recovery');
  fs.writeFileSync(resume, 'resume'); await waitFor(() => fs.existsSync(acquired));
  const owner = JSON.parse(fs.readFileSync(file));
  assert.equal(owner.pid, child.pid); assert.equal(owner.lease, fs.readFileSync(acquired, 'utf8'));
  assert.throws(() => acquireFileLease(file), /another writer/);
  assert.equal(JSON.parse(fs.readFileSync(file)).lease, owner.lease, 'new live owner survives competing stale recovery');
  fs.writeFileSync(finish, 'finish'); await waitFor(() => child.exitCode !== null);
  assert.equal(child.exitCode, 0, error); assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readdirSync(root).filter(name => name.startsWith('owner.json.abandoned-')).length, 1);
} finally { fs.writeFileSync(resume, 'resume'); fs.writeFileSync(finish, 'finish'); if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve)); }
console.log('PASS concurrent stale recovery keeps new owner and preserves stale evidence');

const owned = acquireFileLease(file);
fs.writeFileSync(file, JSON.stringify({ pid: process.pid, lease: 'replacement-owner' }));
assert.throws(() => owned.release(), /another owner/);
assert.equal(JSON.parse(fs.readFileSync(file)).lease, 'replacement-owner');
console.log('PASS release refuses replaced owner');

const retryFile = path.join(root, 'retry.json'), retry = acquireFileLease(retryFile);
const unlink = fs.unlinkSync; let blockedOnce = true;
fs.unlinkSync = target => { if (target === retryFile && blockedOnce) { blockedOnce = false; throw Object.assign(new Error('fixture file busy'), { code: 'EBUSY' }); } return unlink(target); };
try { assert.throws(() => retry.release(), /fixture file busy/); assert.ok(fs.existsSync(retryFile)); retry.release(); retry.release(); assert.equal(fs.existsSync(retryFile), false); }
finally { fs.unlinkSync = unlink; }
console.log('PASS release retries failed unlink after descriptor close');

const blocked = path.join(root, 'blocked.json');
fs.writeFileSync(blocked, JSON.stringify({ pid: 2147483647 })); fs.writeFileSync(blocked + '.recovery', JSON.stringify({ pid: 2147483647 }));
assert.throws(() => acquireFileLease(blocked), /inspect retained recovery lease/);
assert.equal(JSON.parse(fs.readFileSync(blocked)).pid, 2147483647);
console.log('PASS interrupted recovery gate remains explicit instead of guessing ownership');
console.log('Lease fixtures retained:', root);
