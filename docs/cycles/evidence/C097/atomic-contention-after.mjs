import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/profile-registry');
const { openJournal } = require('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/goals');

// Real Windows replacement refusal, controlled only at the failed rename boundary. POSIX renames
// never refuse a reader, so these cases have no twin there; the skip ratchet in host-skips.test.mjs
// records the gap (owner: the Windows return checkpoint). C084 dropped the skips without rerunning
// this segment on macOS; restored 2026-09-29.
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

test('managed store serializes cooperating target writers during retry', { skip: process.platform !== 'win32' }, t => {
  const a = adapter('workspace'), rename = fs.renameSync; let calls = 0;
  // This case proves lease exclusion across a retry, not disk latency. The nested
  // contender can spend the real retry budget on a busy host; test expiry separately.
  t.mock.method(performance, 'now', () => 0);
  fs.renameSync = (source, destination) => {
    if (destination === a.file && ++calls === 1) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150); assert.throws(a.write, /another writer/); throw injected('EBUSY'); }
    return rename(source, destination);
  };
  try { a.write(); assert.equal(calls, 2); assert.equal(a.read().revision, 2); assert.equal(fs.existsSync(a.lease), false); }
  finally { fs.renameSync = rename; a.close(); }
});

test('managed store retains authority after an expired Windows retry budget or a nonretrying POSIX refusal', t => {
  const a = adapter('workspace'), rename = fs.renameSync, before = fs.readFileSync(a.file);
  const ticks = [0, 121]; let calls = 0, candidate;
  t.mock.method(performance, 'now', () => ticks.shift() ?? 121);
  fs.renameSync = (source, destination) => {
    if (destination !== a.file) return rename(source, destination);
    calls++; candidate = source; throw injected('EBUSY');
  };
  try {
    assert.throws(a.write, { code: 'EBUSY' }); assert.equal(calls, 1, 'no replacement after the elapsed deadline');
    assert.equal(ticks.length, process.platform === 'win32' ? 0 : 1, 'Windows checks expiry; POSIX refuses without entering the retry clock');
    assert.deepEqual(fs.readFileSync(a.file), before); assert.equal(a.read().revision, 1);
    assert.equal(JSON.parse(fs.readFileSync(candidate, 'utf8')).revision, 2, 'unacknowledged candidate is retained');
    assert.equal(fs.existsSync(a.lease), false);
  } finally { fs.renameSync = rename; a.close(); }
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
  const { atomicWrite } = require('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/atomic-write');
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

for (const kind of ['workspace', 'journal']) {
  test(`${kind}: host death before rename keeps authority and never promotes orphan`, { timeout: 15000 }, async () => {
    const { spawn } = await import('node:child_process');
    const a = adapter(kind), before = fs.readFileSync(a.file); a.close();
    const registryModule = require.resolve('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/profile-registry'), journalModule = require.resolve('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/goals');
    const script = `const fs=require('fs');const {createProfileRegistry}=require(${JSON.stringify(registryModule)});const {openJournal}=require(${JSON.stringify(journalModule)});const rename=fs.renameSync;fs.renameSync=(source,destination)=>{if(destination===${JSON.stringify(a.file)}){fs.writeFileSync(${JSON.stringify(path.join(a.root, 'prepared.json'))},JSON.stringify({source,pid:process.pid}));process.stdout.write('prepared\\n');for(;;)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);}return rename(source,destination)};if(${JSON.stringify(kind)}==='workspace'){const r=createProfileRegistry(${JSON.stringify(a.root)});r.storeFor(r.load().selectedProfileId).writeJson('workspace.json',{revision:2})}else{openJournal(${JSON.stringify(a.root)}).write({goals:[]})}`;
    const child = spawn(process.execPath, ['-e', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = ''; child.stderr.on('data', b => errors += b);
    const exited = new Promise(resolve => child.once('exit', resolve));
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Prepared fixture timed out: ' + errors)), 8000);
        child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); reject(new Error('Writer exited before prepared: ' + code + errors)); });
      });
      const prepared = JSON.parse(fs.readFileSync(path.join(a.root, 'prepared.json')));
      assert.equal(prepared.pid, child.pid); assert.ok(fs.existsSync(prepared.source));
      child.kill('SIGKILL'); await exited;
      assert.deepEqual(fs.readFileSync(a.file), before, 'unacknowledged candidate never became authority');
      if (kind === 'workspace') {
        const registry = createProfileRegistry(a.root), store = registry.storeFor(registry.load().selectedProfileId);
        assert.equal(store.readJson('workspace.json').revision, 1);
        store.writeJson('workspace.json', { revision: 3 }); assert.equal(store.readJson('workspace.json').revision, 3);
      } else {
        const journal = openJournal(a.root);
        try { assert.equal(journal.read().revision, 1); journal.write({ goals: [] }); assert.equal(journal.read().revision, 2); }
        finally { journal.close(); }
      }
      assert.ok(fs.existsSync(prepared.source), 'orphan retained after distinct explicit new write');
      console.log(JSON.stringify({ kind, root: a.root, crashBeforeRename: true, orphanRetained: true }));
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exited; }
  });
}

