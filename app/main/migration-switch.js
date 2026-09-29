// The library switch as one operator action (A2 steps 4–5), composed from the
// proven pieces: preflight and backup, baseline, staging, then the durable selection
// under the upstream hold; and the way back. Exposed to Settings and to the start-time
// notice for an interrupted switch. Assumption recorded in C083: publishing labels
// for migrated notes are generated here (description from the first words, one
// `migrated` tag) and reviewed on Paper afterwards, not before the switch.
const fs = require('node:fs');
const path = require('node:path');
const { prepareMigration } = require('./migration-preflight');
const { stageMigration } = require('./migration-staging');
const { createMigrationComparison } = require('./migration-comparison');
const { createMigrationSelection, selectionStatus } = require('./migration-selection');
const { createStore } = require('./store');
const { docToText } = require('../shared/markdown');

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

function generatedLabels(sourceDir) {
  const dir = path.join(sourceDir, 'documents'), labels = {};
  if (!fs.existsSync(dir)) return labels;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    let doc; try { doc = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch { continue; }
    if (!doc?.id) continue;
    const text = (() => { try { return docToText(doc.content) || ''; } catch { return ''; } })().replace(/\s+/g, ' ').trim();
    const description = (text.length > 20 ? text.slice(0, 180) : `${doc.title || doc.id}: migrated from the legacy Barkdown store; review this description on Paper.`).trim();
    labels[doc.id] = { description, tags: [{ tag: 'migrated', strength: 60, rationale: 'Migrated from the legacy Barkdown store; labels generated at the switch, not yet reviewed by a person' }] };
  }
  return labels;
}

