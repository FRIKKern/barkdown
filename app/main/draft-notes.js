// Ordinary local notes retain their exact draft row. Published twins are separate documents.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const barkpark = require('./barkpark');
const { atomicWrite } = require('./atomic-write');
const { readCatalog } = require('./paper-catalog');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const flights = new Map();
const invalid = message => Object.assign(new Error(message), { code: 'draft_identity' });

function exactDraft(document, id, content = true) {
  if (typeof id !== 'string' || !/^drafts\.[a-zA-Z0-9_-]+$/.test(id) || !document ||
      document._id !== id || document._type !== 'paper' || document._draft !== true ||
      document._publishedId !== id.slice(7) || typeof document._rev !== 'string' || !document._rev ||
      (content && !Array.isArray(document.blocks)) || (Object.hasOwn(document, 'rev') && (!Number.isSafeInteger(document.rev) || document.rev < 0))) {
    throw invalid('The server did not return the exact draft note. No substitute was opened.');
  }
  return document;
}

function createDraftNotes({ store, config, paperOwner, profileId, assertOwned, request = barkpark.request }) {
  if (!uuid.test(profileId || '') || !/^[a-f0-9]{64}$/.test(paperOwner || '') ||
      config?.viaCli || !config?.enabled || typeof assertOwned !== 'function') throw invalid('An owned local Paper library is required.');
  const captured = structuredClone(config), dataset = encodeURIComponent(captured.dataset || 'production');
  function summary(document) {
    const d = exactDraft(document, document?._id, false);
    return { ...barkpark.paperToSummary(d), title: d.title || 'Untitled', slug: d._id,
      paperOwner, paperOrigin: { kind: 'local', profileId }, perspective: 'drafts', publishedId: d._publishedId };
  }
  async function read(id) {
    assertOwned();
    if (typeof id !== 'string' || !/^drafts\.[a-zA-Z0-9_-]+$/.test(id)) throw invalid('Exact draft ID required.');
    const response = await request(captured, 'GET', `/v1/data/doc/${dataset}/paper/${encodeURIComponent(id)}?perspective=drafts`);
    assertOwned();
    const d = exactDraft(response?.result?.document || response?.result || response?.document || response, id);
    return { ...summary(d), raw: d, ...barkpark.markdownView(d.blocks), blocks: d.blocks,
      html: d.body_html || null, revision: d._rev, rev: d.rev ?? 0, description: d.description || '' };
  }
  async function create(requestId, { title = '', markdown = '' } = {}) {
    assertOwned();
    if (!captured.writes) throw Object.assign(new Error('Enable local Paper writes before creating a note.'), { code: 'writes_disabled' });
    if (!uuid.test(requestId || '')) throw invalid('Creation request identity required.');
    if (typeof title !== 'string' || typeof markdown !== 'string') throw new TypeError('Note title and markdown must be strings.');
    const contentHash = crypto.createHash('sha256').update(JSON.stringify([title, markdown])).digest('hex');
    const body = markdown ? require('../shared/portabledoc').markdownToBlocks(markdown).map((b, i) => ({ ...b, id: `initial-${i}` })) : [];
    const blocks = body.length ? [{ id: 'tpl-title', type: 'heading', level: 1, role: 'title', locked: true, text: title }, ...body] : [];
    const name = `paper-creation/${requestId}.json`, file = store.filePath(name), flightKey = `${file}:${profileId}:${paperOwner}:${contentHash}`;
    // Same-process calls coalesce; the request lease also serializes MCP processes.
    if (flights.has(flightKey)) return flights.get(flightKey);
    const work = (async () => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const lease = require('./file-lease').acquireFileLease(store.filePath(name + '.lock'), { completeOwner: true, busy: 'This creation request is already running. Retry the same request after it finishes.' });
      try {
      let record, bytes = null;
      try { bytes = fs.readFileSync(file); record = JSON.parse(bytes); }
      catch (error) { if (error.code !== 'ENOENT') throw invalid('Creation record is unreadable; it was retained for recovery.'); }
      const persist = () => {
        assertOwned(); lease.assertOwned(); fs.mkdirSync(path.dirname(file), { recursive: true });
        const next = Buffer.from(JSON.stringify(record, null, 2) + '\n');
        atomicWrite(file, next, { assertOwned: () => { assertOwned(); lease.assertOwned(); }, expectedBytes: bytes }); bytes = next;
      };
      if (!record) {
        record = { version: 1, requestId, profileId, paperOwner, id: `drafts.bd-note-${requestId}`,
          nonce: crypto.randomUUID(), contentHash, status: 'prepared' };
        persist();
      }
      if (record.version !== 1 || record.requestId !== requestId || record.profileId !== profileId ||
          record.paperOwner !== paperOwner || record.id !== `drafts.bd-note-${requestId}` || !uuid.test(record.nonce || '') ||
          !['prepared', 'sent', 'complete', 'refused'].includes(record.status)) throw invalid('Creation record belongs to another or unknown owner.');
      if (record.contentHash ? record.contentHash !== contentHash : title !== '' || markdown !== '') throw invalid('This creation request has different content. Read its original note instead of replaying it.');
      if (record.status === 'refused') throw invalid('The server refused this creation. Its existing note was not changed.');
      const reconcile = async () => {
        const paper = await read(record.id);
        if (paper.raw.barkdownCreation !== record.nonce) throw invalid('Creation readback does not match this request. Existing content was retained.');
        if (record.status !== 'complete') { record.status = 'complete'; persist(); }
        return paper;
      };
      // A sent intent is read-only on every retry, including after process restart.
      // Missing readback remains uncertain; it never authorizes another create.
      if (record.status !== 'prepared') return await reconcile();
      record.status = 'sent'; persist();
      try {
        await request(captured, 'POST', `/v1/data/mutate/${dataset}`, { mutations: [{ create: {
          _id: record.id.slice(7), _type: 'paper', title, blocks, barkdownCreation: record.nonce,
        } }] });
      } catch (error) {
        if ([400, 401, 403, 409, 422].includes(error.status)) { record.status = 'refused'; persist(); throw error; }
        // A transport error may follow a committed create. Read the exact row once.
        try { return await reconcile(); } catch { throw Object.assign(new Error('Creation is unconfirmed. Retry this request to check the same note; no second note will be created.'), { code: 'draft_creation_uncertain' }); }
      }
      return await reconcile();
      } finally { lease.release(); }
    })();
    flights.set(flightKey, work);
    try { return await work; } finally { flights.delete(flightKey); }
  }
  async function list() {
    assertOwned();
    const rows = await readCatalog(({ limit, offset }) => request(captured, 'GET',
      `/v1/data/query/${dataset}/paper?limit=${limit}&offset=${offset}&order=_createdAt:asc&perspective=drafts&count=true&fields=title,slug,tags`, undefined,
      { maxBytes: 20 * 1024 * 1024 }), {}, 'drafts');
    assertOwned();
    return rows.filter(d => d._draft === true || d._id.startsWith('drafts.')).map(summary);
  }
  async function apply(id, ops, ifRev) {
    assertOwned();
    if (!captured.writes) throw Object.assign(new Error('Local Paper writes are disabled.'), { code: 'writes_disabled' });
    if (typeof id !== 'string' || !/^drafts\.[a-zA-Z0-9_-]+$/.test(id) || !Number.isSafeInteger(ifRev) || ifRev < 0 || !Array.isArray(ops) || !ops.length) throw invalid('Exact draft ID, Paper revision and operations required.');
    const result = await request(captured, 'POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(id)}/ops`, { ifRev, ops });
    assertOwned();
    if (!result || !Number.isSafeInteger(result.rev) || result.rev < ifRev) throw invalid('The server did not acknowledge a valid Paper revision.');
    return { ok: true, rev: result.rev, unchanged: Boolean(result.unchanged), opCount: result.op_count ?? ops.length };
  }
  async function search(query) {
    assertOwned();
    if (typeof query !== 'string' || query.length > 4096) throw new TypeError('Invalid note search');
    const response = await request(captured, 'GET', `/v1/data/search/${dataset}?q=${encodeURIComponent(query)}&limit=20&type=paper&perspective=drafts`);
    const data = response?.result || response;
    const rows = Array.isArray(data) ? data : data?.documents || data?.results;
    if (!Array.isArray(rows) || rows.some(d => !d || typeof d._id !== 'string')) throw invalid('Invalid draft search response.');
    assertOwned();
    return rows.filter(d => d._draft === true || d._id.startsWith('drafts.')).map(summary);
  }
  return { read, create, list, search, apply, summary };
}
// Only trusted runtime configuration carries this marker. A loopback URL alone is insufficient.
function ownedDraftNotes(store, config, profileId = config?.managedProfileId) {
  if (!config?.managedProfileId) return null;
  if (config.managedProfileId !== profileId) throw invalid('The note runtime belongs to another profile.');
  const navigation = require('./paper-navigation').createPaperNavigation(store);
  const paperOwner = navigation.identify(config);
  return createDraftNotes({ store, config, profileId, paperOwner,
    assertOwned: () => { store.filePath('paper-creation'); navigation.assert(paperOwner, config); } });
}
module.exports = { createDraftNotes, exactDraft, ownedDraftNotes };