test('workspace: process exit after rename retains committed authority before acknowledgement', { timeout: 15000 }, async () => {
  const { spawn } = await import('node:child_process');
  const a = adapter('workspace'), registryModule = require.resolve('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/profile-registry');
  const script = `const fs=require('fs');const {createProfileRegistry}=require(${JSON.stringify(registryModule)});const rename=fs.renameSync;fs.renameSync=(source,destination)=>{const result=rename(source,destination);if(destination===${JSON.stringify(a.file)})process.exit(77);return result};const r=createProfileRegistry(${JSON.stringify(a.root)});r.storeFor(r.load().selectedProfileId).writeJson('workspace.json',{revision:2});`;
  const child = spawn(process.execPath, ['-e', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = ''; child.stderr.on('data', b => errors += b);
  assert.equal(await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); }), 77, errors);
  const registry = createProfileRegistry(a.root), store = registry.storeFor(registry.load().selectedProfileId);
  const leaseBytes = fs.readFileSync(a.lease);
  assert.equal(store.readJson('workspace.json').revision, 2, 'rename committed despite missing caller acknowledgement');
  assert.equal(JSON.parse(leaseBytes).pid, child.pid);
  store.writeJson('workspace.json', { revision: 3 }); assert.equal(store.readJson('workspace.json').revision, 3);
  assert.equal(fs.existsSync(a.lease), false);
  console.log(JSON.stringify({ boundary: 'after-rename', root: a.root, restart: 'committed bytes read, valid dead lease recovered, distinct explicit write succeeds' }));
});

for (const bytes of ['', '{broken', JSON.stringify({ pid: 2147483647 })]) {
  test('existing malformed per-write lease refuses without changing evidence: ' + JSON.stringify(bytes), () => {
    const a = adapter('workspace'), before = fs.readFileSync(a.file); fs.writeFileSync(a.lease, bytes);
    for (let restart = 0; restart < 2; restart++) {
      const r = createProfileRegistry(a.root), store = r.storeFor(r.load().selectedProfileId);
      assert.throws(() => store.writeJson('workspace.json', { revision: 3 }), /unreadable|valid owner/);
      assert.equal(fs.readFileSync(a.lease, 'utf8'), bytes); assert.deepEqual(fs.readFileSync(a.file), before);
    }
  });
}

