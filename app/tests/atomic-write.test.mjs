import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { openJournal } = require('../main/goals');

// Real Windows replacement refusal, controlled only at the failed rename boundary.
// Each fixture is disposable and retained. No external effects or library content.
for (const kind of ['workspace', 'journal']) {
  test(`${kind}: transient reader releases after first refused replacement`, { skip: process.platform !== 'win32' }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-atomic-retry-'));
    let file, write, read, close = () => {};
    if (kind === 'workspace') {
      const registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Retry fixture' });
      const store = registry.storeFor(profile.id); file = path.join(store.storeDir, 'workspace.json');
      let revision = 0; write = () => store.writeJson('workspace.json', { revision: ++revision }); read = () => store.readJson('workspace.json');
    } else {
      const journal = openJournal(root); file = path.join(root, 'goals.json');
      write = () => journal.write({ goals: [] }); read = () => journal.read(); close = () => journal.close();
    }
    write(); const before = read(), previous = fs.readFileSync(file);
    let reader = fs.openSync(file, 'r'), refusals = 0, calls = 0;
    const rename = fs.renameSync;
    fs.renameSync = (source, destination) => {
      if (destination !== file) return rename(source, destination);
      calls++;
      try { return rename(source, destination); }
      catch (error) {
        assert.equal(error.code, 'EPERM'); refusals++;
        assert.deepEqual(fs.readFileSync(file), previous, 'refused rename leaves exact prior authority');
        assert.deepEqual(read(), before, 'no early acknowledgement');
        fs.closeSync(reader); reader = undefined;
        throw error;
      }
    };
    try {
      assert.doesNotThrow(write, 'same prepared write should retry after known transient reader releases');
      assert.equal(refusals, 1); assert.equal(calls, 2);
      assert.equal(read().revision, before.revision + 1);
    } finally { fs.renameSync = rename; if (reader !== undefined) fs.closeSync(reader); close(); }
  });
}

function adapter(kind) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-atomic-guard-'));
  if (kind === 'journal') {
    const journal = openJournal(root); journal.write({ goals: [] });
    return { root, file: path.join(root, 'goals.json'), lease: path.join(root, 'goals.lease'), write: () => journal.write({ goals: [] }), read: () => journal.read(), close: () => journal.close() };
  }
  const registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Guard fixture' }), store = registry.storeFor(profile.id);
  store.writeJson('workspace.json', { revision: 1 }); const file = path.join(store.storeDir, 'workspace.json');
  return { root, file, lease: file + '.write-lease', write: () => store.writeJson('workspace.json', { revision: 2 }), read: () => store.readJson('workspace.json'), close: () => {} };
}
const injected = code => Object.assign(new Error('Controlled ' + code), { code });
for (const kind of ['workspace', 'journal']) {
  test(`${kind}: persistent real reader has bounded attempts and retains candidate`, { skip: process.platform !== 'win32' }, () => {
    const a = adapter(kind), previous = fs.readFileSync(a.file), old = a.read();
    const fd = fs.openSync(a.file, 'r'), rename = fs.renameSync; let calls = 0, candidate;
    fs.renameSync = (source, destination) => { if (destination === a.file) { calls++; candidate = source; } return rename(source, destination); };
    try {
      assert.throws(a.write, { code: 'EPERM' }); assert.ok(calls >= 2 && calls <= 5);
      assert.deepEqual(fs.readFileSync(a.file), previous); assert.deepEqual(a.read(), old);
      assert.ok(fs.existsSync(candidate)); JSON.parse(fs.readFileSync(candidate));
    } finally { fs.renameSync = rename; fs.closeSync(fd); a.close(); }
  });
  for (const mode of ['target', 'candidate', 'lease', 'post-rename', 'nonretry']) {
    test(`${kind}: refuses ${mode} ambiguity without a second rename`, { skip: process.platform !== 'win32' }, () => {
      const a = adapter(kind), previous = fs.readFileSync(a.file), old = a.read(), rename = fs.renameSync;
      let calls = 0, candidate, originalLease;
      fs.renameSync = (source, destination) => {
        if (destination !== a.file) return rename(source, destination);
        calls++; candidate = source;
        if (mode === 'target') fs.writeFileSync(a.file, JSON.stringify({ revision: 999, external: true }));
        if (mode === 'candidate') fs.writeFileSync(source, JSON.stringify({ tampered: true }));
        if (mode === 'lease') { originalLease = fs.readFileSync(a.lease); fs.writeFileSync(a.lease, JSON.stringify({ pid: process.pid, lease: 'changed', nonce: 'changed' })); }
        if (mode === 'post-rename') rename(source, destination);
        throw injected(mode === 'nonretry' ? 'EACCES' : 'EPERM');
      };
      try {
        assert.throws(a.write, mode === 'lease' ? /lease changed/i : mode === 'nonretry' ? { code: 'EACCES' } : { code: 'BARKDOWN_WRITE_AUTHORITY_CHANGED' });
        assert.equal(calls, 1);
        if (mode !== 'target' && mode !== 'post-rename') assert.deepEqual(fs.readFileSync(a.file), previous);
        if (kind === 'journal') assert.deepEqual(a.read(), old, 'failure never advances memory authority');
        if (mode === 'target') assert.equal(JSON.parse(fs.readFileSync(a.file)).external, true);
        if (mode !== 'post-rename') assert.ok(fs.existsSync(candidate));
        else assert.equal(fs.existsSync(candidate), false, 'uncertain committed rename is not replayed');
      } finally { fs.renameSync = rename; if (originalLease) fs.writeFileSync(a.lease, originalLease); a.close(); }
    });
  }
}

