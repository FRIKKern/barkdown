// A single owned upload attempt, reconciled by exact filename and byte readback.
// Missing/ambiguous results never authorize another upload or any deletion.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { canonical, hash, fail, record, read } = require('./migration-journal');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function receiptFor(intent, asset, server) {
  if (!asset || !uuid.test(asset.id || '') || asset.mediaFileId !== asset.id || asset.dataset !== 'production' || asset.originalName !== intent.filename || asset.mimeType !== 'image/png' || asset.size !== intent.asset.bytes) fail('media_identity', 'Media metadata differs from the owned upload attempt');
  if (typeof asset.path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(asset.path) || asset.path.split('/').some(part => !part || part === '.' || part === '..') || asset.originalUrl !== '/media/files/' + asset.path || asset.url !== asset.originalUrl) fail('media_path', 'Media delivery must use an exact captured-origin path');
  return { ...intent, id: asset.id, path: asset.path, url: server + asset.originalUrl, mime: asset.mimeType, bytes: asset.size, sha256: intent.asset.sha256 };
}

async function stageMedia({ manifest, store, captured, checkpoint, unchanged, beforeNetwork, verifyOnly = false }) {
  const record = verifyOnly ? require('./migration-journal').verifyRecord : require('./migration-journal').record;
  const assets = [...new Map(manifest.documents.flatMap(doc => doc.images || []).map(({ src, ...asset }) => [asset.path, asset])).values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!assets.length) { beforeNetwork({}); return { urls: {}, verify: async () => {} }; }
  const plan = { version: 1, sourceHash: manifest.sourceHash, target: captured.binding, assets };
  const folder = store.filePath('media');
  if (!fs.existsSync(folder)) { if (verifyOnly) fail('journal_corrupt', 'Missing completed media journal'); fs.mkdirSync(folder); }
  if (!fs.existsSync(store.filePath('media/plan.json')) && fs.readdirSync(folder).length) fail('journal_corrupt', 'Media records survive without their owning plan');
  record(store, 'media/plan.json', plan);
  const planHash = hash(plan);
  const entries = assets.map(asset => {
    const key = hash(asset.path).slice(0,32), intentName = `media/${key}.intent.json`, receiptName = `media/${key}.receipt.json`;
    const intent = read(store, intentName), receipt = read(store, receiptName);
    if (intent) {
      if (!/^bdm[a-f0-9]{40}\.png$/.test(intent.filename || '')) fail('journal_corrupt', 'Invalid owned upload filename');
      record(store, intentName, { version: 1, planHash, asset, filename: intent.filename });
    }
    if (receipt) {
      if (!intent) fail('journal_corrupt', 'Media receipt has no owned intent');
      const expected = receiptFor(intent, { id: receipt.id, mediaFileId: receipt.id, dataset: 'production', originalName: intent.filename, mimeType: receipt.mime, size: receipt.bytes, path: receipt.path, originalUrl: '/media/files/'+receipt.path, url: '/media/files/'+receipt.path }, captured.binding.server);
      record(store, receiptName, expected);
    }
    return { asset, intentName, receiptName, intent, receipt };
  });
  if (verifyOnly && entries.some(e => !e.intent || !e.receipt)) fail('journal_corrupt', 'Read-only comparison requires every media receipt');
  const completed = read(store, 'media/complete.json');
  if (verifyOnly && !completed) fail('journal_corrupt', 'Read-only comparison requires completed media');
  if (completed) {
    if (entries.some(entry => !entry.receipt)) fail('journal_corrupt', 'Completed media has missing receipts');
    record(store, 'media/complete.json', { version: 1, planHash, receipts: entries.map(e => e.receipt) });
  }
  // Validate any already-written Paper plans/receipts before reading a target.
  beforeNetwork(Object.fromEntries(entries.filter(e => e.receipt).map(e => [e.asset.path,e.receipt.url])));
  await checkpoint('media-plan');
  async function json(route, init) {
    const response = await captured.fetch(route, init);
    let data;
    try { data = await response.json(); } catch { fail('media_response', 'Media endpoint returned invalid JSON'); }
    return { status: response.status, data: data?.result || data };
  }
  async function candidates(intent) {
    const response = await json('/v1/media/production?limit=50&q=' + intent.filename.slice(0,-4));
    const data = response.data;
    if (response.status !== 200 || !Array.isArray(data.assets) || data.hasMore !== false || !Number.isSafeInteger(data.total) || data.total !== data.assets.length) fail('media_lookup', 'Media candidate search is incomplete or unavailable');
    return data.assets.filter(asset => asset.originalName === intent.filename);
  }
  async function verify(intent, asset) {
    const expected = receiptFor(intent, asset, captured.binding.server);
    const response = await json('/v1/media/production/' + expected.id);
    if (response.status !== 200) fail('media_missing', 'Owned media is missing or unavailable; do not upload again');
    const actual = receiptFor(intent, response.data, captured.binding.server);
    if (canonical(expected) !== canonical(actual)) fail('media_identity', 'Media lookup changed the owned identity');
    const binary = await captured.fetch('/media/files/' + expected.path);
    if (binary.status !== 200 || binary.headers.get('content-type')?.split(';')[0] !== 'image/png') fail('media_bytes', 'Media bytes are unavailable or have a different type');
    const reader = binary.body?.getReader();
    if (!reader) fail('media_bytes', 'Media response has no bytes');
    const chunks = []; let length = 0;
    try {
      for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.length; if (length > intent.asset.bytes) { await reader.cancel(); fail('media_bytes', 'Media is larger than its source'); } chunks.push(next.value); }
    } finally { reader.releaseLock(); }
    if (length !== intent.asset.bytes || digest(Buffer.concat(chunks)) !== intent.asset.sha256) fail('media_bytes', 'Media byte hash differs from captured source');
    return expected;
  }
  const receipts = [];
  for (const entry of entries) {
    await unchanged(); record(store, 'media/plan.json', plan);
    let { intent } = entry;
    if (!intent) {
      intent = { version: 1, planHash, asset: entry.asset, filename: 'bdm' + crypto.randomBytes(20).toString('hex') + '.png' };
      if ((await candidates(intent)).length) fail('media_exists', 'An unowned upload filename already exists');
      await unchanged(); record(store, entry.intentName, intent);
      await checkpoint('media-intent:' + entry.asset.path);
      await unchanged();
      const bytes = fs.readFileSync(store.filePath('source/' + entry.asset.path));
      if (bytes.length !== entry.asset.bytes || digest(bytes) !== entry.asset.sha256) fail('source_changed', 'Captured image bytes changed');
      const body = new FormData(); body.set('file', new Blob([bytes], { type: 'image/png' }), intent.filename);
      let response;
      try { response = await json('/v1/media/production/upload', { method: 'POST', body }); }
      catch { fail('media_uncertain', 'Upload response was lost; retain its intent and reconcile without replay'); }
      await checkpoint('media-response:' + entry.asset.path);
      if (response.status !== 201) fail('media_refused', 'Upload refused or uncertain: ' + response.status);
      const receipt = await verify(intent, response.data);
      await unchanged(); record(store, entry.receiptName, receipt);
      receipts.push(receipt);
    } else {
      const matches = await candidates(intent);
      if (matches.length !== 1) fail('media_uncertain', 'Owned upload is absent or ambiguous; no automatic retry');
      const receipt = await verify(intent, matches[0]);
      await unchanged(); record(store, entry.receiptName, receipt);
      receipts.push(receipt);
    }
    await checkpoint('media-receipt:' + entry.asset.path);
  }
  await unchanged(); record(store, 'media/complete.json', { version: 1, planHash, receipts });
  return {
    urls: Object.fromEntries(receipts.map(receipt => [receipt.asset.path,receipt.url])),
    // Upload readback precedes Paper creation. Recheck after all Paper writes so
    // media removed or changed during a batch cannot receive a completed stamp.
    async verify() {
      await unchanged(); record(store, 'media/plan.json', plan);
      record(store, 'media/complete.json', { version: 1, planHash, receipts });
      for (const receipt of receipts) {
        const { version, planHash: intentPlan, asset, filename } = receipt;
        const intent = { version, planHash: intentPlan, asset, filename };
        const matches = await candidates(intent);
        if (matches.length !== 1) fail('media_uncertain', 'Owned upload changed during staging; retain all staged data');
        const actual = await verify(intent, matches[0]);
        if (canonical(actual) !== canonical(receipt)) fail('media_identity', 'Media identity changed during staging');
        await unchanged();
      }
    },
  };
}

module.exports = { stageMedia };
