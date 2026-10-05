// Export and import from the app (C085): the operator surface over profile-export.js and
// profile-import.js. The folder is chosen in main through the native picker and held here, so
// the window never names a path to write to. An export runs on a prepared profile and releases
// the preparation when it ends, either way; its journal is written before the hold and names
// the outcome against that preparation, so the notice can say what happened, also after a host
// that died in the middle. A half-written export cannot be resumed: it is discarded (the
// folder goes to the system trash, the runtime is reopened) and taken again. Import creates a
// new profile and changes no existing one; an import that did not finish is never a library:
// it cannot be selected, and is discarded or run again from its export folder.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createProfileExport, verifyExport } = require('./profile-export');
const { createProfileImport } = require('./profile-import');
const { createUpstreamAdmission, holdReconciled } = require('./upstream-admission');
const { createStore } = require('./store');
const OUTCOME = 'profile-export-last.json';
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const folderName = (name, at) => `Barkdown export - ${String(name).replace(/[^\p{L}\p{N} ._-]+/gu, '-').trim().slice(0, 60) || 'profile'} - ${at.slice(0, 16).replace('T', ' ').replace(':', '')}`;
function createProfilePortable({ registry, preparation, runtimePool, sourceFor, upstreamRef, precedes = () => false, chooseFolder, trash = async () => false, progress = () => {}, now = () => new Date().toISOString(), log = () => {}, admission = createUpstreamAdmission(), exportOptions = {} }) {
  if (typeof sourceFor !== 'function' || typeof upstreamRef !== 'function' || typeof chooseFolder !== 'function') throw new TypeError('Source, upstream version and folder picker are required');
  const pending = new Map(), exporting = new Set(), importing = new Set();
  const step = (action, profileId) => (phase, detail) => { log(`[${action}] ${phase}`); progress({ action, profileId, phase }); };
  const bound = profileId => createStore(registry.storeFor(profileId).storeDir, { create: false });
  const source = profileId => { const value = sourceFor(profileId); if (!value) fail('portable_runtime', 'Enable the local Barkpark runtime for this profile first'); return value; };
  const sealed = folder => { try { verifyExport(folder); return true; } catch { return false; } };
  const partial = folder => typeof folder === 'string' && fs.existsSync(folder) && !fs.existsSync(path.join(folder, 'manifest.json'));
  const journal = profileId => { try { const value = bound(profileId).readJson(OUTCOME, null); return value?.version === 1 ? value : null; } catch { return null; } };
  const counted = manifest => ({ exportedAt: manifest.exportedAt, papers: manifest.counts.papers + (manifest.counts.drafts || 0), media: manifest.media.length, files: manifest.store.length });
  async function discardFolder(folder) {
    if (!partial(folder)) return typeof folder === 'string' && fs.existsSync(folder) ? 'kept' : 'none';
    try { return (await trash(folder)) !== false && !fs.existsSync(folder) ? 'trashed' : 'kept'; } catch (error) { log(`[export] partial folder kept: ${error.message}`); return 'kept'; }
  }
  const exportable = profileId => {
    source(profileId);
    const profile = registry.load().profiles.find(p => p.id === profileId);
    if (!profile) fail('portable_profile', 'Unknown profile');
    if (journal(profileId)?.status === 'exporting' && !exporting.has(profileId)) fail('portable_interrupted', 'An earlier export of this profile was interrupted. Discard it first');
    return profile;
  };
  const planExport = (profileId, parent, name) => {
    const folder = path.join(parent, name || folderName(exportable(profileId).name, now()));
    if (fs.existsSync(folder)) fail('portable_destination', 'An export with this name already exists there; nothing is overwritten');
    pending.set(profileId, folder);
    return { folder };
  };
  async function chooseExport(profileId) {
    exportable(profileId);
    const parent = await chooseFolder({ title: 'Choose where the profile export goes', buttonLabel: 'Export here', properties: ['openDirectory', 'createDirectory'] });
    if (!parent) { pending.delete(profileId); return null; }
    return planExport(profileId, parent);
  }
  // An export into a folder the application chose, no picker: the copy taken before an update installs
  // (main/updates.js). The same preparation, run and journal as a chosen export.
  async function exportTo(profileId, parent, { name = null } = {}) {
    exportable(profileId);
    fs.mkdirSync(parent, { recursive: true });
    planExport(profileId, parent, name);
    return exportChosen(profileId);
  }
  async function exportChosen(profileId) {
    const folder = pending.get(profileId); pending.delete(profileId);
    if (!folder) fail('portable_destination', 'Choose a folder for the export first');
    if (exporting.has(profileId)) fail('portable_busy', 'This profile is being exported');
    const from = source(profileId), preparationId = preparation.inspect(profileId)?.id || null, operation = 'export-' + crypto.randomUUID();
    const exporter = createProfileExport({ ...exportOptions, registry, preparation, runtimePool, admission, upstreamRef: () => upstreamRef(from), now, checkpoint: step('export', profileId) });
    const started = { version: 1, status: 'exporting', preparationId, operation, folder, startedAt: now() };
    exporting.add(profileId);
    let outcome;
    try {
      bound(profileId).writeJson(OUTCOME, started);
      try { outcome = { ...started, status: 'exported', ...counted((await exporter.exportProfile(profileId, folder, { operation })).manifest) }; }
      catch (error) {
        log(`[export] failed: ${error.code || ''} ${error.message}`);
        outcome = { ...started, status: 'failed', failedAt: now(), code: error.code || null, message: error.message, partial: await discardFolder(folder) };
      }
      bound(profileId).writeJson(OUTCOME, outcome);
      // The export is over: the preparation is released either way. A fresh host reopens editing.
      try { await preparation.abort(profileId); } catch (error) { log(`[export] preparation not released: ${error.message}`); }
    } finally { exporting.delete(profileId); }
    if (outcome.status === 'failed') throw Object.assign(new Error(outcome.message), { code: outcome.code || 'export_failed' });
    return view(outcome);
  }
  const view = value => value.status === 'exported' ? { status: 'exported', folder: value.folder, papers: value.papers, media: value.media, files: value.files, exportedAt: value.exportedAt }
    : value.status === 'failed' ? { status: 'failed', message: value.message, partial: value.partial }
      : value.status === 'discarded' ? { status: 'discarded', folder: value.folder, partial: value.partial }
        : { status: 'interrupted', folder: value.folder, startedAt: value.startedAt, partial: partial(value.folder) ? 'present' : 'none' };
  // The outcome of the export that belongs to the given profile's current preparation, if any.
  function outcome(profileId) {
    const value = journal(profileId), record = preparation.inspect(profileId);
    if (!value || !record || value.preparationId !== record.id || !['exporting', 'exported', 'failed', 'discarded'].includes(value.status)) return null;
    if (value.status === 'exporting' && exporting.has(profileId)) return { status: 'running', folder: value.folder };
    return view(value);
  }
  // The runtime may still refuse writers for the export that never reopened it.
  async function releaseHold(profileId, operation) {
    const lease = await runtimePool.acquire(profileId, { ownerId: 'profile-export-discard', writes: false });
    try {
      const target = { profileId, server: lease.connection.server, token: lease.connection.token, dataset: lease.connection.dataset || 'production' };
      let seen;
      try { seen = await admission.instance(target); } catch (error) { if (error.code === 'upstream_admission_unavailable') return 'unmanaged'; throw error; }
      if (seen.phase === 'open' || seen.phase === 'unconfigured') return 'open';
      // Recover if the runtime came back in recovery, take the hold this export owned, release it.
      const held = await holdReconciled(admission, target, operation, { timeoutMs: 60000, log });
      await admission.reopen(target, held.capability);
      return 'reopened';
    } finally { await lease.release(); }
  }
  async function discardExport(profileId) {
    const value = journal(profileId);
    if (!value || value.status !== 'exporting' || exporting.has(profileId)) fail('portable_discard', 'There is no interrupted export to discard');
    const hold = await releaseHold(profileId, value.operation);
    // The manifest is written last: a folder that verifies is a complete export, whatever happened after.
    const done = sealed(value.folder) ? { ...value, status: 'exported', ...counted(verifyExport(value.folder).manifest), hold }
      : { ...value, status: 'discarded', discardedAt: now(), partial: await discardFolder(value.folder), hold };
    log(`[export] interrupted export ${done.status}; runtime ${hold}`);
    bound(profileId).writeJson(OUTCOME, done);
    if (preparation.inspect(profileId)?.phase !== 'aborted') await preparation.abort(profileId);
    return view(done);
  }
  const inspector = createProfileImport({ registry, runtimePool, source: '', upstreamRef: () => null });
  // Imports that started and never finished. They are profiles in the registry, not libraries.
  function interruptedImports() {
    return registry.load().profiles.filter(p => !importing.has(p.id)).map(p => ({ profile: p, state: inspector.inspect(p.id) }))
      .filter(({ state }) => ['restoring', 'restored', 'blocked'].includes(state.status))
      .map(({ profile, state }) => ({ profileId: profile.id, name: profile.name, phase: state.status, exportedProfile: state.exportedProfile?.name || null, exportDir: state.exportDir || null,
        exportAvailable: Boolean(state.exportDir && fs.existsSync(path.join(state.exportDir, 'manifest.json'))) }));
  }
  const isIncomplete = profileId => importing.has(profileId) || interruptedImports().some(entry => entry.profileId === profileId);
  async function discardImport(profileId) {
    const found = interruptedImports().find(entry => entry.profileId === profileId);
    if (!found) fail('portable_discard', 'This profile is not an interrupted import');
    await runtimePool.reclaim(profileId);
    const removed = registry.removeProfile(profileId);
    let moved = 'kept';
    try { moved = (await trash(removed.directory)) !== false && !fs.existsSync(removed.directory) ? 'trashed' : 'kept'; } catch (error) { log(`[import] discarded profile folder kept: ${error.message}`); }
    log(`[import] interrupted import discarded: ${profileId} folder ${moved}`);
    return { profileId, name: found.name, folder: moved, exportDir: found.exportDir };
  }
  async function runImport(profileId, folder) {
    const from = source(profileId), known = new Set(registry.load().profiles.map(p => p.id));
    // The profile being made is not selectable, and not listed as interrupted, while this runs.
    const made = (phase, detail) => { if (detail?.profileId && !known.has(detail.profileId)) importing.add(detail.profileId); step('import', profileId)(phase, detail); };
    let result;
    try { result = await createProfileImport({ registry, runtimePool, source: from, upstreamRef: () => upstreamRef(from), precedes: (earlier, later) => precedes(from, earlier, later), now, checkpoint: made }).importProfile(folder); }
    catch (error) {
      log(`[import] failed: ${error.code || ''} ${error.message}`);
      if (error.profileId) { importing.delete(error.profileId); try { await discardImport(error.profileId); } catch (cleanup) { log(`[import] half-made profile kept: ${cleanup.message}`); } }
      throw error;
    }
    importing.delete(result.profileId);
    const profile = registry.load().profiles.find(p => p.id === result.profileId);
    return { profile: { id: profile.id, name: profile.name }, ...counted(result.manifest), files: result.record.files, exportedProfile: result.manifest.profile.name };
  }
  async function importChosen(profileId) {
    source(profileId);
    const folder = await chooseFolder({ title: 'Choose a Barkdown profile export', buttonLabel: 'Import', properties: ['openDirectory'] });
    if (!folder) return null;
    return runImport(profileId, folder);
  }
  // An import from a folder named by the control surface (C095), no picker: the same run as a chosen one.
  async function importFrom(profileId, folder) {
    source(profileId);
    if (!path.isAbsolute(folder) || !fs.existsSync(path.join(folder, 'manifest.json'))) fail('portable_source', 'That folder is not a profile export: it has no manifest.json');
    return runImport(profileId, folder);
  }
  // Run an interrupted import again from the export folder it named: the half-made profile is discarded first.
  async function importAgain(profileId, interruptedId) {
    source(profileId);
    const found = interruptedImports().find(entry => entry.profileId === interruptedId);
    if (!found) fail('portable_discard', 'This profile is not an interrupted import');
    if (!found.exportAvailable || !sealed(found.exportDir)) fail('portable_source', 'The export folder of this import is missing or no longer verifies. Discard the import and choose the export again');
    await discardImport(interruptedId);
    return runImport(profileId, found.exportDir);
  }
  return Object.freeze({ chooseExport, exportTo, exportChosen, importChosen, importFrom, outcome, discardExport, interruptedImports, isIncomplete, discardImport, importAgain });
}
module.exports = { createProfilePortable };
