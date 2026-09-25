// Local recovery evidence, not a second note authority or a server save receipt.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { writerForStore } = require('./writer-admission');
const { acquireFileLease } = require('./file-lease');
const { atomicWrite } = require('./atomic-write');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const fail = message => { throw Object.assign(new Error(message), { code: 'BARKDOWN_PAPER_DRAFT' }); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

// JSON.stringify silently drops undefined, holes and non-JSON values. Recovery
// must refuse those projections instead of certifying a lossy copy.
function canonical(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || seen.has(value)) fail('The Paper recovery projection is not lossless JSON.');
  seen.add(value);
  if (Object.getOwnPropertySymbols(value).length) fail('The Paper recovery projection contains unsupported properties.');
  let result;
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) fail('The Paper recovery projection contains an incomplete array.');
    result = '[' + Array.from(value, item => canonical(item, seen)).join(',') + ']';
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null || Object.getOwnPropertySymbols(value).length) fail('The Paper recovery projection contains an unsupported object.');
    result = '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], seen)).join(',') + '}';
  }
  seen.delete(value);
  return result;
}
function draft(value) {
  if (!value || !uuid(value.sessionId) || !Number.isSafeInteger(value.inputVersion) || value.inputVersion < 0 ||
      !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || typeof value.title !== 'string') fail('Paper draft identity or revision is invalid.');
  const s = value.snapshot;
  if (!s || !['rich', 'markdown'].includes(s.mode) || Object.hasOwn(s, 'serialization_error') || !Array.isArray(s.blocks) ||
      s.mode === 'markdown' && typeof s.raw_source !== 'string') fail('Paper recovery serialization is incomplete. Keep the editor open.');
  const copy = { sessionId: value.sessionId, inputVersion: value.inputVersion, baseRevision: value.baseRevision, title: value.title, snapshot: s };
  const encoded = canonical(copy);
  // Explicit refusal, never truncation; transport and disk budgets stay bounded.
  if (Buffer.byteLength(encoded) > 32 * 1024 * 1024) fail('This Paper draft exceeds the 32 MiB local recovery limit. Keep the editor open.');
  return JSON.parse(encoded);
}
function createPaperDraftStore({ store: inputStore, profileId }) {
  if (typeof profileId !== 'string' || !profileId) fail('Paper draft recovery requires a profile.');
  const store = createStore(inputStore.dir(), { create: false }), writer = writerForStore(store);
  const capabilities = new Map(), identities = new Map();
  function open({ id, paperOwner }) {
    if (typeof id !== 'string' || !id || id.length > 2048 || !digest(paperOwner)) fail('Paper draft ownership is invalid.');
    store.filePath('paper-drafts');
    const identity = canonical({ id, paperOwner });
    if (!identities.has(identity)) {
      if (identities.size >= 10000) fail('Too many Paper recovery owners in this session. Keep open drafts intact.');
      const token = crypto.randomUUID();
      identities.set(identity, token); capabilities.set(token, { documentId: id, paperOwner });
    }
    return identities.get(identity);
  }
  function read(key) {
    if (!digest(key)) fail('Invalid Paper recovery key.');
    const file = store.filePath(`paper-drafts/${key}.json`);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > 33 * 1024 * 1024) fail('Paper recovery record is not a supported file.');
    let record; try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail('Paper recovery record is unreadable.'); }
    const { content } = record || {};
    if (record?.version !== 1 || record.key !== key || hash(canonical(content)) !== key || content?.version !== 1 ||
        content.profileId !== profileId || content.storeOwner !== writer.token.owner ||
        typeof content.documentId !== 'string' || !content.documentId || !digest(content.paperOwner)) fail('Paper recovery ownership or checksum changed.');
    draft(content.draft);
    return record;
  }
  function retain(token, value) {
    const owner = capabilities.get(token);
    if (!owner) fail('This Paper draft belongs to another session or profile. Keep its editor open.');
    const content = { version: 1, profileId, storeOwner: writer.token.owner, ...owner, draft: draft(value) };
    const key = hash(canonical(content));
    return writer.run('paper-draft:retain', () => {
      fs.mkdirSync(store.filePath('paper-drafts'), { recursive: true });
      const file = store.filePath(`paper-drafts/${key}.json`), lease = acquireFileLease(file + '.lock', { completeOwner: true });
      try {
        if (fs.existsSync(file)) read(key);
        else atomicWrite(file, JSON.stringify({ version: 1, key, retainedAt: new Date().toISOString(), content }, null, 2) + '\n', {
          expectedBytes: null, assertOwned: () => { lease.assertOwned(); store.filePath(`paper-drafts/${key}.json`); },
        });
        const { draft: saved } = read(key).content;
        return { key, profileId, documentId: owner.documentId, paperOwner: owner.paperOwner,
          sessionId: saved.sessionId, inputVersion: saved.inputVersion, baseRevision: saved.baseRevision };
      } finally { lease.release(); }
    });
  }
  function list() {
    let names;
    try { names = fs.readdirSync(store.filePath('paper-drafts')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return names.filter(name => name.endsWith('.json')).sort().map(name => {
      const r = read(name.slice(0, -5)), d = r.content.draft;
      return { key: r.key, retainedAt: r.retainedAt, documentId: r.content.documentId, paperOwner: r.content.paperOwner,
        title: d.title, sessionId: d.sessionId, inputVersion: d.inputVersion, baseRevision: d.baseRevision };
    });
  }
  return Object.freeze({ open, retain, read, list });
}
module.exports = { createPaperDraftStore };
