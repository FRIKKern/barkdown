// The import's own rules: a verified export only, the same Barkpark version, a new profile,
// navigation re-owned, retained originals copied verbatim, and a journal that names its phase.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileImport } = require('../main/profile-import');
const { createProfileRegistry } = require('../main/profile-registry');
const { createPaperEvidenceOwner } = require('../main/paper-evidence-owner');
const { createStore } = require('../main/store');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const OLD_OWNER = 'a'.repeat(64), OLD_PROFILE = '11111111-1111-4111-8111-111111111111';
function exported(root, { upstream = 'pin' } = {}) {
  const dir = path.join(root, 'export'); fs.mkdirSync(path.join(dir, 'profile', 'documents'), { recursive: true }); fs.mkdirSync(path.join(dir, 'profile', 'selection'), { recursive: true }); fs.mkdirSync(path.join(dir, 'media', 'files'), { recursive: true });
  const files = {
    'database.dump': 'dump-bytes', 'media/files/a.png': 'png-bytes',
    'profile/workspace.json': JSON.stringify({ version: 1, profileId: OLD_PROFILE, pages: { roots: [`bp:v1:${OLD_OWNER}:note-1`] }, favorites: [{ id: 'f', target: { kind: 'doc', id: 'note-1', source: 'barkpark', paperOwner: OLD_OWNER } }] }),
    'profile/selection.json': JSON.stringify({ version: 1, phase: 'selected', profileId: OLD_PROFILE }),
    'profile/selection/workspace-legacy.json': JSON.stringify({ version: 1, bytes: `{"profileId":"${OLD_PROFILE}"}` }),
    'profile/documents/note.json': JSON.stringify({ id: 'note', owner: OLD_PROFILE }),
    'profile/settings.json': JSON.stringify({ theme: 'dark', barkpark: { enabled: true, local: { enabled: true } } }),
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  const entry = name => ({ path: name, bytes: Buffer.byteLength(files[name]), sha256: sha(files[name]) });
  const manifest = { version: 1, kind: 'barkdown-profile-export', exportedAt: '2026-09-29T00:00:00.000Z', profile: { id: OLD_PROFILE, name: 'Writing desk' }, upstream, navigation: { owner: OLD_OWNER }, counts: { papers: 3 },
    database: { ...entry('database.dump'), format: 'pg_dump custom' }, media: [entry('media/files/a.png')], store: Object.keys(files).filter(n => n.startsWith('profile/')).sort().map(entry), excluded: [] };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}
function fixture(options) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-import-')));
  const registry = createProfileRegistry(path.join(root, 'profile-data')), restores = [];
  const connection = { enabled: true, server: 'http://127.0.0.1:4999', token: 'new-token', dataset: 'production', viaCli: false };
  const runtimePool = { restore: async (profileId, input) => { restores.push({ profileId, ...input }); if (options?.restoreFails) throw new Error('pg_restore failed'); return { profileId, storeDir: registry.storeFor(profileId).storeDir, counts: { papers: 3 }, connection }; } };
  const importer = createProfileImport({ registry, runtimePool, source: '/built/barkpark', upstreamRef: () => 'pin', now: () => '2026-09-30T00:00:00.000Z' });
  return { root, registry, restores, connection, importer, runtimePool, dir: exported(root, options) };
}
test('import creates a new profile, restores first, re-owns navigation and keeps retained originals verbatim', async () => {
  const f = fixture();
  const result = await f.importer.importProfile(f.dir);
  const profile = f.registry.load().profiles.find(p => p.id === result.profileId);
  assert.equal(profile.name, 'Writing desk (imported)'); assert.notEqual(result.profileId, OLD_PROFILE);
  assert.deepEqual(f.restores, [{ profileId: result.profileId, source: '/built/barkpark', dumpFile: path.join(f.dir, 'database.dump'), mediaDir: path.join(f.dir, 'media') }]);
  const store = createStore(result.storeDir, { create: false }), owner = createPaperEvidenceOwner(store).identify(f.connection);
  assert.match(owner, /^[a-f0-9]{64}$/); assert.notEqual(owner, OLD_OWNER);
  const workspace = store.readJson('workspace.json', null);
  assert.equal(workspace.profileId, result.profileId); assert.deepEqual(workspace.pages.roots, [`bp:v1:${owner}:note-1`]); assert.equal(workspace.favorites[0].target.paperOwner, owner);
  assert.equal(store.readJson('selection.json', null).profileId, result.profileId);
  assert.equal(fs.readFileSync(path.join(result.storeDir, 'selection/workspace-legacy.json'), 'utf8'), fs.readFileSync(path.join(f.dir, 'profile/selection/workspace-legacy.json'), 'utf8'), 'rollback evidence is copied verbatim');
  assert.equal(fs.readFileSync(path.join(result.storeDir, 'documents/note.json'), 'utf8'), fs.readFileSync(path.join(f.dir, 'profile/documents/note.json'), 'utf8'), 'retained originals are copied verbatim');
  assert.deepEqual(store.readJson('settings.json', null).barkpark, { enabled: true, local: { enabled: true, source: '/built/barkpark' }, viaCli: false, server: '' });
  assert.equal(result.record.phase, 'imported'); assert.deepEqual(result.record.navigation, { from: OLD_OWNER, to: owner });
  const inspected = f.importer.inspect(result.profileId);
  assert.equal(path.basename(inspected.exportDir), 'export', 'the journal names the export folder it came from');
  assert.deepEqual(inspected.mediaOrigins, [], 'an export without a recorded runtime carries no media origin');
  delete inspected.mediaOrigins;
  assert.deepEqual({ ...inspected, exportDir: null }, { status: 'imported', exportedProfile: { id: OLD_PROFILE, name: 'Writing desk' }, exportedAt: '2026-09-29T00:00:00.000Z', exportDir: null });
  assert.equal(fs.readFileSync(path.join(f.dir, 'profile/workspace.json'), 'utf8').includes(OLD_OWNER), true, 'the export folder is untouched');
});
test('a tampered export, another Barkpark version and a failed restore are refused; the journal names the phase', async () => {
  const f = fixture(); fs.appendFileSync(path.join(f.dir, 'database.dump'), 'x');
  await assert.rejects(f.importer.importProfile(f.dir), { code: 'export_changed' }); assert.equal(f.registry.load(), null, 'no profile is created for a refused export');
  const g = fixture({ upstream: 'older' });
  await assert.rejects(g.importer.importProfile(g.dir), { code: 'import_upstream' }); assert.equal(g.restores.length, 0);
  const h = fixture({ restoreFails: true });
  await assert.rejects(h.importer.importProfile(h.dir), /pg_restore failed/);
  const stranded = h.registry.load().profiles[0];
  assert.deepEqual(h.importer.inspect(stranded.id).status, 'restoring');
  const untouched = fs.readFileSync(path.join(h.registry.storeFor(stranded.id).storeDir, 'workspace.json'), 'utf8');
  assert.ok(!untouched.includes(OLD_OWNER) && !untouched.includes('note-1'), 'no profile file is copied before the restore succeeds');
});
test('an export of an earlier version that this runtime descends from is imported; a later or unrelated one is refused before anything is created', async () => {
  const older = 'a'.repeat(40), newer = 'b'.repeat(40), stranger = 'c'.repeat(40);
  const make = exported => { const f = fixture({ upstream: exported }); const registry = f.registry;
    const importer = createProfileImport({ registry, runtimePool: f.runtimePool, source: '/built/barkpark', upstreamRef: () => newer, precedes: (earlier, later) => earlier === older && later === newer });
    return { f, importer }; };
  const accepted = make(older);
  const result = await accepted.importer.importProfile(accepted.f.dir);
  assert.equal(result.record.phase, 'imported'); assert.equal(result.record.importedAtUpstream, newer); assert.equal(result.record.upstream, older);
  for (const exported of [stranger, 'not-a-commit']) {
    const refused = make(exported);
    await assert.rejects(refused.importer.importProfile(refused.f.dir), { code: 'import_upstream', message: /same version or an earlier one/ });
    assert.equal(refused.f.registry.load(), null, 'no registry, no profile: nothing was created');
  }
});

