// Export and import as the app drives them: the folder comes from the picker and is held in
// main, the preparation is released when the export ends either way, the outcome is recorded
// against that preparation, a failed or interrupted export's partial folder goes to the trash,
// and an import that did not finish is never a library: it is discarded or run again.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfilePortable } = require('../main/profile-portable');
const { createProfileRegistry } = require('../main/profile-registry');
function fixture({ dumpFails = false, dumpDies = false, restoreFails = false, source = '/checkout', pick, phase = 'held' } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-portable-')));
  const registry = createProfileRegistry(path.join(root, 'profile-data'));
  const profile = registry.createProfile({ name: 'Writing: desk/2' }), profileId = profile.id, storeDir = registry.storeFor(profileId).storeDir;
  const mediaDir = path.join(root, 'media'), parent = path.join(root, 'chosen'), trashDir = path.join(root, 'trash');
  fs.mkdirSync(mediaDir); fs.mkdirSync(parent); fs.mkdirSync(trashDir);
  fs.writeFileSync(path.join(mediaDir, 'a.png'), 'png');
  const events = [], record = { id: 'prep-1', phase: 'prepared' }, runtime = { phase: 'open', generation: 1, writers: 0, deadWriters: 0 };
  const preparation = { inspect: () => structuredClone(record), abort: async () => { events.push('abort'); record.phase = 'aborted'; },
    withPrepared: async (id, fn) => fn({ assertCurrent: async () => true }) };
  const runtimePool = { acquire: async (id, options) => ({ connection: { server: 'http://127.0.0.1:1', token: 't', dataset: 'production' }, release: async () => {},
    data: { mediaDir, dump: async file => { if (dumpFails) throw new Error('pg_dump failed'); fs.writeFileSync(file, 'dump'); if (dumpDies) throw Object.assign(new Error('host died'), { died: true }); return { file, serverVersion: '15' }; } } }),
    restore: async (id, input) => { events.push(['restore', path.basename(input.dumpFile)]); if (restoreFails) throw new Error('pg_restore failed'); return { profileId: id, storeDir: registry.storeFor(id).storeDir, counts: { papers: 2 }, connection: { server: 'http://127.0.0.1:2', token: 'new', dataset: 'production', viaCli: false } }; },
    reclaim: async id => { events.push(['reclaim', id]); return { reclaimed: false }; } };
  const admission = { hold: async () => { events.push('hold'); runtime.phase = 'held'; return { phase: 'held', capability: 'cap-12345678', generation: 1, boot: 'b' }; }, awaitHeld: async () => assert.fail('already held'),
    reopen: async () => { events.push('reopen'); runtime.phase = 'open'; return { phase: 'open' }; }, instance: async () => ({ ...runtime, pending: 0 }),
    recover: async () => { events.push('recover'); runtime.phase = 'open'; return { phase: 'open' }; } };
  const progress = [], trashed = [];
  const make = () => createProfilePortable({ registry, preparation, runtimePool, admission, sourceFor: () => source, upstreamRef: from => 'ref-of-' + from, progress: e => progress.push(e.phase),
    chooseFolder: pick || (async () => parent), trash: async folder => { trashed.push(folder); fs.renameSync(folder, path.join(trashDir, path.basename(folder) + '-' + trashed.length)); }, now: () => '2026-09-29T14:05:00.000Z',
    exportOptions: { countPapers: async () => ({ papers: 2, drafts: 1 }) } });
  return { root, registry, storeDir, profileId, parent, events, record, runtime, portable: make(), restart: make, progress, trashed };
}
test('the export goes to a new named folder under the chosen one, releases the preparation and names its outcome', async () => {
  const f = fixture();
  assert.equal(f.portable.outcome(f.profileId), null);
  const chosen = await f.portable.chooseExport(f.profileId);
  assert.equal(chosen.folder, path.join(f.parent, 'Barkdown export - Writing- desk-2 - 2026-09-29 1405'));
  const done = await f.portable.exportChosen(f.profileId);
  assert.equal(done.status, 'exported'); assert.equal(done.papers, 3, 'published Papers and draft-only notes'); assert.equal(done.media, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(chosen.folder, 'manifest.json'), 'utf8'));
  assert.equal(manifest.upstream, 'ref-of-/checkout'); assert.deepEqual(manifest.counts, { papers: 2, drafts: 1 });
  assert.deepEqual(f.events, ['hold', 'reopen', 'abort']);
  assert.deepEqual(f.progress, ['hold:begin', 'hold:held', 'after-dump', 'after-media', 'after-store', 'hold:reopened']);
  assert.equal(f.portable.outcome(f.profileId).status, 'exported'); assert.equal(f.portable.outcome(f.profileId).folder, chosen.folder);
  f.record.id = 'prep-2';
  assert.equal(f.portable.outcome(f.profileId), null, 'the outcome belongs to the preparation the export ended');
  await assert.rejects(f.portable.exportChosen(f.profileId), { code: 'portable_destination' }, 'a chosen folder is used once');
});
test('a failed export releases the preparation, trashes the partial folder and says why', async () => {
  const f = fixture({ dumpFails: true });
  const chosen = await f.portable.chooseExport(f.profileId);
  await assert.rejects(f.portable.exportChosen(f.profileId), /pg_dump failed/);
  assert.deepEqual(f.events, ['hold', 'reopen', 'abort']); assert.deepEqual(f.trashed, [chosen.folder]); assert.ok(!fs.existsSync(chosen.folder));
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
// A host that dies in the middle: the journal says exporting, the runtime is held, the folder is partial.
function interrupted(f, { sealed = false } = {}) {
  const folder = path.join(f.parent, 'Barkdown export - left behind'); fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'database.dump'), 'half');
  fs.writeFileSync(path.join(f.storeDir, 'profile-export-last.json'), JSON.stringify({ version: 1, status: 'exporting', preparationId: 'prep-1', operation: 'export-abc', folder, startedAt: '2026-09-29T14:00:00.000Z' }));
  f.runtime.phase = 'held';
  return { folder, next: f.restart() };
}
test('an interrupted export is named at the next start and discarded: runtime reopened, folder trashed, preparation released', async () => {
  const f = fixture(), { folder, next } = interrupted(f);
  assert.deepEqual(next.outcome(f.profileId), { status: 'interrupted', folder, startedAt: '2026-09-29T14:00:00.000Z', partial: 'present' });
  await assert.rejects(next.chooseExport(f.profileId), { code: 'portable_interrupted' }, 'no second export over an interrupted one');
  assert.deepEqual(await next.discardExport(f.profileId), { status: 'discarded', folder, partial: 'trashed' });
  assert.deepEqual(f.events, ['hold', 'reopen', 'abort']); assert.deepEqual(f.trashed, [folder]); assert.equal(f.runtime.phase, 'open');
  assert.equal(next.outcome(f.profileId).status, 'discarded');
  await assert.rejects(next.discardExport(f.profileId), { code: 'portable_discard' });
  f.record.id = 'prep-2'; f.record.phase = 'prepared';
  assert.ok(await next.chooseExport(f.profileId), 'the next export is free to start');
});
test('empty recovery resumes an export; uncertain writers keep its partial folder and preparation', async () => {
  // Refuse the hold the way a runtime in recovery does.
  const refused = fixture(); const retained = interrupted(refused); refused.runtime.phase = 'recovery_required'; let pending = 1;
  const stubborn = createProfilePortable({ registry: refused.registry, preparation: { inspect: () => structuredClone(refused.record), abort: async () => { refused.events.push('abort'); refused.record.phase = 'aborted'; } },
    runtimePool: { acquire: async () => ({ connection: { server: 'http://127.0.0.1:1', token: 't' }, release: async () => {} }), restore: async () => {}, reclaim: async () => {} },
    admission: { instance: async () => ({ ...refused.runtime, pending }), hold: async () => { if (refused.runtime.phase === 'recovery_required') throw Object.assign(new Error('closed'), { code: 'upstream_admission_closed' }); refused.events.push('hold'); return { phase: 'held', capability: 'cap-12345678' }; }, reopen: async () => { refused.events.push('reopen'); return { phase: 'open' }; },
      recover: async (_t, proof) => { refused.events.push(['recover', proof]); refused.runtime.phase = 'open'; return { phase: 'open' }; } },
    sourceFor: () => '/checkout', upstreamRef: () => 'ref', chooseFolder: async () => null, trash: async folder => { fs.rmSync(folder, { recursive: true }); } });
  await assert.rejects(stubborn.discardExport(refused.profileId), { code: 'upstream_reconciliation_required' });
  assert.equal(fs.readFileSync(path.join(retained.folder, 'database.dump'), 'utf8'), 'half');
  assert.equal(stubborn.outcome(refused.profileId).status, 'interrupted');
  assert.equal(refused.record.phase, 'prepared'); assert.deepEqual(refused.events, []);
  pending = 0;
  assert.equal((await stubborn.discardExport(refused.profileId)).status, 'discarded');
  assert.deepEqual(refused.events, [['recover', { generation: 1, pending: 0 }], 'hold', 'reopen', 'abort']);
  const f = fixture(), { next } = interrupted(f);
  f.runtime.phase = 'open';
  assert.equal((await next.discardExport(f.profileId)).status, 'discarded');
  assert.deepEqual(f.events, ['abort'], 'an open runtime is not held again');
});
test('an interrupted export whose folder verifies is a complete export', async () => {
  const f = fixture();
  const chosen = await f.portable.chooseExport(f.profileId); await f.portable.exportChosen(f.profileId);
  fs.writeFileSync(path.join(f.storeDir, 'profile-export-last.json'), JSON.stringify({ version: 1, status: 'exporting', preparationId: 'prep-1', operation: 'export-abc', folder: chosen.folder, startedAt: '2026-09-29T14:00:00.000Z' }));
  f.record.phase = 'prepared'; f.events.length = 0;
  const next = f.restart();
  assert.equal(next.outcome(f.profileId).partial, 'none');
  const done = await next.discardExport(f.profileId);
  assert.equal(done.status, 'exported'); assert.equal(done.papers, 3); assert.deepEqual(f.trashed, []); assert.ok(fs.existsSync(path.join(chosen.folder, 'manifest.json')));
});
async function exported(f) { const chosen = await f.portable.chooseExport(f.profileId); await f.portable.exportChosen(f.profileId); f.events.length = 0; return chosen.folder; }
test('an import that fails is discarded at once: no profile is left, the reason is said', async () => {
  const f = fixture(), folder = await exported(f);
  f.restoreFails = () => true;
  const portable = createPortableWith(f, async () => folder);
  await assert.rejects(portable.importChosen(f.profileId), /pg_restore failed/);
  assert.deepEqual(f.registry.load().profiles.map(p => p.name), ['Writing: desk/2']);
  assert.equal(f.trashed.length, 1); assert.deepEqual(portable.interruptedImports(), []);
  assert.deepEqual(f.events.map(e => e[0]), ['restore', 'reclaim']);
});
function createPortableWith(f, pick) {
  return createProfilePortable({ registry: f.registry, preparation: { inspect: () => structuredClone(f.record), abort: async () => {}, withPrepared: async (id, fn) => fn({ assertCurrent: async () => true }) },
    runtimePool: { acquire: async () => assert.fail('no lease'), restore: async (id, input) => { f.events.push(['restore', id]); if (f.restoreFails?.()) throw new Error('pg_restore failed'); return { profileId: id, storeDir: f.registry.storeFor(id).storeDir, counts: { papers: 2 }, connection: { server: 'http://127.0.0.1:2', token: 'new', dataset: 'production', viaCli: false } }; },
      reclaim: async id => { f.events.push(['reclaim', id]); } },
    admission: {}, sourceFor: () => '/checkout', upstreamRef: from => 'ref-of-' + from, chooseFolder: pick, now: () => '2026-09-29T15:00:00.000Z',
    trash: async folder => { f.trashed.push(folder); fs.renameSync(folder, path.join(f.root, 'trash', path.basename(folder) + '-' + f.trashed.length)); } });
}
test('an import interrupted by a dead host is listed, never selectable, and discarded or run again from its export', async () => {
  const f = fixture(), folder = await exported(f);
  f.restoreFails = () => false;
  // The host died while restoring: a profile with a journal at restoring, nothing else.
  const half = f.registry.createProfile({ name: 'Writing: desk/2 (imported)' });
  fs.writeFileSync(path.join(f.registry.storeFor(half.id).storeDir, 'profile-import.json'), JSON.stringify({ version: 1, phase: 'restoring', profileId: half.id, exportedProfile: { id: f.profileId, name: 'Writing: desk/2' }, exportedAt: '2026-09-29T14:05:00.000Z', exportDir: folder, startedAt: '2026-09-29T14:10:00.000Z' }));
  const portable = createPortableWith(f, async () => assert.fail('no picker'));
  assert.deepEqual(portable.interruptedImports(), [{ profileId: half.id, name: 'Writing: desk/2 (imported)', phase: 'restoring', exportedProfile: 'Writing: desk/2', exportDir: folder, exportAvailable: true }]);
  assert.equal(portable.isIncomplete(half.id), true); assert.equal(portable.isIncomplete(f.profileId), false);
  await assert.rejects(portable.discardImport(f.profileId), { code: 'portable_discard' }, 'a library is never discarded');
  const again = await portable.importAgain(f.profileId, half.id);
  assert.notEqual(again.profile.id, half.id); assert.equal(again.papers, 3);
  assert.deepEqual(f.registry.load().profiles.map(p => p.id).sort(), [f.profileId, again.profile.id].sort());
  assert.deepEqual(f.events.map(e => e[0]), ['reclaim', 'restore']); assert.equal(f.trashed.length, 1);
  assert.deepEqual(portable.interruptedImports(), []); assert.equal(portable.isIncomplete(again.profile.id), false);
  // A second half-made import whose export folder is gone can only be discarded.
  const lost = f.registry.createProfile({ name: 'Lost' });
  fs.writeFileSync(path.join(f.registry.storeFor(lost.id).storeDir, 'profile-import.json'), JSON.stringify({ version: 1, phase: 'restored', profileId: lost.id, exportedProfile: { id: 'x', name: 'Elsewhere' }, exportedAt: 'x', exportDir: path.join(f.root, 'gone') }));
  assert.equal(portable.interruptedImports()[0].exportAvailable, false);
  await assert.rejects(portable.importAgain(f.profileId, lost.id), { code: 'portable_source' });
  assert.ok(f.registry.load().profiles.some(p => p.id === lost.id), 'refused before anything was discarded');
  assert.equal((await portable.discardImport(lost.id)).folder, 'trashed');
  assert.ok(!f.registry.load().profiles.some(p => p.id === lost.id));
});
test('an export into a folder the application chose needs no picker, and refuses to overwrite', async () => {
  const f = fixture({ pick: async () => assert.fail('no picker is shown') });
  const parent = path.join(f.root, 'snapshots'), name = 'Before Barkdown 0.7.0 - 2026-10-02 0100';
  const done = await f.portable.exportTo(f.profileId, parent, { name });
  assert.equal(done.status, 'exported'); assert.equal(done.folder, path.join(parent, name));
  assert.ok(fs.existsSync(path.join(done.folder, 'manifest.json')));
  await assert.rejects(f.portable.exportTo(f.profileId, parent, { name }), { code: 'portable_destination' });
});
test('the registry never removes the selected profile', () => {
  const f = fixture();
  assert.throws(() => f.registry.removeProfile(f.profileId), /selected profile cannot be removed/);
  const other = f.registry.createProfile({ name: 'Other' });
  const removed = f.registry.removeProfile(other.id);
  assert.ok(fs.existsSync(removed.directory), 'the folder is left for the caller to move');
  assert.deepEqual(f.registry.load().profiles.map(p => p.id), [f.profileId]);
});
