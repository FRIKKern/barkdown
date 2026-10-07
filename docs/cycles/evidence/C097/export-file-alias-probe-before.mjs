// The profile export's own rules: held while copying, reopened whatever happens, nothing
// overwritten, credentials and machine-bound files left behind, and a verifier that notices.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileExport } = require('C:/Users/Frikk/Documents/GitHub/barkdown/app/main/profile-export.js');
function fixture({ dumpFails = false, linkedRoot = null } = {}) {
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
  if (linkedRoot) {
    const external = path.join(root, 'outside-profile');
    if (linkedRoot !== 'dangling') {
      fs.mkdirSync(external); fs.writeFileSync(path.join(external, 'sentinel.txt'), 'This belongs outside the profile.');
    }
    const link = linkedRoot === 'media' ? path.join(root, 'runtime', 'linked-media') :
      path.join(storeDir, 'attachments', ...(linkedRoot === 'nested' ? ['linked'] : []));
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');
  }
  const events = [];
  const admission = {
    hold: async (_t, operation) => { events.push('hold'); return { phase: 'held', capability: 'cap-12345678', generation: 3, boot: 'boot', operation }; },
    awaitHeld: async () => assert.fail('already held'),
    reopen: async () => { events.push('reopen'); return { phase: 'open', generation: 4 }; },
  };
  const runtimePool = { acquire: async (id, options) => { events.push(['lease', options.ownerId, options.writes]); return { connection: { server: 'http://127.0.0.1:1', token: 't', dataset: 'production' },
    data: { mediaDir: linkedRoot === 'media' ? path.join(root, 'runtime', 'linked-media') : mediaDir, dump: async file => { events.push('dump'); if (dumpFails) throw new Error('pg_dump failed'); fs.writeFileSync(file, 'dump-bytes'); return { file, serverVersion: '15.18' }; } }, release: async () => events.push('release') }; } };
  const preparation = { withPrepared: async (id, fn) => { events.push('prepared'); return fn({ sourceDir: storeDir, assertCurrent: async () => true }); } };
  const registry = { load: () => ({ profiles: [{ id: profileId, name: 'Writing desk' }] }), storeFor: () => ({ storeDir }) };
  const exporter = createProfileExport({ registry, preparation, runtimePool, admission, upstreamRef: () => 'abc', now: () => '2026-09-29T00:00:00.000Z', countPapers: async () => 3 });
  return { root, storeDir, profileId, events, exporter, out: path.join(root, 'export') };
}

const results = [];
for (const kind of ['hardlink', 'symlink']) for (const target of ['workspace.json', 'settings.json', 'attachments/alias.json', 'media/files/alias.json']) {
  const f = fixture(), outside = path.join(f.root, 'outside-profile.json');
  const marker = { sentinel: 'outside-profile-static-file-alias', theme: 'dark' };
  fs.writeFileSync(outside, JSON.stringify(marker));
  const source = target.startsWith('media/') ? path.join(f.root, 'runtime', target) : path.join(f.storeDir, target);
  fs.mkdirSync(path.dirname(source), { recursive: true });
  if (fs.existsSync(source)) fs.renameSync(source, path.join(f.root, 'retained-original-' + path.basename(source)));
  const record = { kind, target, fixture: f.root };
  try { if (kind === 'hardlink') fs.linkSync(outside, source); else fs.symlinkSync(outside, source, 'file'); }
  catch (error) { record.linkCreation = { code: error.code, message: error.message }; results.push(record); continue; }
  const stat = fs.lstatSync(source), outsideStat = fs.statSync(outside);
  record.link = { symbolic: stat.isSymbolicLink(), links: stat.nlink, sameInode: stat.ino === outsideStat.ino };
  try {
    const { manifest } = await f.exporter.exportProfile(f.profileId, f.out);
    const archivePath = target.startsWith('media/') ? target : 'profile/' + target;
    record.export = 'accepted';
    record.entry = [...manifest.store, ...manifest.media].find(entry => entry.path === archivePath);
    record.outsideMarkerCopied = JSON.parse(fs.readFileSync(path.join(f.out, archivePath), 'utf8')).sentinel === marker.sentinel;
    record.verifierFiles = f.exporter.verifyExport(f.out).files;
  } catch (error) { record.export = 'refused'; record.code = error.code; record.message = error.message; }
  assert.equal(JSON.parse(fs.readFileSync(outside, 'utf8')).sentinel, marker.sentinel, 'outside source is preserved');
  assert.deepEqual(f.events.slice(-2), ['reopen', 'release'], 'owned lease is released');
  record.events = f.events; results.push(record);
}
const report = { at: new Date().toISOString(), source: '55a5415a runtime source b4e85d7f', scope: 'Characterization, not acceptance. All source and outside-profile files are new disposable sentinels; no real content. Static links only, no races. File symlink creation failures are host limitations, not application refusals.', results };
fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
