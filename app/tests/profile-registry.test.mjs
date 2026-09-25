import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { writerForStore, controller, controlFiles } = require('../main/writer-admission');
const modulePath = require.resolve('../main/profile-registry');
const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-profile-registry-'));
let checks = 0;
function test(name, run) { run(); checks++; console.log(`PASS ${name}`); }
function fixture(name) {
  const root = path.join(suiteRoot, name), legacy = path.join(root, 'legacy'), registry = path.join(root, 'registry');
  fs.mkdirSync(legacy, { recursive: true });
  const put = (name, value) => { const target = path.join(legacy, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value)); };
  put('settings.json', { theme: 'dark', sidebarWidth: 231, chatWidth: 60, windowBounds: { width: 1200 }, provider: 'codex', apiKeyEncrypted: 'enc:fixture-only', unknownFutureSetting: { retained: true } });
  put('documents/same.json', { id: 'same', title: 'A note', rev: 4, unknownSchema: 99, content: { type: 'doc', content: [{ type: 'futureNode', opaque: true }] } });
  put('documents/same.md', '# A note\n\nOriginal bytes.\r\n');
  put('attachments/image.bin', 'image fixture bytes');
  put('workspace.json', { version: 1, unknownFutureField: 999, order: ['main', 'side'], chats: { main: { id: 'main', messages: [], tabs: [], folder: 'C:/fixture/A', draft: 'unsent', images: [path.join(legacy, 'attachments/image.bin')] }, side: { id: 'side', messages: [], tabs: [], parent: 'main', side: true } }, favorites: [{ id: 'same' }] });
  put('agent-edits/receipt.json', { id: 'same', beforeRev: 3, afterRev: 4 });
  writerForStore(createStore(legacy)).run('test.seed', () => {});
  return { root, legacy, registry, put };
}
function tree(directory) {
  const out = {};
  function walk(at, rel = '') { for (const name of fs.readdirSync(at).sort()) { const p = path.join(at, name), r = rel ? `${rel}/${name}` : name; if (fs.statSync(p).isDirectory()) walk(p, r); else out[r] = fs.readFileSync(p).toString('base64'); } }
  walk(directory); return out;
}

test('adoption preserves all source/backup bytes, unknown fields, drafts, parents and splits appearance', () => {
  const f = fixture('adopt'), before = tree(f.legacy), registry = createProfileRegistry(f.registry);
  const first = registry.adoptLegacy({ legacyDir: f.legacy });
  const second = createProfileRegistry(f.registry).adoptLegacy({ legacyDir: f.legacy });
  assert.deepEqual(first, second); assert.equal(registry.load().profiles.length, 1);
  assert.deepEqual(tree(f.legacy), before);
  const journal = JSON.parse(fs.readFileSync(path.join(f.registry, 'adoption.json')));
  const backup = tree(path.join(f.registry, 'adoption-backups', journal.backupId)); delete backup['manifest.json'];
  assert.deepEqual(backup, before);
  const store = registry.storeFor(first.id);
  const targetWriter = writerForStore(createStore(store.storeDir, { create: false }));
  assert.notEqual(targetWriter.token.owner, controller(createStore(f.legacy)).capture().owner);
  for (const file of controlFiles) assert.equal(fs.existsSync(path.join(store.storeDir, file)), false, 'original authority belongs only in the backup');
  targetWriter.run('test.adopted', () => {});
  assert.deepEqual(store.readJson('workspace.json'), JSON.parse(fs.readFileSync(path.join(f.legacy, 'workspace.json'))));
  assert.equal(store.readJson('documents/same.json').unknownSchema, 99);
  assert.equal(store.readJson('settings.json').theme, undefined);
  assert.deepEqual(store.readJson('settings.json').unknownFutureSetting, { retained: true });
  assert.equal(registry.load().appSettings.theme, 'dark');
  store.writeJson('documents/same.json', { id: 'same', rev: 5 });
  registry.adoptLegacy({ legacyDir: f.legacy });
  assert.equal(store.readJson('documents/same.json').rev, 5, 'repeat must not overwrite edits');
});