for (const boundary of ['private-empty', 'private-fsynced', 'published', 'guard-private-empty', 'guard-private-fsynced', 'recovery-published', 'guard-archived', 'stale-archived', 'stale-republished']) {
  test(`workspace complete-owner publication: real exit at ${boundary}`, { timeout: 15000 }, async () => {
    const { spawn } = await import('node:child_process');
    const a = adapter('workspace'), before = fs.readFileSync(a.file), module = require.resolve('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/profile-registry');
    if (boundary.startsWith('recovery') || boundary.startsWith('stale-') || boundary.startsWith('guard-')) fs.writeFileSync(a.lease, JSON.stringify({ pid: 2147483647, lease: 'ef97b0da-64c1-4f98-aa71-d282f5b8a111' }));
    if (boundary === 'guard-archived') fs.writeFileSync(a.lease + '.recovery', JSON.stringify({ pid: 2147483647, lease: 'ef97b0da-64c1-4f98-aa71-d282f5b8a111' }));
    const script = `const fs=require('fs');const {createProfileRegistry}=require(${JSON.stringify(module)});const open=fs.openSync,link=fs.linkSync,rename=fs.renameSync;const b=${JSON.stringify(boundary)},lock=${JSON.stringify(a.lease)};fs.openSync=(file,...args)=>{const fd=open(file,...args);if(typeof file==='string'&&((b==='private-empty'&&file.startsWith(lock+'.owner-'))||(b==='guard-private-empty'&&file.startsWith(lock+'.recovery.owner-'))))process.exit(77);return fd};fs.linkSync=(source,destination)=>{if((b==='private-fsynced'&&destination===lock)||(b==='guard-private-fsynced'&&destination===lock+'.recovery'))process.exit(77);const result=link(source,destination);if(((b==='published'||b==='stale-republished')&&destination===lock)||(b==='recovery-published'&&destination===lock+'.recovery'))process.exit(77);return result};fs.renameSync=(source,destination)=>{const result=rename(source,destination);if((b==='stale-archived'&&source===lock)||(b==='guard-archived'&&source===lock+'.recovery'))process.exit(77);return result};const r=createProfileRegistry(${JSON.stringify(a.root)});r.storeFor(r.load().selectedProfileId).writeJson('workspace.json',{revision:2});`;
    const child = spawn(process.execPath, ['-e', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = ''; child.stderr.on('data', b => errors += b);
    assert.equal(await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); }), 77, errors);
    assert.deepEqual(fs.readFileSync(a.file), before);
    if (boundary === 'private-empty' || boundary === 'private-fsynced') assert.equal(fs.existsSync(a.lease), false, 'incomplete private owner is never authoritative');
    if (boundary === 'published') assert.equal(JSON.parse(fs.readFileSync(a.lease)).pid, child.pid);
    if (boundary === 'recovery-published' || boundary === 'stale-archived') assert.equal(JSON.parse(fs.readFileSync(a.lease + '.recovery')).pid, child.pid);
    const r = createProfileRegistry(a.root), store = r.storeFor(r.load().selectedProfileId);
    assert.equal(store.readJson('workspace.json').revision, 1);
    store.writeJson('workspace.json', { revision: 3 }); assert.equal(store.readJson('workspace.json').revision, 3);
    assert.equal(fs.existsSync(a.lease), false);
    console.log(JSON.stringify({ boundary, root: a.root, restartWrites: 'usable', priorAuthorityRetained: true }));
  });
}

test('unsupported hardlink fails without publishing empty owner or changing target', () => {
  const a = adapter('workspace'), before = fs.readFileSync(a.file), link = fs.linkSync;
  fs.linkSync = () => { throw injected('ENOTSUP'); };
  try { assert.throws(a.write, { code: 'ENOTSUP' }); assert.equal(fs.existsSync(a.lease), false); assert.deepEqual(fs.readFileSync(a.file), before); }
  finally { fs.linkSync = link; }
});