function createMigrationSwitch({ registry, preparation, runtimePool, userData, admission, selectionFor = null, stage = stageMigration, checkpoint = () => {} }) {
  if (!registry?.storeFor || typeof preparation?.withPrepared !== 'function' || typeof runtimePool?.acquire !== 'function' || typeof userData !== 'string') throw new TypeError('Registry, preparation, runtime pool and user data root are required');
  const comparison = createMigrationComparison({ preparation });
  const selection = selectionFor ? selectionFor({ preparation, comparison }) : createMigrationSelection({ preparation, comparison, ...(admission ? { admission } : {}), checkpoint });
  const sourceDirOf = profileId => registry.storeFor(profileId).storeDir;
  const backupDirOf = profileId => path.join(userData, 'migration-backups', profileId);
  function status(profileId) {
    const sourceDir = sourceDirOf(profileId), destinationDir = backupDirOf(profileId);
    const record = preparation.inspect?.(profileId) ?? null;
    const backup = fs.existsSync(path.join(destinationDir, 'intent.json'));
    const staged = backup && fs.existsSync(path.join(destinationDir, 'staging', 'complete.json'));
    return { profileId, preparation: record?.phase ?? null, backup, staged, selection: selection.inspect(profileId, sourceDir), destinationDir };
  }
  async function withRuntime(profileId, fn) {
    const lease = await runtimePool.acquire(profileId, { ownerId: 'migration-switch', writes: true });
    try {
      const { server, token, dataset } = lease.connection;
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) fail('switch_runtime', 'The library switch needs this profile’s own managed runtime');
      const target = { profileId, runtimeId: 'managed-' + profileId, server, dataset: dataset || 'production', token, assertOwned: async () => true };
      return await fn(target);
    } finally { await lease.release(); }
  }
  function options(profileId) {
    const sourceDir = sourceDirOf(profileId), destinationDir = backupDirOf(profileId);
    return { profileId, sourceDir, destinationDir, quiesced: true, metadata: generatedLabels(sourceDir) };
  }
  // The publish wall needs every tag to exist as a published `tag` document. Ensuring
  // the one generated tag is a target-library write before the hold, never a legacy write.
  async function ensureTag(target) {
    const response = await fetch(target.server + '/v1/data/mutate/' + target.dataset, { method: 'POST', headers: { authorization: 'Bearer ' + target.token, 'content-type': 'application/json' },
      body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'migrated', _type: 'tag', title: 'Migrated' } }, { publish: { id: 'migrated', type: 'tag' } }] }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) fail('switch_tag', 'The migrated tag could not be published on the runtime: ' + response.status + ' ' + (await response.text()).slice(0, 200));
  }
  // Prepare → backup → baseline → stage → select. Every step is journaled by its owner
  // and idempotent, so a retry after an interruption continues where it stopped.
  async function switchToPaper(profileId) {
    const current = status(profileId);
    if (current.selection.status === 'selected') return status(profileId);
    if (['rolling-back', 'rolled-back', 'blocked'].includes(current.selection.status)) fail('switch_state', `The switch cannot continue from ${current.selection.status}; inspect or roll back first`);
    if (current.preparation !== 'prepared') fail('switch_preparation', 'Prepare this profile first: it fences the foreground, drafts and captured writers');
    return withRuntime(profileId, async target => {
      const opts = options(profileId);
      const resuming = ['intent', 'replacing'].includes(current.selection.status);
      if (resuming) {
        // The workspace may already be replaced, so the source no longer matches its
        // backup by design; the recorded intent carries the pinned source hash.
        const intent = createStore(opts.destinationDir, { create: false }).readJson('intent.json', null);
        if (!intent?.sourceHash) fail('switch_backup', 'The backup intent for this switch is missing; inspect the backup before resuming');
        opts.expectedSourceHash = intent.sourceHash;
      } else {
        const manifest = prepareMigration(opts);
        if (manifest.status !== 'prepared' || manifest.issues?.length) fail('switch_preflight', 'Unsupported source content: ' + (manifest.issues?.[0]?.reason || manifest.status));
        opts.expectedSourceHash = manifest.sourceHash;
        checkpoint('after-backup', { profileId });
      }
      let baseline;
      if (!resuming) {
        const store = createStore(opts.destinationDir, { create: false });
        const staged = fs.existsSync(store.filePath('staging')) && fs.readdirSync(store.filePath('staging')).length > 0;
        if (!staged) { await ensureTag(target); baseline = await comparison.captureBaseline(opts, target); checkpoint('after-baseline', { profileId }); }
        const existing = store.readJson('comparison-baseline.json', null);
        opts.expectedBaselineHash = baseline?.baselineHash || (existing ? require('./migration-journal').hash(existing) : null);
        await stage(opts, target, { checkpoint: phase => checkpoint('staging:' + phase, { profileId }) });
        checkpoint('after-staging', { profileId });
      } else {
        const existing = createStore(opts.destinationDir, { create: false }).readJson('comparison-baseline.json', null);
        opts.expectedBaselineHash = existing ? require('./migration-journal').hash(existing) : null;
      }
      const selected = await selection.select(opts, target);
      checkpoint('after-selection', { profileId, status: selected.status });
      return status(profileId);
    });
  }
  async function rollback(profileId) {
    const current = status(profileId);
    if (['none', 'rolled-back'].includes(current.selection.status)) return current;
    if (current.preparation !== 'prepared') fail('switch_preparation', 'Prepare this profile first so the rollback runs under the same fences as the switch');
    return withRuntime(profileId, async target => {
      const opts = options(profileId);
      const store = createStore(opts.destinationDir, { create: false });
      const intent = store.readJson('intent.json', null);
      opts.expectedSourceHash = intent?.sourceHash ?? null;
      const existing = store.readJson('comparison-baseline.json', null);
      opts.expectedBaselineHash = existing ? require('./migration-journal').hash(existing) : null;
      await selection.rollback(opts, target);
      return status(profileId);
    });
  }
  return Object.freeze({ status, switchToPaper, rollback, generatedLabels: profileId => generatedLabels(sourceDirOf(profileId)) });
}
module.exports = { createMigrationSwitch, generatedLabels };