test('pending, uncertain and quiescing legacy writer records refuse adoption without changing originals', () => {
  for (const status of ['active', 'uncertain', 'quiescing']) {
    const f = fixture('writer-' + status), control = controller(createStore(f.legacy));
    if (status === 'quiescing') control.quiesce(control.capture());
    else {
      const file = path.join(f.legacy, 'writer-state.json'), value = JSON.parse(fs.readFileSync(file));
      value.pending.push({ id: randomUUID(), generation: value.generation, pid: process.pid, operation: 'test.interrupted', status });
      fs.writeFileSync(file, JSON.stringify(value));
    }
    const before = tree(f.legacy), registry = createProfileRegistry(f.registry);
    assert.throws(() => registry.adoptLegacy({ legacyDir: f.legacy }), /reconciliation before adoption/);
    assert.deepEqual(tree(f.legacy), before); assert.equal(registry.load(), null);
  }
});

test('same-slug stores, credentials, receipts and selected restart remain isolated; captured handle stays in A', () => {
  const f = fixture('isolation'), registry = createProfileRegistry(f.registry);
  const a = registry.adoptLegacy({ legacyDir: f.legacy }), b = registry.createProfile({ name: 'B' });
  const aStore = registry.storeFor(a.id), bStore = registry.storeFor(b.id);
  assert.equal(bStore.readJson('settings.json'), null);
  for (const file of ['documents/same.json', 'workspace.json', 'paper-proposals.json', 'agent-edits/same.json', 'local-credentials.json', 'media/same.json', 'cache/same.json']) {
    aStore.writeJson(file, { owner: 'A', id: 'same' }); bStore.writeJson(file, { owner: 'B', id: 'same' });
  }
  registry.selectProfile(b.id);
  aStore.writeJson('workspace.json', { owner: 'A', finishedRun: true });
  const restarted = createProfileRegistry(f.registry);
  assert.equal(restarted.load().selectedProfileId, b.id);
  assert.equal(restarted.storeFor(b.id).readJson('workspace.json').owner, 'B');
  assert.equal(restarted.storeFor(a.id).readJson('workspace.json').finishedRun, true);
  assert.throws(() => restarted.storeFor('00000000-0000-4000-8000-000000000000'), /Unknown profile/);
  assert.throws(() => restarted.selectProfile('../escape'), /Invalid profile/);
});

for (const phase of ['adoption-prepared', 'file-copied', 'adoption-backed-up', 'adoption-profile-copied', 'generation-written', 'previous-pointer-written', 'registry-committed']) {
  test(`real process exit at ${phase} resumes without duplicates or source change`, () => {
    const f = fixture(`crash-${phase}`), before = tree(f.legacy);
    const script = `const {createProfileRegistry}=require(${JSON.stringify(modulePath)}); createProfileRegistry(${JSON.stringify(f.registry)}, {checkpoint:p=>{if(p===${JSON.stringify(phase)})process.exit(77)}}).adoptLegacy({legacyDir:${JSON.stringify(f.legacy)}});`;
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    assert.equal(result.status, 77, result.stderr);
    const registry = createProfileRegistry(f.registry);
    const profile = registry.adoptLegacy({ legacyDir: f.legacy });
    assert.equal(registry.load().profiles.length, 1);
    assert.equal(registry.load().selectedProfileId, profile.id);
    assert.deepEqual(tree(f.legacy), before);
    assert.equal(registry.storeFor(profile.id).readJson('settings.json').provider, 'codex');
  });
}

test('changed source refuses resume and never overwrites source or staged backup', () => {
  const f = fixture('changed');
  const registry = createProfileRegistry(f.registry, { checkpoint: p => { if (p === 'adoption-backed-up') throw new Error('interrupted'); } });
  assert.throws(() => registry.adoptLegacy({ legacyDir: f.legacy }), /interrupted/);
  assert.throws(() => createProfileRegistry(f.registry).createProfile({ name: 'must wait' }), /pending adoption/);
  f.put('documents/same.md', '# Changed');
  const changed = tree(f.legacy);
  assert.throws(() => createProfileRegistry(f.registry).adoptLegacy({ legacyDir: f.legacy }), /workspace changed/);
  assert.deepEqual(tree(f.legacy), changed);
});

