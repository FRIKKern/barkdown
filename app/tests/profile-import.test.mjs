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
  return { root, registry, restores, connection, importer, dir: exported(root, options) };
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
  assert.deepEqual(f.importer.inspect(result.profileId), { status: 'imported', exportedProfile: { id: OLD_PROFILE, name: 'Writing desk' }, exportedAt: '2026-09-29T00:00:00.000Z' });
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
