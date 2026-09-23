// Offline staging only: never changes navigation authority or deletes source data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { acquireFileLease } = require('./file-lease');
const { prepareMigration, inventoryProfile } = require('./migration-preflight');
const { pmDocToBlocks } = require('../shared/portabledoc');

const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

// Exclusive, fsynced publication. Existing journal records are checked, never
// replaced. Directory fsync/power-loss durability remains outside this slice.
function record(store, name, value) {
  const target = store.filePath(name), text = canonical(value) + '\n';
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = store.filePath(name + '.' + crypto.randomUUID() + '.tmp');
    const fd = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.linkSync(temp, store.filePath(name)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    finally { fs.unlinkSync(temp); }
  }
  if (fs.readFileSync(store.filePath(name), 'utf8') !== text) fail('journal_changed', 'Staging record differs: ' + name);
  return value;
}
function read(store, name) {
  const file = store.filePath(name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { fail('journal_corrupt', 'Unreadable staging record: ' + name); }
}

function captureTarget(target, profileId) {
  if (target?.profileId !== profileId || typeof target.runtimeId !== 'string' || !target.runtimeId.trim()) fail('target_owner', 'A captured runtime identity for this profile is required');
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(target.server || '') || target.dataset !== 'production') fail('target_scope', 'Staging currently requires an owned loopback runtime and production dataset');
  if (typeof target.token !== 'string' || !target.token || typeof target.assertOwned !== 'function') fail('target_owner', 'Runtime credentials and an ownership assertion are required');
  const binding = Object.freeze({ profileId, runtimeId: target.runtimeId, server: target.server, dataset: target.dataset });
  const token = target.token, assertOwned = target.assertOwned;
  async function request(method, route, body) {
    if (await assertOwned(binding) !== true) fail('target_owner', 'The captured local runtime is no longer owned by this profile');
    const response = await fetch(binding.server + route, { method, redirect: 'error', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'cache-control': 'no-cache' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    let data;
    try { data = await response.json(); } catch { fail('invalid_response', 'Paper endpoint returned invalid JSON'); }
    return { status: response.status, data: data?.result || data };
  }
  return { binding, request };
}

function payloads(manifest, store, metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail('metadata_required', 'Supply reviewed publishing metadata for every document');
  if (Object.keys(metadata).some(id => !manifest.documents.some(doc => doc.id === id))) fail('metadata_changed', 'Publishing metadata names an unknown source document');
  return manifest.documents.map(doc => {
    const source = JSON.parse(fs.readFileSync(store.filePath('source/documents/' + doc.id + '.json'), 'utf8'));
    const labels = metadata[doc.id];
    if (!labels || typeof labels.description !== 'string' || !labels.description.trim() || !Array.isArray(labels.tags) || !labels.tags.length || Object.keys(labels).some(k => !['description', 'tags'].includes(k))) fail('metadata_required', 'Reviewed description and registered tags required for ' + doc.id);
    const blocks = pmDocToBlocks(source.content).map((block, i) => ({ ...block, id: 'migration-' + i }));
    return { id: doc.id, targetId: doc.targetId, sourceHash: doc.sourceHash, payload: {
      slug: doc.targetId, title: source.title, style: 'article', description: labels.description,
      tags: structuredClone(labels.tags), blocks,
      source_doc: `barkdown-migration:v1:${manifest.profileId}:${doc.id}:${doc.sourceHash}`,
    } };
  });
}

async function stageMigration(options, target, { checkpoint = () => {}, retryAbsent = false } = {}) {
  const captured = captureTarget(target, options.profileId);
  const manifest = prepareMigration(options);
  if (manifest.status !== 'prepared' || manifest.issues.length) fail('preflight_blocked', 'Unsupported source content; no Paper writes were attempted');
  const store = createStore(path.resolve(options.destinationDir), { create: false });
  fs.mkdirSync(store.filePath('staging'), { recursive: true });
  const lease = acquireFileLease(store.filePath('staging/owner.lock'), { completeOwner: true, busy: 'Another migration staging process owns this backup' });
  try {
    const documents = payloads(manifest, store, options.metadata);
    const plan = { version: 1, sourceHash: manifest.sourceHash, target: captured.binding, documents };
    record(store, 'staging/plan.json', plan);
    await checkpoint('plan');
    const planHash = hash(plan), receipts = [];
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
    for (const doc of documents) {
      unchanged();
      const intentName = 'staging/' + doc.targetId + '.intent.json';
      const receiptName = 'staging/' + doc.targetId + '.receipt.json';
      const intent = { version: 1, planHash, id: doc.id, targetId: doc.targetId, payloadHash: hash(doc.payload) };
      const existingIntent = read(store, intentName), existingReceipt = read(store, receiptName);
      if (existingReceipt && !existingIntent) fail('journal_corrupt', 'A receipt has no durable write intent');
      if (existingIntent) record(store, intentName, intent);
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
        if (![201, 409].includes(response.status)) fail('create_refused', 'Create-only Paper write refused: ' + response.status);
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
    const result = { version: 1, planHash, status: 'staged', authority: 'legacy', documents: receipts };
    record(store, 'staging/complete.json', result);
    return result;
  } finally { lease.release(); }
}

module.exports = { stageMigration };