test('rollback retains original, backup and edited profile; stale handles cannot write removed profile', () => {
  const f = fixture('rollback'), before = tree(f.legacy), registry = createProfileRegistry(f.registry);
  const a = registry.adoptLegacy({ legacyDir: f.legacy }), b = registry.createProfile({ name: 'B' });
  const old = registry.storeFor(a.id); old.writeJson('documents/same.json', { id: 'same', rev: 5 });
  const result = registry.rollbackAdoption();
  assert.deepEqual(tree(f.legacy), before);
  assert.equal(JSON.parse(fs.readFileSync(path.join(result.retainedProfileDir, 'documents/same.json'))).rev, 5);
  assert.ok(fs.existsSync(path.join(result.backupDir, 'documents/same.json')));
  assert.equal(registry.load().selectedProfileId, b.id);
  assert.throws(() => old.writeJson('documents/same.json', {}), /Unknown profile/);
  assert.throws(() => registry.adoptLegacy({ legacyDir: f.legacy }), /rolled back/);
});

test('interrupted rollback reconciles journal on retry without resurrecting the profile', () => {
  const f = fixture('rollback-crash'), registry = createProfileRegistry(f.registry);
  registry.adoptLegacy({ legacyDir: f.legacy });
  const script = `const {createProfileRegistry}=require(${JSON.stringify(modulePath)}); createProfileRegistry(${JSON.stringify(f.registry)}, {checkpoint:p=>{if(p==='registry-committed')process.exit(78)}}).rollbackAdoption();`;
  assert.equal(spawnSync(process.execPath, ['-e', script]).status, 78);
  assert.equal(registry.load().profiles.length, 0);
  registry.rollbackAdoption(); registry.rollbackAdoption();
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.registry, 'adoption.json'))).phase, 'rolled-back');
  assert.equal(registry.load().profiles.length, 0);
});

for (const phase of ['generation-written', 'previous-pointer-written', 'registry-committed']) {
  test(`profile creation retry with request ID after ${phase} exposes exactly one profile`, () => {
    const f = fixture(`create-crash-${phase}`), requestId = randomUUID();
    const script = `const {createProfileRegistry}=require(${JSON.stringify(modulePath)}); createProfileRegistry(${JSON.stringify(f.registry)}, {checkpoint:p=>{if(p===${JSON.stringify(phase)})process.exit(79)}}).createProfile({name:'B',requestId:${JSON.stringify(requestId)}});`;
    assert.equal(spawnSync(process.execPath, ['-e', script]).status, 79);
    const registry = createProfileRegistry(f.registry), profile = registry.createProfile({ name: 'B', requestId });
    assert.equal(registry.load().profiles.length, 1);
    assert.equal(registry.createProfile({ name: 'B', requestId }).id, profile.id);
  });
}

test('corrupt pointer fails closed; explicit previous recovery retains forensic bytes', () => {
  const f = fixture('recover'), registry = createProfileRegistry(f.registry);
  const a = registry.adoptLegacy({ legacyDir: f.legacy });
  registry.createProfile({ name: 'B' });
  fs.writeFileSync(path.join(f.registry, 'registry.json'), '{broken');
  assert.throws(() => registry.load());
  assert.throws(() => registry.createProfile({ name: 'should fail' }));
  assert.equal(registry.recoverPrevious().selectedProfileId, a.id);
  assert.equal(registry.load().profiles.length, 1);
  assert.equal(fs.readFileSync(path.join(f.registry, 'recovery-evidence', fs.readdirSync(path.join(f.registry, 'recovery-evidence'))[0]), 'utf8'), '{broken');
});

test('generation tampering and unknown registry version cannot become an empty seeded workspace', () => {
  const f = fixture('tamper'), registry = createProfileRegistry(f.registry);
  registry.adoptLegacy({ legacyDir: f.legacy });
  const pointer = JSON.parse(fs.readFileSync(path.join(f.registry, 'registry.json')));
  const generation = path.join(f.registry, 'registry-generations', pointer.generation + '.json');
  fs.writeFileSync(generation, '{}');
  assert.throws(() => registry.load(), /checksum/);
  fs.writeFileSync(path.join(f.registry, 'registry.json'), JSON.stringify({ ...pointer, version: 99 }));
  assert.throws(() => registry.load(), /Invalid registry pointer/);
});

