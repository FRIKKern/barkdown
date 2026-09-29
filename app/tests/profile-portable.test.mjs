// Export and import as the app drives them: the folder comes from the picker and is held in
// main, the preparation is released when the export ends either way, the outcome is recorded
// against that preparation, and a failed export's partial folder goes to the trash.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfilePortable } = require('../main/profile-portable');
function fixture({ dumpFails = false, source = '/checkout', pick } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-portable-'))), profileId = 'p1';
  const storeDir = path.join(root, 'profiles', profileId), mediaDir = path.join(root, 'media'), parent = path.join(root, 'chosen');
  fs.mkdirSync(storeDir, { recursive: true }); fs.mkdirSync(mediaDir); fs.mkdirSync(parent);
  fs.writeFileSync(path.join(storeDir, 'workspace.json'), '{"version":1}'); fs.writeFileSync(path.join(mediaDir, 'a.png'), 'png');
  const events = [], record = { id: 'prep-1', phase: 'prepared' };
  const preparation = { inspect: () => structuredClone(record), abort: async () => { events.push('abort'); record.phase = 'aborted'; },
    withPrepared: async (id, fn) => fn({ assertCurrent: async () => true }) };
  const runtimePool = { acquire: async () => ({ connection: { server: 'http://127.0.0.1:1', token: 't', dataset: 'production' }, release: async () => {},
    data: { mediaDir, dump: async file => { if (dumpFails) throw new Error('pg_dump failed'); fs.writeFileSync(file, 'dump'); return { file, serverVersion: '15' }; } } }), restore: async () => assert.fail('not restored here') };
  const admission = { hold: async () => ({ phase: 'held', capability: 'cap-12345678', generation: 1, boot: 'b' }), reopen: async () => ({ phase: 'open' }) };
  const registry = { load: () => ({ profiles: [{ id: profileId, name: 'Writing: desk/2' }] }), storeFor: () => ({ storeDir }) };
  const progress = [], trashed = [];
  const portable = createProfilePortable({ registry, preparation, runtimePool, sourceFor: () => source, upstreamRef: from => 'ref-of-' + from, progress: e => progress.push(e.phase),
    chooseFolder: pick || (async () => parent), trash: async folder => { trashed.push(folder); fs.renameSync(folder, folder + '.trashed'); }, now: () => '2026-09-29T14:05:00.000Z',
    exportOptions: { admission, countPapers: async () => 2 } });
  return { root, storeDir, profileId, parent, events, record, portable, progress, trashed };
}
test('the export goes to a new named folder under the chosen one, releases the preparation and names its outcome', async () => {
  const f = fixture();
  assert.equal(f.portable.outcome(f.profileId), null);
  const chosen = await f.portable.chooseExport(f.profileId);
  assert.equal(chosen.folder, path.join(f.parent, 'Barkdown export - Writing- desk-2 - 2026-09-29 1405'));
  const done = await f.portable.exportChosen(f.profileId);
  assert.equal(done.status, 'exported'); assert.equal(done.papers, 2); assert.equal(done.media, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(chosen.folder, 'manifest.json'), 'utf8')).upstream, 'ref-of-/checkout');
  assert.deepEqual(f.events, ['abort']);
  assert.deepEqual(f.progress, ['hold:begin', 'hold:held', 'after-dump', 'after-media', 'after-store', 'hold:reopened']);
  assert.deepEqual(f.portable.outcome(f.profileId), { status: 'exported', folder: chosen.folder, papers: 2, media: 1, files: 1, exportedAt: '2026-09-29T14:05:00.000Z' });
  f.record.id = 'prep-2';
  assert.equal(f.portable.outcome(f.profileId), null, 'the outcome belongs to the preparation the export ended');
  await assert.rejects(f.portable.exportChosen(f.profileId), { code: 'portable_destination' }, 'a chosen folder is used once');
});
test('a failed export releases the preparation, trashes the partial folder and says why', async () => {
  const f = fixture({ dumpFails: true });
  const chosen = await f.portable.chooseExport(f.profileId);
  await assert.rejects(f.portable.exportChosen(f.profileId), /pg_dump failed/);
  assert.deepEqual(f.events, ['abort']); assert.deepEqual(f.trashed, [chosen.folder]); assert.ok(!fs.existsSync(chosen.folder));
  assert.deepEqual(f.portable.outcome(f.profileId), { status: 'failed', message: 'pg_dump failed', partial: 'trashed' });
});
test('a cancelled picker exports nothing, and a profile without a local runtime is refused before the picker', async () => {
  const f = fixture({ pick: async () => null });
  assert.equal(await f.portable.chooseExport(f.profileId), null);
  await assert.rejects(f.portable.exportChosen(f.profileId), { code: 'portable_destination' });
  assert.equal(await f.portable.importChosen(f.profileId), null);
  assert.deepEqual(f.events, []);
  const g = fixture({ source: null, pick: async () => assert.fail('no picker') });
  await assert.rejects(g.portable.chooseExport(g.profileId), { code: 'portable_runtime' });
  await assert.rejects(g.portable.importChosen(g.profileId), { code: 'portable_runtime' });
});