for (const unsafePath of ['profile/..\\..\\escaped.txt', 'abcdefgh../escaped.txt']) {
  test(`manifest path ${JSON.stringify(unsafePath)} refuses before creating a profile or restoring`, async () => {
    const f = fixture(), file = path.join(f.dir, unsafePath), bytes = 'disposable escape probe';
    assert.ok(file.startsWith(f.root + path.sep), 'the reproduction stays in its own temporary fixture');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
    const manifestFile = path.join(f.dir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.store.push({ path: unsafePath, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) });
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    await assert.rejects(f.importer.importProfile(f.dir), { code: 'export_path' });
    assert.equal(f.registry.load(), null, 'refusal happens before any destination profile exists');
    assert.equal(f.restores.length, 0, 'no database restore begins');
    assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'the supplied source remains untouched');
  });
}

test('noncanonical, misclassified, duplicate and machine-bound manifest entries refuse before restore', async () => {
  const cases = [
    ...['/absolute', 'C:/drive/file', 'C:relative', '\\\\server\\share', 'profile/../outside',
      'profile/./workspace.json', 'profile//workspace.json', 'profile/documents/a.json:stream',
      'profile/documents/.. /outside', 'profile/documents/name.', 'profile/documents/NUL.txt',
      'profile/documents/a\u0000b', 'profile/documents/*.txt', 'profile/runtime.json',
      'profile/local-credentials.json', 'profile/agent-edits/paper-owner-key.json',
      'profile/agent-edits/PAPER-OWNER-KEY.json', 'media/files/a.png'].map(name => ({ name, mutate: m => { m.store[0].path = name; } })),
    { name: 'wrong database section', mutate: m => { m.database.path = 'profile/workspace.json'; } },
    { name: 'wrong media section', mutate: m => { m.media[0].path = 'profile/workspace.json'; } },
    { name: 'duplicate store path', mutate: m => { m.store.push({ ...m.store[0] }); } },
    { name: 'null entry', mutate: m => { m.store.push(null); } },
    ...(process.platform === 'win32' ? [{ name: 'Windows case alias', mutate: m => { m.media.push({ ...m.media[0], path: 'media/files/A.png' }); } }] : []),
  ];
  for (const { name, mutate } of cases) {
    const f = fixture(), file = path.join(f.dir, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    mutate(manifest); fs.writeFileSync(file, JSON.stringify(manifest));
    const before = fs.readFileSync(file);
    await assert.rejects(f.importer.importProfile(f.dir), { code: 'export_path' }, name);
    assert.equal(f.registry.load(), null, name + ': no profile');
    assert.equal(f.restores.length, 0, name + ': no restore');
    assert.deepEqual(fs.readFileSync(file), before, name + ': source unchanged');
  }
});

test('canonical nested attachment names preserve Unicode and exact original bytes', async () => {
  const f = fixture(), relative = 'attachments/field notes/été.txt', name = 'profile/' + relative, bytes = 'Original café field notes.\n';
  fs.mkdirSync(path.dirname(path.join(f.dir, name)), { recursive: true }); fs.writeFileSync(path.join(f.dir, name), bytes);
  const file = path.join(f.dir, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.store.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) }); fs.writeFileSync(file, JSON.stringify(manifest));
  const result = await f.importer.importProfile(f.dir);
  assert.equal(fs.readFileSync(path.join(result.storeDir, relative), 'utf8'), bytes);
  assert.equal(fs.readFileSync(path.join(f.dir, name), 'utf8'), bytes);
});

