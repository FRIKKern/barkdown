// Internal rehearsal evidence only. A successful comparison never selects an engine.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inventoryProfile } = require('./migration-preflight');
const { validateBackup } = require('./migration-restore');
const { projectWorkspace } = require('./migration-workspace');
const { captureTarget, payloads, validateJournal } = require('./migration-staging');
const { stageMedia } = require('./migration-media');
const { readCatalog } = require('./paper-catalog');
const { pngInfo } = require('./migration-images');
const { canonical, hash, fail, read, record, verifyRecord } = require('./migration-journal');
const baselineName = 'comparison-baseline.json';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (a, b, message) => { if (canonical(a) !== canonical(b)) fail('comparison_changed', message); };

async function boundedBytes(response, max) {
  if (!response.body) fail('comparison_response', 'Missing response body');
  const reader = response.body.getReader(), parts = []; let length = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.length;
      if (length > max) { await reader.cancel(); fail('comparison_limit', 'Comparison response exceeds its byte limit'); }
      parts.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}

function sourceState(options) {
  const snapshot = inventoryProfile(options);
  if (snapshot.issues.length) fail('comparison_source', 'Source has unsupported content');
  if (snapshot.sourceHash !== options.expectedSourceHash) fail('comparison_source', 'Source differs from the pinned backup');
  const backup = validateBackup({ profileId: options.profileId, backupDir: options.destinationDir, expectedSourceHash: options.expectedSourceHash });
  const manifest = read(backup.store, 'manifest.json');
  same(manifest.documents, snapshot.documents, 'Backup document mapping differs from the source');
  if (manifest.status !== 'prepared' || manifest.issues?.length) fail('comparison_source', 'Backup is not eligible for comparison');
  const workspace = projectWorkspace(options);
  if (workspace.status !== 'preview') fail('comparison_workspace', workspace.issues.map(i => i.reason).join('; '));
  return { snapshot, backup, manifest, workspace };
}

