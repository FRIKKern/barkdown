// Export and import from the app (C085): the operator surface over profile-export.js and
// profile-import.js. The folder is chosen in main through the native picker and held here, so
// the window never names a path to write to. An export runs on a prepared profile and releases
// the preparation when it ends, either way; its outcome is recorded against that preparation so
// the restart notice can say what happened. A failed export's partial folder goes to the
// system trash, never deleted. Import creates a new profile and changes no existing one.
const fs = require('node:fs');
const path = require('node:path');
const { createProfileExport } = require('./profile-export');
const { createProfileImport } = require('./profile-import');
const { createStore } = require('./store');
const OUTCOME = 'profile-export-last.json';
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const folderName = (name, at) => `Barkdown export - ${String(name).replace(/[^\p{L}\p{N} ._-]+/gu, '-').trim().slice(0, 60) || 'profile'} - ${at.slice(0, 16).replace('T', ' ').replace(':', '')}`;
function createProfilePortable({ registry, preparation, runtimePool, sourceFor, upstreamRef, chooseFolder, trash = async () => false, progress = () => {}, now = () => new Date().toISOString(), log = () => {}, exportOptions = {} }) {
  if (typeof sourceFor !== 'function' || typeof upstreamRef !== 'function' || typeof chooseFolder !== 'function') throw new TypeError('Source, upstream version and folder picker are required');
  const pending = new Map();
  const step = (action, profileId) => (phase, detail) => { log(`[${action}] ${phase}`); progress({ action, profileId, phase }); };
  const bound = profileId => createStore(registry.storeFor(profileId).storeDir, { create: false });
  const source = profileId => { const value = sourceFor(profileId); if (!value) fail('portable_runtime', 'Enable the local Barkpark runtime for this profile first'); return value; };
  async function chooseExport(profileId) {
    source(profileId);
    const profile = registry.load().profiles.find(p => p.id === profileId);
    if (!profile) fail('portable_profile', 'Unknown profile');
    const parent = await chooseFolder({ title: 'Choose where the profile export goes', buttonLabel: 'Export here', properties: ['openDirectory', 'createDirectory'] });
    if (!parent) { pending.delete(profileId); return null; }
    const folder = path.join(parent, folderName(profile.name, now()));
    if (fs.existsSync(folder)) fail('portable_destination', 'An export with this name already exists there; nothing is overwritten');
    pending.set(profileId, folder);
    return { folder };
  }
  async function exportChosen(profileId) {
    const folder = pending.get(profileId); pending.delete(profileId);
    if (!folder) fail('portable_destination', 'Choose a folder for the export first');
    const from = source(profileId), preparationId = preparation.inspect(profileId)?.id || null;
    const exporter = createProfileExport({ ...exportOptions, registry, preparation, runtimePool, upstreamRef: () => upstreamRef(from), now, checkpoint: step('export', profileId) });
    let outcome;
    try {
      const { manifest } = await exporter.exportProfile(profileId, folder);
      outcome = { version: 1, status: 'exported', preparationId, folder, exportedAt: manifest.exportedAt, papers: manifest.counts.papers + (manifest.counts.drafts || 0), media: manifest.media.length, files: manifest.store.length };
    } catch (error) {
      log(`[export] failed: ${error.code || ''} ${error.message}`);
      let trashed = false;
      if (fs.existsSync(folder) && !fs.existsSync(path.join(folder, 'manifest.json'))) { try { trashed = (await trash(folder)) !== false; } catch (cleanup) { log(`[export] partial folder kept: ${cleanup.message}`); } }
      outcome = { version: 1, status: 'failed', preparationId, folder, failedAt: now(), code: error.code || null, message: error.message, partial: fs.existsSync(folder) ? 'kept' : trashed ? 'trashed' : 'none' };
    }
    bound(profileId).writeJson(OUTCOME, outcome);
    // The export is over: the preparation is released either way. A fresh host reopens editing.
    try { await preparation.abort(profileId); } catch (error) { log(`[export] preparation not released: ${error.message}`); }
    if (outcome.status === 'failed') throw Object.assign(new Error(outcome.message), { code: outcome.code || 'export_failed' });
    return outcome;
  }
  // The outcome of the export that ended the given profile's current preparation, if any.
  function outcome(profileId) {
    let value; try { value = bound(profileId).readJson(OUTCOME, null); } catch { return null; }
    const record = preparation.inspect(profileId);
    if (!value || value.version !== 1 || !record || value.preparationId !== record.id || !['exported', 'failed'].includes(value.status)) return null;
    return value.status === 'exported' ? { status: 'exported', folder: value.folder, papers: value.papers, media: value.media, files: value.files, exportedAt: value.exportedAt }
      : { status: 'failed', message: value.message, partial: value.partial };
  }
  async function importChosen(profileId) {
    const from = source(profileId);
    const folder = await chooseFolder({ title: 'Choose a Barkdown profile export', buttonLabel: 'Import', properties: ['openDirectory'] });
    if (!folder) return null;
    const importer = createProfileImport({ registry, runtimePool, source: from, upstreamRef: () => upstreamRef(from), now, checkpoint: step('import', profileId) });
    let result;
    try { result = await importer.importProfile(folder); }
    catch (error) { log(`[import] failed: ${error.code || ''} ${error.message}`); throw error; }
    const profile = registry.load().profiles.find(p => p.id === result.profileId);
    return { profile: { id: profile.id, name: profile.name }, papers: result.manifest.counts.papers + (result.manifest.counts.drafts || 0), media: result.manifest.media.length, files: result.record.files,
      exportedProfile: result.manifest.profile.name, exportedAt: result.manifest.exportedAt };
  }
  return Object.freeze({ chooseExport, exportChosen, importChosen, outcome });
}
module.exports = { createProfilePortable };