test('independent contenders recover a dead guard without replacing a live owner', { timeout: 20000 }, async () => {
  const { spawn } = await import('node:child_process');
  const a = adapter('workspace'), before = fs.readFileSync(a.file), module = require.resolve('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/profile-registry');
  const dead = JSON.stringify({ pid: 2147483647, lease: 'ef97b0da-64c1-4f98-aa71-d282f5b8a111' });
  fs.writeFileSync(a.lease, dead); fs.writeFileSync(a.lease + '.recovery', dead);
  const gate = path.join(a.root, 'go'), resumeRecovery = path.join(a.root, 'resume-recovery'), resumeWrite = path.join(a.root, 'resume-write');
  const children = [];
  const waitFor = async condition => { const until = Date.now() + 10000; while (!condition()) { assert.ok(Date.now() < until, 'contender fixture timed out'); await new Promise(r => setTimeout(r, 10)); } };
  try {
    for (let index = 0; index < 2; index++) {
      const script = `const fs=require('fs'),path=require('path');const {createProfileRegistry}=require(${JSON.stringify(module)});const root=${JSON.stringify(a.root)},lock=${JSON.stringify(a.lease)},file=${JSON.stringify(a.file)};const wait=p=>{while(!fs.existsSync(p))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5)};fs.writeFileSync(path.join(root,'ready-'+process.pid),'ready');wait(${JSON.stringify(gate)});const rename=fs.renameSync;fs.renameSync=(source,destination)=>{if(source===lock+'.recovery'){fs.writeFileSync(path.join(root,'recovering-'+process.pid),'held');wait(${JSON.stringify(resumeRecovery)})}if(destination===file){fs.writeFileSync(path.join(root,'writing-'+process.pid),'held');wait(${JSON.stringify(resumeWrite)})}return rename(source,destination)};let result;try{const r=createProfileRegistry(root);r.storeFor(r.load().selectedProfileId).writeJson('workspace.json',{revision:2,writer:process.pid});result={status:'wrote',pid:process.pid}}catch(error){result={status:'refused',pid:process.pid,error:error.message}}fs.writeFileSync(path.join(root,'result-'+process.pid),JSON.stringify(result));`;
      const child = spawn(process.execPath, ['-e', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const record = { child, errors: '', exited: new Promise(resolve => child.once('exit', resolve)) }; child.stderr.on('data', b => record.errors += b); children.push(record);
    }
    await waitFor(() => children.every(({ child }) => fs.existsSync(path.join(a.root, 'ready-' + child.pid)))); fs.writeFileSync(gate, 'go');
    await waitFor(() => fs.readdirSync(a.root).some(name => name.startsWith('recovering-')) && children.some(({ child }) => fs.existsSync(path.join(a.root, 'result-' + child.pid))));
    const held = fs.readdirSync(a.root).filter(name => name.startsWith('recovering-')); assert.equal(held.length, 1);
    const winner = Number(held[0].slice('recovering-'.length));
    assert.equal(JSON.parse(fs.readFileSync(a.lease + '.recovery.recovery')).pid, winner);
    assert.equal(fs.readFileSync(a.lease + '.recovery', 'utf8'), dead);
    assert.throws(a.write, /another writer/);
    assert.equal(JSON.parse(fs.readFileSync(a.lease + '.recovery.recovery')).pid, winner, 'contender cannot archive live guard');
    fs.writeFileSync(resumeRecovery, 'go'); await waitFor(() => fs.existsSync(path.join(a.root, 'writing-' + winner)));
    assert.equal(JSON.parse(fs.readFileSync(a.lease)).pid, winner); assert.throws(a.write, /another writer/);
    assert.equal(JSON.parse(fs.readFileSync(a.lease)).pid, winner, 'contender cannot replace active writer');
    assert.deepEqual(fs.readFileSync(a.file), before);
    fs.writeFileSync(resumeWrite, 'go');
    for (const record of children) assert.equal(await record.exited, 0, record.errors);
    const results = children.map(({ child }) => JSON.parse(fs.readFileSync(path.join(a.root, 'result-' + child.pid))));
    assert.equal(results.filter(r => r.status === 'wrote').length, 1); assert.equal(results.filter(r => r.status === 'refused').length, 1);
    assert.equal(JSON.parse(fs.readFileSync(a.file)).writer, winner);
    for (const name of fs.readdirSync(path.dirname(a.lease)).filter(name => name.includes('.abandoned-'))) assert.notEqual(JSON.parse(fs.readFileSync(path.join(path.dirname(a.lease), name))).pid, winner);
    console.log(JSON.stringify({ root: a.root, results, exactlyOneWriter: true, stopped: true }));
  } finally {
    fs.writeFileSync(resumeRecovery, 'go'); fs.writeFileSync(resumeWrite, 'go'); fs.writeFileSync(gate, 'go');
    for (const record of children) { if (record.child.exitCode === null && record.child.signalCode === null) record.child.kill('SIGKILL'); await record.exited; }
  }
});

test('malformed recovery guard and depth limit retain entire authority chain', () => {
  const dead = JSON.stringify({ pid: 2147483647, lease: 'ef97b0da-64c1-4f98-aa71-d282f5b8a111' });
  for (const mode of ['malformed', 'depth']) {
    const a = adapter('workspace'), before = fs.readFileSync(a.file), chain = [];
    for (let level = 0; level <= (mode === 'depth' ? 8 : 1); level++) {
      const file = a.lease + '.recovery'.repeat(level), bytes = mode === 'malformed' && level === 1 ? '' : dead;
      fs.writeFileSync(file, bytes); chain.push({ file, bytes });
    }
    assert.throws(a.write, mode === 'depth' ? /depth exceeded; inspect/ : /unreadable; inspect/);
    assert.deepEqual(fs.readFileSync(a.file), before); for (const { file, bytes } of chain) assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    console.log(JSON.stringify({ mode, root: a.root, recovery: 'explicit inspection required, all authority retained' }));
  }
});

test('guard unlink refusal does not strand newly acquired writer', { skip: process.platform !== 'win32', timeout: 20000 }, async () => {
  const { spawn } = await import('node:child_process');
  const a = adapter('workspace'), before = fs.readFileSync(a.file), guard = a.lease + '.recovery';
  fs.writeFileSync(a.lease, JSON.stringify({ pid: 2147483647, lease: 'ef97b0da-64c1-4f98-aa71-d282f5b8a111' }));
  const ready = path.join(a.root, 'reader-ready'), stop = path.join(a.root, 'reader-stop');
  const script = "$until = [DateTime]::UtcNow.AddSeconds(10); while (-not [System.IO.File]::Exists($env:BD_GUARD)) { if ([DateTime]::UtcNow -gt $until) { throw 'Guard did not appear' }; Start-Sleep -Milliseconds 2 }; $stream = [System.IO.File]::Open($env:BD_GUARD, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite); try { [System.IO.File]::WriteAllText($env:BD_READY, 'ready'); while (-not [System.IO.File]::Exists($env:BD_STOP)) { if ([DateTime]::UtcNow -gt $until) { throw 'Reader release timed out' }; Start-Sleep -Milliseconds 2 } } finally { $stream.Dispose() }";
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BD_GUARD: guard, BD_READY: ready, BD_STOP: stop } });
  let errors = ''; child.stderr.on('data', b => errors += b); const exited = new Promise(resolve => child.once('exit', resolve));
  const open = fs.openSync, link = fs.linkSync; const descriptors = new Map(); let writerFd;
  fs.openSync = (file, ...args) => { const fd = open(file, ...args); if (typeof file === 'string' && file.startsWith(a.lease + '.owner-')) descriptors.set(file, fd); return fd; };
  fs.linkSync = (source, destination) => {
    const result = link(source, destination);
    if (destination === a.lease) {
      writerFd = descriptors.get(source); const until = Date.now() + 10000;
      while (!fs.existsSync(ready)) { assert.ok(Date.now() < until, 'Reader not ready: ' + errors); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); }
    }
    return result;
  };
  let failure;
  try {
    try { a.write(); } catch (error) { failure = error; }
    assert.ok(['EPERM', 'EBUSY'].includes(failure?.code)); assert.deepEqual(fs.readFileSync(a.file), before);
    let descriptorOpen; try { fs.fstatSync(writerFd); descriptorOpen = true; } catch { descriptorOpen = false; }
    const proof = { root: a.root, error: failure.message, writerLeaseLeft: fs.existsSync(a.lease), writerDescriptorOpen: descriptorOpen };
    fs.writeFileSync(path.join(a.root, 'guard-release-proof.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
    assert.equal(descriptorOpen, false, 'new writer descriptor must close when acquisition cannot return it');
    assert.equal(fs.existsSync(a.lease), false, 'failed acquisition must not orphan new live-PID writer');
  } finally { fs.openSync = open; fs.linkSync = link; fs.writeFileSync(stop, 'stop'); assert.equal(await exited, 0, errors); }
  const alias = createProfileRegistry(a.root.toUpperCase()); alias.storeFor(alias.load().selectedProfileId).writeJson('workspace.json', { revision: 2 });
  assert.equal(a.read().revision, 2, 'same process can write through a Windows case alias after known reader releases');
  assert.equal(fs.existsSync(guard), false, 'retained cleanup handle releases its exact guard on next call');
});