test('live owner excludes concurrent adoption', () => {
  const f = fixture('locked'); fs.mkdirSync(f.registry);
  fs.writeFileSync(path.join(f.registry, 'registry.lock'), JSON.stringify({ pid: process.pid }));
  assert.throws(() => createProfileRegistry(f.registry).adoptLegacy({ legacyDir: f.legacy }), /in use/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.registry, 'registry.lock'))).pid, process.pid);
});

test('corrupt or unsupported source JSON is preserved and cannot be published', () => {
  for (const [name, value] of [['workspace.json', { version: 99, chats: {}, order: [] }], ['workspace.json', '{broken'], ['documents/same.json', { id: 'different', rev: 1 }], ['settings.json', []]]) {
    const f = fixture(`invalid-${checks}-${Math.random()}`); f.put(name, value);
    const before = tree(f.legacy), registry = createProfileRegistry(f.registry);
    assert.throws(() => registry.adoptLegacy({ legacyDir: f.legacy }), /legacy/i);
    assert.equal(registry.load(), null); assert.deepEqual(tree(f.legacy), before);
  }
});

test('missing committed first pointer cannot silently create an empty replacement', () => {
  const f = fixture('missing'), registry = createProfileRegistry(f.registry);
  registry.adoptLegacy({ legacyDir: f.legacy });
  fs.renameSync(path.join(f.registry, 'registry.json'), path.join(f.registry, 'retained-pointer.json'));
  assert.throws(() => registry.load(), /pointer missing/);
  assert.throws(() => registry.createProfile({ name: 'must refuse' }), /pointer missing/);
});

test('missing profile directory cannot silently seed a replacement', () => {
  const f = fixture('missing-directory'), registry = createProfileRegistry(f.registry);
  const a = registry.adoptLegacy({ legacyDir: f.legacy }), store = registry.storeFor(a.id);
  fs.renameSync(store.storeDir, store.storeDir + '-retained');
  assert.throws(() => store.readJson('workspace.json'), /directory is missing/);
  assert.throws(() => store.writeJson('workspace.json', {}), /directory is missing/);
  assert.equal(fs.existsSync(store.storeDir), false);
});

test('nested roots and Windows case aliases cannot copy a workspace into itself', () => {
  const f = fixture('nested');
  const nested = path.join(f.legacy, 'profiles-staging');
  assert.throws(() => createProfileRegistry(nested).adoptLegacy({ legacyDir: f.legacy }), /disjoint/);
  if (process.platform === 'win32') {
    assert.throws(() => createProfileRegistry(f.legacy.toUpperCase()).adoptLegacy({ legacyDir: f.legacy }), /disjoint/);
    assert.throws(() => createProfileRegistry(nested.toUpperCase()).adoptLegacy({ legacyDir: f.legacy }), /disjoint/);
  }
});

test('database, unknown entry and pending writes refuse shell adoption', () => {
  for (const [name, message] of [['local-barkpark/default/data', /cold-runtime/], ['unknown-secret.json', /Unclassified/], ['documents/pending.lock', /pending writes/]]) {
    const f = fixture(`refuse-${checks}-${name.replaceAll('/', '-')}`); f.put(name, 'retained');
    const before = tree(f.legacy);
    assert.throws(() => createProfileRegistry(f.registry).adoptLegacy({ legacyDir: f.legacy }), message);
    assert.deepEqual(tree(f.legacy), before);
  }
});

test('storage path traversal and linked source/root/profile directories are refused', () => {
  const f = fixture('paths'), registry = createProfileRegistry(f.registry);
  const a = registry.adoptLegacy({ legacyDir: f.legacy }), store = registry.storeFor(a.id);
  for (const name of ['../escape.json', '/absolute.json', 'C:/escape.json', 'x\\escape.json', 'x//y.json', './x']) assert.throws(() => store.writeJson(name, {}), /Invalid storage path/);
  const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(store.storeDir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => store.writeJson('linked/escape.json', {}), /Symbolic links/);
  const alias = path.join(f.root, 'alias'); fs.symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createProfileRegistry(path.join(alias, 'nested')), /Symbolic links/);
  const source = fixture('source-link');
  fs.symlinkSync(outside, path.join(source.legacy, 'attachments', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createProfileRegistry(source.registry).adoptLegacy({ legacyDir: source.legacy }), /Symbolic links/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

console.log(`${checks} profile-registry checks passed. Disposable evidence retained at ${suiteRoot}`);
