// Offline staging only: never changes navigation authority or deletes source data.
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('./store');
const { acquireFileLease } = require('./file-lease');
const { prepareMigration, inventoryProfile } = require('./migration-preflight');
const { migrationBlocks } = require('./migration-images');
const { stageMedia } = require('./migration-media');

const { canonical, hash, fail, record, read } = require('./migration-journal');

function captureTarget(target, profileId) {
  if (target?.profileId !== profileId || typeof target.runtimeId !== 'string' || !target.runtimeId.trim()) fail('target_owner', 'A captured runtime identity for this profile is required');
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(target.server || '') || target.dataset !== 'production') fail('target_scope', 'Staging currently requires an owned loopback runtime and production dataset');
  if (typeof target.token !== 'string' || !target.token || typeof target.assertOwned !== 'function') fail('target_owner', 'Runtime credentials and an ownership assertion are required');
  const binding = Object.freeze({ profileId, runtimeId: target.runtimeId, server: target.server, dataset: target.dataset });
  const token = target.token, assertOwned = target.assertOwned;
  async function ownedFetch(route, init = {}) {
    if (await assertOwned(binding) !== true) fail('target_owner', 'The captured local runtime is no longer owned by this profile');
    return fetch(binding.server + route, { ...init, redirect: 'error', headers: { ...init.headers, authorization: 'Bearer ' + token, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
  }
  async function request(method, route, body) {
    const response = await ownedFetch(route, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let data;
    try { data = await response.json(); } catch { fail('invalid_response', 'Paper endpoint returned invalid JSON'); }
    return { status: response.status, data: data?.result || data };
  }
  return { binding, request, fetch: ownedFetch, async assertCurrent() { if (await assertOwned(binding) !== true) fail('target_owner', 'The captured runtime ownership changed'); } };
}

function payloads(manifest, store, metadata, media = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('metadata_required', 'Supply reviewed publishing metadata for every document');
  if (Object.keys(metadata).some(id => !manifest.documents.some(doc => doc.id === id))) fail('metadata_changed', 'Publishing metadata names an unknown source document');
  return manifest.documents.map(doc => {
    const source = JSON.parse(fs.readFileSync(store.filePath('source/documents/' + doc.id + '.json'), 'utf8'));
    const labels = metadata[doc.id];
    if (!labels || typeof labels.description !== 'string' || !labels.description.trim() || !Array.isArray(labels.tags) || !labels.tags.length || Object.keys(labels).some(k => !['description', 'tags'].includes(k))) fail('metadata_required', 'Reviewed description and registered tags required for ' + doc.id);
    const blocks = migrationBlocks(source.content, doc.references, doc.images, media).map((block, i) => ({ ...block, id: 'migration-' + i }));
    return { id: doc.id, targetId: doc.targetId, sourceHash: doc.sourceHash, payload: {
      slug: doc.targetId, title: source.title, style: 'article', description: labels.description,
      tags: structuredClone(labels.tags), blocks,
      source_doc: `barkdown-migration:v1:${manifest.profileId}:${doc.id}:${doc.sourceHash}`,
    } };
  });
}

function validateJournal(store, documents, planHash, record = require('./migration-journal').record) {
  const journal = documents.map(doc => {
      const intentName = 'staging/' + doc.targetId + '.intent.json';
      const receiptName = 'staging/' + doc.targetId + '.receipt.json';
      const intent = { version: 1, planHash, id: doc.id, targetId: doc.targetId, payloadHash: hash(doc.payload) };
      const existingIntent = read(store, intentName), existingReceipt = read(store, receiptName);
      if (existingIntent) record(store, intentName, intent);
      if (existingReceipt) {
        if (!existingIntent) fail('journal_corrupt', 'A receipt has no durable write intent');
        if (typeof existingReceipt.revision !== 'string' || !existingReceipt.revision || !Number.isSafeInteger(existingReceipt.paperRevision) || existingReceipt.paperRevision < 1) fail('journal_corrupt', 'Invalid recorded Paper revision');
        const expected = { ...doc.payload }; delete expected.slug;
        record(store, receiptName, { ...intent, payloadHash: hash(expected), revision: existingReceipt.revision, paperRevision: existingReceipt.paperRevision });
      }
      return { doc, intentName, receiptName, intent, existingIntent, existingReceipt };
    });
  const completed = read(store, 'staging/complete.json');
    if (completed) {
      if (journal.some(item => !item.existingReceipt)) fail('journal_corrupt', 'Completed staging has missing receipts');
      record(store, 'staging/complete.json', { version: 1, planHash, status: 'staged', authority: 'legacy', documents: journal.map(item => item.existingReceipt) });
    }
  return journal;
}

async function stageMigration(options, target, { checkpoint = () => {}, retryAbsent = false } = {}) {
  const captured = captureTarget(target, options.profileId);
  const manifest = prepareMigration(options);
  if (manifest.status !== 'prepared' || manifest.issues.length) fail('preflight_blocked', 'Unsupported source content; no Paper writes were attempted');
  const store = createStore(path.resolve(options.destinationDir), { create: false });
  fs.mkdirSync(store.filePath('staging'), { recursive: true });
  const lease = acquireFileLease(store.filePath('staging/owner.lock'), { completeOwner: true, busy: 'Another migration staging process owns this backup' });
  try {
    const pendingMedia = Object.fromEntries(manifest.documents.flatMap(doc => doc.images || []).map(image => [image.path, 'migration-pending:' + image.path]));
    // Validate publishing metadata and conversion before any media mutation.
    payloads(manifest, store, options.metadata, pendingMedia);
    function sourceUnchanged() {
      lease.assertOwned();
      if (inventoryProfile(options).sourceHash !== manifest.sourceHash) fail('source_changed', 'Source changed during media staging');
    }
    const media = await stageMedia({ manifest, store, captured, checkpoint, unchanged: sourceUnchanged, beforeNetwork(mapping) {
      const existingPlan = read(store, 'staging/plan.json');
      if (!existingPlan) {
        if (fs.readdirSync(store.filePath('staging')).some(name => name !== 'owner.lock' && !/^owner\.lock\.abandoned-[a-f0-9-]{36}$/.test(name) && !name.endsWith('.tmp'))) fail('journal_corrupt', 'Paper journal exists without its plan');
        return;
      }
      if (Object.keys(pendingMedia).some(key => !mapping[key])) fail('journal_corrupt', 'Paper plan exists before all media receipts');
      const documents = payloads(manifest, store, options.metadata, mapping);
      const plan = { version: 1, sourceHash: manifest.sourceHash, target: captured.binding, documents };
      record(store, 'staging/plan.json', plan);
      validateJournal(store, documents, hash(plan));
    } });
    const documents = payloads(manifest, store, options.metadata, media.urls);
    const plan = { version: 1, sourceHash: manifest.sourceHash, target: captured.binding, documents };
    record(store, 'staging/plan.json', plan);
    await checkpoint('plan');
    const planHash = hash(plan), receipts = [];
    // Validate the entire recovery journal before touching any target. In
    // particular, null is corruption, not a missing record, and a completed
    // batch may never fill in missing receipts by publishing again.
    const journal = validateJournal(store, documents, planHash);
    function unchanged() {
      lease.assertOwned();
      if (inventoryProfile(options).sourceHash !== manifest.sourceHash) fail('source_changed', 'Source changed during staging; retain staged Papers for reconciliation');
      record(store, 'staging/plan.json', plan);
    }
    async function lookup(id) {
      const perspective = id.startsWith('drafts.') ? 'raw' : 'published';
      const response = await captured.request('GET', `/v1/data/doc/production/paper/${encodeURIComponent(id)}?perspective=${perspective}`);
      if (response.status === 404 && response.data?.error?.code === 'not_found') return null;
      if (response.status !== 200) fail('read_refused', 'Paper readback refused or unavailable: ' + response.status);
      if (response.data?._id !== id || response.data?._type !== 'paper') fail('read_identity', 'Paper readback returned a different identity');
      return response.data;
    }
    async function current(doc) {
      const published = await lookup(doc.targetId);
      if (await lookup('drafts.' + doc.targetId)) fail('draft_conflict', 'A draft owns the target; preserve both copies for review');
      return published;
    }
    function compare(doc, saved) {
      const expected = { ...doc.payload }; delete expected.slug;
      const actual = Object.fromEntries(Object.keys(expected).map(key => [key, saved?.[key]]));
      if (canonical(actual) !== canonical(expected)) fail('target_conflict', 'Saved Paper identity or structured content differs: ' + doc.id);
      if (!Number.isSafeInteger(saved.rev) || saved.rev < 1 || typeof saved._rev !== 'string' || !saved._rev) fail('invalid_revision', 'Saved Paper has no valid acknowledged revision');
      return { version: 1, planHash, id: doc.id, targetId: doc.targetId, payloadHash: hash(expected), revision: saved._rev, paperRevision: saved.rev };
    }
    for (const { doc, intentName, receiptName, intent, existingIntent, existingReceipt } of journal) {
      unchanged();
      let saved = await current(doc);
      if (existingReceipt) {
        if (!saved) fail('target_missing', 'A previously verified Paper is missing; do not recreate it');
        const receipt = compare(doc, saved);
        record(store, receiptName, receipt);
        receipts.push(receipt);
        continue;
      }
      if (saved && !existingIntent) fail('target_exists', 'An existing Paper has no owned write intent; do not adopt it');
      if (!saved) {
        if (existingIntent && retryAbsent !== true) fail('write_uncertain', 'Intent exists but target is absent; explicit reconciliation is required before retry');
        record(store, intentName, intent);
        await checkpoint('intent:' + doc.id);
        unchanged();
        let response;
        try { response = await captured.request('POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(doc.targetId)}/create`, doc.payload); }
        catch (error) {
          // A transport failure says nothing about commit. Retain the intent;
          // readback on resume decides whether this exact Paper was created.
          fail('write_uncertain', 'Paper response was lost; durable intent retained (' + (error.code || 'transport') + ')');
        }
        await checkpoint('response:' + doc.id);
        if (response.status !== 201 && !(response.status === 409 && response.data?.error?.code === 'paper_exists')) {
          const code = response.data?.error?.code;
          const message = typeof response.data?.error?.message === 'string' ? response.data.error.message.slice(0, 300) : '';
          fail('create_refused', 'Create-only Paper write refused: ' + response.status + (typeof code === 'string' && /^[a-z_]+$/.test(code) ? ' (' + code + ')' : '') + (message ? ': ' + message : ''));
        }
        saved = await current(doc);
        if (!saved) fail('write_uncertain', 'Create returned without a readable target; retain intent');
        if (response.status === 201 && (response.data.slug !== doc.targetId || String(response.data.rev) !== String(saved.rev))) fail('invalid_receipt', 'Create acknowledgement disagrees with readback');
      }
      const receipt = compare(doc, saved);
      await checkpoint('readback:' + doc.id);
      unchanged();
      record(store, receiptName, receipt);
      receipts.push(receipt);
      await checkpoint('receipt:' + doc.id);
    }
    await checkpoint('before-complete');
    unchanged();
    // A previous receipt is evidence of a particular revision, not permission
    // to accept a subsequently edited or missing target during a later resume.
    for (const doc of documents) {
      const saved = await current(doc);
      if (!saved) fail('target_missing', 'A staged Paper disappeared before completion');
      record(store, 'staging/' + doc.targetId + '.receipt.json', compare(doc, saved));
    }
    await media.verify();
    unchanged();
    const result = { version: 1, planHash, status: 'staged', authority: 'legacy', documents: receipts };
    record(store, 'staging/complete.json', result);
    return result;
  } finally { lease.release(); }
}

module.exports = { stageMigration, captureTarget, payloads, validateJournal };