test('journal refuses authority changed between calls', () => {
  const a = adapter('journal'), old = a.read();
  const external = Buffer.from(JSON.stringify({ version: 1, revision: 42, goals: [] })); fs.writeFileSync(a.file, external);
  try { assert.throws(a.write, { code: 'BARKDOWN_WRITE_AUTHORITY_CHANGED' }); assert.deepEqual(a.read(), old); assert.deepEqual(fs.readFileSync(a.file), external); }
  finally { a.close(); }
});

test('managed store serializes cooperating target writers during retry', { skip: process.platform !== 'win32' }, () => {
  const a = adapter('workspace'), rename = fs.renameSync; let calls = 0;
  fs.renameSync = (source, destination) => {
    if (destination === a.file && ++calls === 1) { assert.throws(a.write, /another writer/); throw injected('EBUSY'); }
    return rename(source, destination);
  };
  try { a.write(); assert.equal(calls, 2); assert.equal(a.read().revision, 2); assert.equal(fs.existsSync(a.lease), false); }
  finally { fs.renameSync = rename; a.close(); }
});

// Independent worker releases its real descriptor while the synchronous caller waits.
for (const kind of ['workspace', 'journal']) {
  test(`${kind}: independent reader closes while retry waits`, { skip: process.platform !== 'win32', timeout: 10000 }, async () => {
    const { Worker } = await import('node:worker_threads');
    const a = adapter(kind), rename = fs.renameSync; let calls = 0;
    const worker = new Worker(`const fs=require('fs');const {parentPort,workerData}=require('worker_threads');const fd=fs.openSync(workerData,'r');parentPort.postMessage('ready');parentPort.once('message',()=>setTimeout(()=>{fs.closeSync(fd);parentPort.close()},15));`, { eval: true, workerData: a.file });
    const exited = new Promise((resolve, reject) => { worker.once('exit', resolve); worker.once('error', reject); });
    await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    fs.renameSync = (source, destination) => {
      if (destination !== a.file) return rename(source, destination);
      calls++;
      try { return rename(source, destination); }
      catch (error) { if (calls === 1) worker.postMessage('release'); throw error; }
    };
    try { a.write(); assert.ok(calls >= 2 && calls <= 5); assert.equal(a.read().revision, 2); assert.equal(await exited, 0); }
    finally { fs.renameSync = rename; await worker.terminate(); a.close(); }
  });
}

test('atomic writer refuses newly created or same-byte replaced target', { skip: process.platform !== 'win32' }, () => {
  const { atomicWrite } = require('../main/atomic-write');
  for (const existed of [false, true]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-atomic-identity-')), file = path.join(root, 'target.json');
    if (existed) fs.writeFileSync(file, 'old');
    const rename = fs.renameSync; let calls = 0;
    fs.renameSync = (source, destination) => {
      calls++; const replacement = path.join(root, 'external'); fs.writeFileSync(replacement, 'old'); rename(replacement, destination); throw injected('EPERM');
    };
    try { assert.throws(() => atomicWrite(file, 'new', { assertOwned() {} }), { code: 'BARKDOWN_WRITE_AUTHORITY_CHANGED' }); assert.equal(calls, 1); assert.equal(fs.readFileSync(file, 'utf8'), 'old'); }
    finally { fs.renameSync = rename; }
  }
});

test('fsync failure retains prior bytes without any rename attempt', () => {
  const a = adapter('journal'), before = fs.readFileSync(a.file), sync = fs.fsyncSync, rename = fs.renameSync; let calls = 0;
  fs.fsyncSync = () => { throw injected('EIO'); }; fs.renameSync = (...args) => { calls++; return rename(...args); };
  try { assert.throws(a.write, { code: 'EIO' }); assert.equal(calls, 0); assert.deepEqual(fs.readFileSync(a.file), before); assert.equal(a.read().revision, 1); }
  finally { fs.fsyncSync = sync; fs.renameSync = rename; a.close(); }
});