function updateExport(f, changes, mutate = () => {}) {
  const manifestFile = path.join(f.dir, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const [name, value] of Object.entries(changes)) {
    const text = JSON.stringify(value), file = path.join(f.dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
    manifest.store = manifest.store.filter(e => e.path !== name);
    manifest.store.push({ path: name, bytes: Buffer.byteLength(text), sha256: sha(text) });
  }
  mutate(manifest); fs.writeFileSync(manifestFile, JSON.stringify(manifest));
}

test('import re-owns only structural identity, preserves human content and rekeys discoverable edit receipts', async () => {
  const f = fixture(), marker = `Keep ${OLD_PROFILE} and ${OLD_OWNER} verbatim`, other = 'b'.repeat(64);
  const pageKey = `bp:v1:${OLD_OWNER}:note-1`, remoteFile = owner => 'profile/agent-edits/remote-' + sha(JSON.stringify(['bp:note-1', owner])) + '.json';
  const workspace = { version: 1, profileId: OLD_PROFILE, chats: { chat: { id: 'chat', title: marker, folder: marker, draft: marker,
    messages: [{ role: 'assistant', text: marker, tools: [{ output: { profileId: OLD_PROFILE, paperOwner: OLD_OWNER, text: marker } }] }],
    tabs: [{ type: 'doc', source: 'barkpark', paperOwner: OLD_OWNER, path: ['note-1'], title: marker }, { type: 'doc', source: 'barkpark', paperOwner: other }],
    closedTargets: [`doc:barkpark:${OLD_OWNER}:note-1`, `web::https://example.test/${OLD_OWNER}`] } }, order: ['chat'],
    pages: { roots: [pageKey], children: { [pageKey]: [] }, labels: { [pageKey]: marker } },
    favorites: [{ target: { kind: 'doc', source: 'barkpark', paperOwner: OLD_OWNER, title: marker } }], directTab: { type: 'doc', source: 'barkpark', paperOwner: OLD_OWNER } };
  const receipt = { id: 'edit', documentId: 'bp:note-1', paperOwner: OLD_OWNER, beforeRev: 1, afterRev: 2, summary: marker, before: { blocks: [{ id: 'p', type: 'paragraph', content: [{ type: 'text', value: marker }] }] } };
  const snapshot = { _id: 'drafts.note-1', _type: 'paper', _draft: true, _publishedId: 'note-1', _rev: 'rev-1', title: marker, blocks: receipt.before.blocks };
  const key = sha(JSON.stringify([snapshot._id, snapshot._rev]));
  const deletion = { version: 1, key, id: snapshot._id, revision: snapshot._rev, profileId: OLD_PROFILE, paperOwner: OLD_OWNER, snapshot, snapshotHash: sha(JSON.stringify(snapshot)), recoveryRequest: '22222222-2222-4222-8222-222222222222', status: 'deleted', at: '2026-10-07T00:00:00Z' };
  updateExport(f, { 'profile/workspace.json': workspace, [remoteFile(OLD_OWNER)]: receipt, [`profile/paper-deletions/${key}.json`]: deletion,
    'profile/paper-proposals.json': { note: [{ paperOwner: OLD_OWNER, text: marker, payload: { paperOwner: OLD_OWNER } }] } });
  const sourceBytes = fs.readFileSync(path.join(f.dir, 'profile/workspace.json'));
  const result = await f.importer.importProfile(f.dir), store = createStore(result.storeDir, { create: false });
  const owner = createPaperEvidenceOwner(store).identify(f.connection), after = store.readJson('workspace.json');
  assert.equal(after.profileId, result.profileId);
  for (const field of ['draft', 'title', 'folder', 'messages']) assert.deepEqual(after.chats.chat[field], workspace.chats.chat[field], field);
  assert.equal(after.chats.chat.tabs[0].paperOwner, owner); assert.equal(after.chats.chat.tabs[0].title, marker); assert.equal(after.chats.chat.tabs[1].paperOwner, other);
  assert.equal(after.directTab.paperOwner, owner); assert.equal(after.favorites[0].target.paperOwner, owner);
  assert.deepEqual(after.pages, { roots: [`bp:v1:${owner}:note-1`], children: { [`bp:v1:${owner}:note-1`]: [] }, labels: { [`bp:v1:${owner}:note-1`]: marker } });
  assert.deepEqual(after.chats.chat.closedTargets, [`doc:barkpark:${owner}:note-1`, workspace.chats.chat.closedTargets[1]]);
  const { createAgentEdits } = require('../main/agent-edits');
  const latest = createAgentEdits({ store, documents: {} }).latest('bp:note-1', f.connection);
  assert.deepEqual(latest, { ...receipt, paperOwner: owner });
  const { createPaperDeletions } = require('../main/paper-deletions');
  const deleted = createPaperDeletions({ store, profileId: result.profileId, paperOwner: owner, config: f.connection, assertOwned: () => {}, request: async () => { throw Error('No network'); } }).list();
  assert.equal(deleted.length, 1); assert.equal(deleted[0].title, marker);
  assert.deepEqual(store.readJson(`paper-deletions/${key}.json`).snapshot, snapshot);
  const proposal = store.readJson('paper-proposals.json').note[0];
  assert.equal(proposal.paperOwner, owner); assert.equal(proposal.text, marker); assert.deepEqual(proposal.payload, { paperOwner: OLD_OWNER });
  assert.deepEqual(fs.readFileSync(path.join(f.dir, 'profile/workspace.json')), sourceBytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, remoteFile(OLD_OWNER)), 'utf8')), receipt);
});

test('invalid identity and unsupported JSON refuse before any destination or restore', async () => {
  for (const change of [m => { m.profile.id = ''; }, m => { delete m.profile.id; }, m => { m.profile.id = 'note'; }, m => { m.navigation.owner = 'short'; }]) {
    const f = fixture(); updateExport(f, {}, change);
    await assert.rejects(f.importer.importProfile(f.dir), { code: 'import_identity' });
    assert.equal(f.registry.load(), null); assert.equal(f.restores.length, 0);
  }
  for (const workspace of [null, [], { version: 99 }, { version: 1, chats: { bad: null } }]) {
    const f = fixture(); updateExport(f, { 'profile/workspace.json': workspace });
    await assert.rejects(f.importer.importProfile(f.dir), { code: 'import_content' });
    assert.equal(f.registry.load(), null); assert.equal(f.restores.length, 0);
  }
});