for (const mode of ['primary-error', 'root-cleanup-error', 'foreign-root', 'foreign-guard', 'normal-release']) {
  test(`complete owner cleanup preserves ${mode} diagnostics and ownership`, () => {
    const a = adapter('workspace'), before = fs.readFileSync(a.file), guard = a.lease + '.recovery';
    if (mode !== 'normal-release') fs.writeFileSync(a.lease, JSON.stringify({ pid: 2147483647, lease: 'ef97b0da-64c1-4f98-aa71-d282f5b8a111' }));
    const unlink = fs.unlinkSync, rename = fs.renameSync, open = fs.openSync, link = fs.linkSync;
    const descriptors = new Map(); let writerFd, guardRefused = false, rootRefused = false, failure;
    const primary = injected('EIO'), guardError = injected('EBUSY'), rootError = injected('EACCES');
    const foreign = JSON.stringify({ pid: process.pid, lease: '8e1d9852-bc2e-4a3d-926d-3c33b7251438' });
    fs.openSync = (file, ...args) => { const fd = open(file, ...args); if (typeof file === 'string' && file.startsWith(a.lease + '.owner-')) descriptors.set(file, fd); return fd; };
    fs.linkSync = (source, destination) => { const result = link(source, destination); if (destination === a.lease) writerFd = descriptors.get(source); return result; };
    fs.renameSync = (source, destination) => { if (mode === 'primary-error' && source === a.lease) throw primary; return rename(source, destination); };
    fs.unlinkSync = file => {
      if (file === guard && !guardRefused) {
        guardRefused = true;
        if (mode === 'foreign-root') fs.writeFileSync(a.lease, foreign);
        if (mode === 'foreign-guard') fs.writeFileSync(guard, foreign);
        throw guardError;
      }
      if (file === a.lease && !rootRefused && (mode === 'root-cleanup-error' || mode === 'normal-release')) { rootRefused = true; throw rootError; }
      return unlink(file);
    };
    try { try { a.write(); } catch (error) { failure = error; } }
    finally { fs.unlinkSync = unlink; fs.renameSync = rename; fs.openSync = open; fs.linkSync = link; }
    assert.ok(failure);
    if (writerFd !== undefined) assert.throws(() => fs.fstatSync(writerFd), { code: 'EBADF' }, 'rejected acquisition/release closes its descriptor');
    if (mode === 'primary-error') { assert.equal(failure, primary); assert.equal(failure.cleanupErrors[0], guardError); }
    if (mode === 'root-cleanup-error') { assert.equal(failure, guardError); assert.equal(failure.cleanupErrors[0], rootError); }
    if (mode === 'foreign-root') { assert.equal(failure, guardError); assert.match(failure.cleanupErrors[0].message, /another owner/); assert.equal(fs.readFileSync(a.lease, 'utf8'), foreign); }
    if (mode !== 'normal-release') assert.deepEqual(fs.readFileSync(a.file), before);
    else { assert.equal(failure, rootError); assert.equal(a.read().revision, 2, 'rename committed but caller saw cleanup failure'); }
    if (mode.startsWith('foreign')) {
      assert.throws(a.write, /another owner/);
      assert.equal(fs.readFileSync(mode === 'foreign-root' ? a.lease : guard, 'utf8'), foreign, 'cleanup never deletes another owner');
    } else {
      a.write(); assert.equal(a.read().revision, 2); assert.equal(fs.existsSync(a.lease), false); assert.equal(fs.existsSync(guard), false);
    }
  });
}