function createMigrationComparison({ preparation }) {
  if (typeof preparation?.withPrepared !== 'function') throw new TypeError('A live preparation coordinator is required');
  async function run(input, target, capture) {
    // Callers cannot change source paths/metadata while an asynchronous read is pending.
    const options = structuredClone(input);
    return preparation.withPrepared(options.profileId, async scope => {
      if (path.resolve(options.sourceDir) !== scope.sourceDir) fail('comparison_source', 'Source does not belong to the live preparation');
      const initial = sourceState(options), store = initial.backup.store;
      const owned = captureTarget(target, options.profileId);
      const identity = { profileId: options.profileId, preparationId: scope.preparation.id,
        closureId: scope.preparation.closureId, writer: scope.preparation.writerAfter,
        draftKeys: scope.preparation.draftKeys, target: owned.binding,
        sourceHash: options.expectedSourceHash, manifestHash: initial.backup.manifestHash,
        projectionHash: initial.workspace.projectionHash };
      async function guard() { await scope.assertCurrent(); await owned.assertCurrent(); }
      function unchanged() {
        const current = sourceState(options);
        same([current.backup.manifestHash, current.workspace.projectionHash], [identity.manifestHash, identity.projectionHash], 'Source or workspace changed during comparison');
      }
      const captured = { binding: owned.binding, async fetch(route, init) {
        if (init?.method && init.method !== 'GET') fail('comparison_write', 'Comparison cannot mutate the runtime');
        await guard(); return owned.fetch(route, init);
      } };
      async function json(route) {
        const response = await captured.fetch(route);
        const bytes = await boundedBytes(response, 32 * 1024 * 1024);
        await guard();
        if (response.status !== 200) fail('comparison_read', 'Comparison read unavailable: ' + response.status);
        let value; try { value = JSON.parse(bytes); } catch { fail('comparison_response', 'Invalid comparison JSON'); }
        return value?.result ?? value;
      }
      async function corpus() {
        const rows = new Map(); let bytes = 0;
        for (const perspective of ['published', 'drafts']) {
          const listing = await readCatalog(({ limit, offset }) => json(`/v1/data/query/production/paper?limit=${limit}&offset=${offset}&order=_createdAt:asc&perspective=${perspective}&count=true`), {}, perspective);
          for (const summary of listing) {
            const id = summary._id;
            if (!/^(?:drafts\.)?[\w-]{1,128}$/.test(id)) fail('comparison_identity', 'Unsupported Paper identity');
            // No fields projection: the bounded query returns complete structured rows.
            // Reconcile a second full traversal instead of an N+1 read per note.
            const value = summary;
            if (value._id !== id || value._type !== 'paper' || typeof value._rev !== 'string' || !value._rev ||
              !Number.isSafeInteger(value.rev) || value.rev < 0 || !Array.isArray(value.blocks) ||
              Boolean(value._draft) !== id.startsWith('drafts.')) fail('comparison_identity', 'Paper read changed identity or has no valid structured revision');
            if (rows.has(id)) same(rows.get(id), value, 'A fallback variant changed between perspectives');
            else { bytes += Buffer.byteLength(canonical(value)); if (bytes > 32 * 1024 * 1024) fail('comparison_limit', 'Corpus exceeds the comparison byte budget'); rows.set(id, value); }
          }
        }
        return [...rows.values()].sort((a, b) => a._id.localeCompare(b._id, 'en'));
      }
      async function mediaFor(rows) {
        const paths = new Set();
        function visit(value) {
          if (!value || typeof value !== 'object') return;
          if (['file', 'video', 'audio', 'embed'].includes(value.type)) fail('comparison_media', 'Existing media format is not supported by comparison');
          if (value.type === 'image') {
            if (typeof value.src !== 'string') fail('comparison_media', 'Image has no exact source');
            let url; try { url = new URL(value.src, owned.binding.server); } catch { fail('comparison_media', 'Invalid image URL'); }
            if (url.origin !== owned.binding.server || url.search || url.hash || !/^\/media\/files\/[a-zA-Z0-9_./-]+$/.test(url.pathname) || url.pathname.split('/').some(p => p === '.' || p === '..')) fail('comparison_media', 'Only captured-origin media files can be compared');
            paths.add(url.pathname);
          }
          for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
        }
        rows.forEach(row => visit(row.blocks));
        const result = []; let total = 0;
        for (const path of [...paths].sort()) {
          const response = await captured.fetch(path);
          if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0] !== 'image/png') fail('comparison_media', 'Referenced PNG is missing or unsupported');
          const bytes = await boundedBytes(response, 20 * 1024 * 1024); await guard(); pngInfo(bytes);
          total += bytes.length; if (total > 256 * 1024 * 1024) fail('comparison_limit', 'Media exceeds the comparison byte budget');
          result.push({ path, bytes: bytes.length, sha256: sha(bytes) });
        }
        return result;
      }
      function unstaged() {
        for (const dir of ['staging', 'media']) if (fs.existsSync(store.filePath(dir)) && fs.readdirSync(store.filePath(dir)).length) fail('comparison_baseline', 'Capture the baseline before staging; existing journals cannot reconstruct it');
      }
      await guard(); unchanged();
      if (capture) {
        unstaged();
        const rows = await corpus(), media = await mediaFor(rows);
        const targets = new Set(initial.manifest.documents.flatMap(d => [d.targetId, 'drafts.' + d.targetId]));
        if (rows.some(row => targets.has(row._id))) fail('comparison_baseline', 'A migration target already exists before baseline capture');
        same(await corpus(), rows, 'Library changed during baseline capture');
        same(await mediaFor(rows), media, 'Media changed during baseline capture');
        await guard(); unchanged(); unstaged();
        const baseline = { version: 1, identity, rows, media };
        record(store, baselineName, baseline);
        return { status: 'captured', baselineHash: hash(baseline), documents: rows.length, authority: 'legacy', activationAllowed: false };
      }
      const baseline = read(store, baselineName);
      if (baseline?.version !== 1 || !Array.isArray(baseline.rows) || !Array.isArray(baseline.media)) fail('comparison_baseline', 'Missing complete pre-staging baseline');
      if (!/^[a-f0-9]{64}$/.test(options.expectedBaselineHash || '') || hash(baseline) !== options.expectedBaselineHash) fail('comparison_baseline', 'A caller-pinned baseline hash is required');
      same(baseline.identity, identity, 'Baseline belongs to a different preparation, source or runtime');
      function journalHash() {
        const entries = [];
        for (const dir of ['staging', 'media']) {
          const folder = store.filePath(dir);
          if (!fs.existsSync(folder)) continue;
          for (const name of fs.readdirSync(folder).sort()) {
            const file = store.filePath(dir + '/' + name);
            if (!name.endsWith('.json') || !fs.lstatSync(file).isFile()) fail('comparison_journal', 'Journal is active or has unrecognized files');
            entries.push([dir + '/' + name, sha(fs.readFileSync(file))]);
          }
        }
        return hash(entries);
      }
      const journals = journalHash();
      const media = await stageMedia({ manifest: initial.manifest, store, captured, checkpoint: async () => guard(), unchanged, beforeNetwork: () => {}, verifyOnly: true });
      const documents = payloads(initial.manifest, store, options.metadata, media.urls);
      const plan = { version: 1, sourceHash: options.expectedSourceHash, target: owned.binding, documents };
      verifyRecord(store, 'staging/plan.json', plan);
      const journal = validateJournal(store, documents, hash(plan), verifyRecord);
      if (journal.some(item => !item.existingIntent || !item.existingReceipt) || !read(store, 'staging/complete.json')) fail('comparison_journal', 'Every staged document needs its completed receipt');
      const rows = await corpus(), byId = new Map(rows.map(row => [row._id, row]));
      const expectedIds = new Set();
      for (const row of baseline.rows) {
        if (!row || typeof row._id !== 'string' || expectedIds.has(row._id)) fail('comparison_baseline', 'Invalid or duplicate baseline identity');
        expectedIds.add(row._id); same(byId.get(row._id), row, 'A pre-existing Paper changed or disappeared: ' + row._id);
      }
      for (const { doc, existingReceipt } of journal) {
        if (expectedIds.has(doc.targetId)) fail('comparison_baseline', 'Baseline overlaps a staged target');
        expectedIds.add(doc.targetId);
        const saved = byId.get(doc.targetId), expected = { ...doc.payload }; delete expected.slug;
        if (!saved) fail('comparison_target', 'A staged Paper disappeared: ' + doc.id);
        same(Object.fromEntries(Object.keys(expected).map(k => [k, saved[k]])), expected, 'Staged content differs: ' + doc.id);
        same([saved._rev, saved.rev], [existingReceipt.revision, existingReceipt.paperRevision], 'Staged revisions differ: ' + doc.id);
      }
      if (rows.length !== expectedIds.size || rows.some(row => !expectedIds.has(row._id))) fail('comparison_target', 'Unexpected Paper or draft twin in the library');
      const assets = await mediaFor(rows);
      for (const asset of baseline.media) same(assets.find(a => a.path === asset.path), asset, 'Pre-existing media changed');
      same(await corpus(), rows, 'Library changed during comparison');
      same(await mediaFor(rows), assets, 'Media changed during comparison');
      await media.verify(); unchanged(); await guard();
      verifyRecord(store, baselineName, baseline); verifyRecord(store, 'staging/plan.json', plan);
      validateJournal(store, documents, hash(plan), verifyRecord);
      same(journalHash(), journals, 'Journals changed during comparison');
      return { version: 1, status: 'compared', identity, baselineHash: hash(baseline), planHash: hash(plan),
        corpusHash: hash(rows), mediaHash: hash(assets), documents: rows.length, staged: documents.length,
        preserved: baseline.rows.length, media: assets.length, workspaceHash: initial.workspace.projectionHash,
        authority: 'legacy', activationAllowed: false, limits: ['Observed reads are not a server snapshot or a fence for direct upstream clients.'] };
    });
  }
  return Object.freeze({ captureBaseline: (options, target) => run(options, target, true), compare: (options, target) => run(options, target, false) });
}
module.exports = { createMigrationComparison };
