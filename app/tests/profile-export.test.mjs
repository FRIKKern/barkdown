// The profile export's own rules: held while copying, reopened whatever happens, nothing
// overwritten, credentials and machine-bound files left behind, and a verifier that notices.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileExport } = require('../main/profile-export');
function fixture({ dumpFails = false } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-export-'))), profileId = 'p1';
  const storeDir = path.join(root, 'profiles', profileId), mediaDir = path.join(root, 'runtime', 'media');
  fs.mkdirSync(path.join(storeDir, 'documents'), { recursive: true }); fs.mkdirSync(path.join(storeDir, 'agent-edits'), { recursive: true }); fs.mkdirSync(path.join(mediaDir, 'files'), { recursive: true });
  fs.writeFileSync(path.join(storeDir, 'workspace.json'), '{"version":1}');
  fs.writeFileSync(path.join(storeDir, 'documents', 'note.json'), '{"id":"note"}');
  fs.writeFileSync(path.join(storeDir, 'agent-edits', 'paper-owner-key.json'), '{"version":1,"key":"secret"}');
  fs.writeFileSync(path.join(storeDir, 'agent-edits', 'receipt.json'), '{"id":"r"}');
  fs.writeFileSync(path.join(storeDir, 'local-credentials.json'), '{"password":"secret"}');
  fs.writeFileSync(path.join(storeDir, 'settings.json'), JSON.stringify({ theme: 'dark', apiKeyEncrypted: 'enc:x', barkpark: { enabled: true, tokenEncrypted: 'enc:y', local: { enabled: true, source: '/somewhere', port: 1 } } }));
  fs.writeFileSync(path.join(mediaDir, 'files', 'a.png'), 'png-bytes');
  const events = [];
  const admission = {
    hold: async (_t, operation) => { events.push('hold'); return { phase: 'held', capability: 'cap-12345678', generation: 3, boot: 'boot', operation }; },
    awaitHeld: async () => assert.fail('already held'),
    reopen: async () => { events.push('reopen'); return { phase: 'open', generation: 4 }; },
  };
  const runtimePool = { acquire: async (id, options) => { events.push(['lease', options.ownerId, options.writes]); return { connection: { server: 'http://127.0.0.1:1', token: 't', dataset: 'production' },
    data: { mediaDir, dump: async file => { events.push('dump'); if (dumpFails) throw new Error('pg_dump failed'); fs.writeFileSync(file, 'dump-bytes'); return { file, serverVersion: '15.18' }; } }, release: async () => events.push('release') }; } };
  const preparation = { withPrepared: async (id, fn) => { events.push('prepared'); return fn({ sourceDir: storeDir, assertCurrent: async () => true }); } };
  const registry = { load: () => ({ profiles: [{ id: profileId, name: 'Writing desk' }] }), storeFor: () => ({ storeDir }) };
  const exporter = createProfileExport({ registry, preparation, runtimePool, admission, upstreamRef: () => 'abc', now: () => '2026-09-29T00:00:00.000Z', countPapers: async () => 3 });
  return { root, storeDir, profileId, events, exporter, out: path.join(root, 'export') };
}
test('export copies the dump, the media and the profile files while held, and leaves credentials behind', async () => {
  const f = fixture();
  const { manifest } = await f.exporter.exportProfile(f.profileId, f.out);
  assert.deepEqual(f.events, ['prepared', ['lease', 'profile-export', false], 'hold', 'dump', 'reopen', 'release']);
  assert.equal(manifest.kind, 'barkdown-profile-export'); assert.deepEqual(manifest.counts, { papers: 3 }); assert.deepEqual(manifest.navigation, { owner: null }, 'a profile that never identified its library has no navigation owner'); assert.deepEqual(manifest.profile, { id: 'p1', name: 'Writing desk' }); assert.equal(manifest.seal.generation, 3);
  assert.deepEqual(manifest.media.map(m => m.path), ['media/files/a.png']);
  assert.deepEqual(manifest.store.map(s => s.path), ['profile/agent-edits/receipt.json', 'profile/documents/note.json', 'profile/settings.json', 'profile/workspace.json']);
  const settings = JSON.parse(fs.readFileSync(path.join(f.out, 'profile/settings.json'), 'utf8'));
  assert.deepEqual(settings, { theme: 'dark', barkpark: { enabled: true, local: { enabled: true } } });
  assert.ok(!fs.existsSync(path.join(f.out, 'profile/local-credentials.json'))); assert.ok(!fs.existsSync(path.join(f.out, 'profile/agent-edits/paper-owner-key.json')));
  assert.equal(f.exporter.verifyExport(f.out).files, 6);
  fs.appendFileSync(path.join(f.out, 'media/files/a.png'), 'x');
  assert.throws(() => f.exporter.verifyExport(f.out), { code: 'export_changed' });
});
test('a failed dump reopens the runtime and releases the lease; an occupied folder is never overwritten', async () => {
  const f = fixture({ dumpFails: true });
  await assert.rejects(f.exporter.exportProfile(f.profileId, f.out), /pg_dump failed/);
  assert.deepEqual(f.events.slice(-3), ['dump', 'reopen', 'release']);
  assert.ok(!fs.existsSync(path.join(f.out, 'manifest.json')));
  const g = fixture(); fs.mkdirSync(g.out); fs.writeFileSync(path.join(g.out, 'mine.txt'), 'keep');
  await assert.rejects(g.exporter.exportProfile(g.profileId, g.out), { code: 'export_destination' });
  await assert.rejects(g.exporter.exportProfile(g.profileId, path.join(g.storeDir, 'inside')), { code: 'export_destination' });
  assert.deepEqual(g.events, []);
});
test('the verifier refuses a missing file, an unlisted file and an unsafe path', async () => {
  const f = fixture(); await f.exporter.exportProfile(f.profileId, f.out);
  fs.writeFileSync(path.join(f.out, 'stray.txt'), 'x');
  assert.throws(() => f.exporter.verifyExport(f.out), { code: 'export_extra' });
  fs.rmSync(path.join(f.out, 'stray.txt')); fs.rmSync(path.join(f.out, 'database.dump'));
  assert.throws(() => f.exporter.verifyExport(f.out), { code: 'export_missing' });
  const g = fixture(); await g.exporter.exportProfile(g.profileId, g.out);
  const m = JSON.parse(fs.readFileSync(path.join(g.out, 'manifest.json'), 'utf8')); m.media[0].path = '../outside'; fs.writeFileSync(path.join(g.out, 'manifest.json'), JSON.stringify(m));
  assert.throws(() => g.exporter.verifyExport(g.out), { code: 'export_path' });
});
