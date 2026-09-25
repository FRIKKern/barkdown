// A retained snapshot is durable before deletion is dispatched. Sent requests
// reconcile by reading only: a later row with the same ID must never be deleted.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomicWrite } = require('./atomic-write');
const { acquireFileLease } = require('./file-lease');
const { createDraftNotes, exactDraft } = require('./draft-notes');
const bp = require('./barkpark');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = message => Object.assign(new Error(message), { code: 'paper_deletion' });

function createPaperDeletions(options) {
  const { store, profileId, paperOwner, assertOwned, request = bp.request } = options;
  const writer = require('./writer-admission').writerForStore(store);
  const config = structuredClone(options.config), notes = createDraftNotes(options);
  const dataset = encodeURIComponent(config.dataset || 'production');
  const keyFor = (id, revision) => hash([id, revision]);
  const view = r => ({ key: r.key, id: r.id, title: r.snapshot.title || 'Untitled', profileId, paperOwner,
    status: r.status, at: r.at, copyId: r.copyId || null });
  function validate(r, key) {
    if (!r || r.version !== 1 || r.key !== key || r.profileId !== profileId || r.paperOwner !== paperOwner ||
        keyFor(r.id, r.revision) !== key || !['prepared', 'sent', 'deleted', 'refused'].includes(r.status) ||
        !/^[a-f0-9-]{36}$/.test(r.recoveryRequest || '') || r.snapshotHash !== hash(r.snapshot)) throw fail('The recovery record is unreadable or belongs to another library. It was retained.');
    exactDraft(r.snapshot, r.id);
    if (r.snapshot._rev !== r.revision) throw fail('The recovery revision does not match its snapshot.');
    if (r.copyId && r.copyId !== `drafts.bd-note-${r.recoveryRequest}`) throw fail('The recovered copy identity does not match its request.');
    return r;
  }
  function fileFor(key) {
    assertOwned();
    if (!/^[a-f0-9]{64}$/.test(key || '')) throw fail('Invalid recovery record identity.');
    return store.filePath(`paper-deletions/${key}.json`);
  }
  async function locked(key, action) {
    const file = fileFor(key); fs.mkdirSync(path.dirname(file), { recursive: true });
    const lease = acquireFileLease(store.filePath(`paper-deletions/${key}.lock`), { completeOwner: true, busy: 'This note recovery request is already running.' });
    try {
      let bytes = null, record = null;
      try { bytes = fs.readFileSync(file); record = validate(JSON.parse(bytes), key); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const save = value => {
        validate(value, key); assertOwned(); lease.assertOwned();
        const next = Buffer.from(JSON.stringify(value, null, 2) + '\n');
        atomicWrite(file, next, { expectedBytes: bytes, assertOwned: () => { assertOwned(); lease.assertOwned(); } }); bytes = next;
      };
      return await action(record, save);
    } finally { lease.release(); }
  }
  function writes() { assertOwned(); if (!config.writes) throw fail('Enable local Paper writes before deleting or recovering a note.'); }
  async function reconcileRecord(record, save) {
    if (record.status !== 'sent') return view(record);
    // Absence alone may mean lost access. Only matching retained deletion
    // evidence confirms that this snapshot was removed; no mutation is replayed.
    try { await notes.read(record.id); return view(record); }
    catch (error) { if (error.status !== 404) throw error; }
    const result = await request(config, 'GET', `/v1/data/history/${dataset}/paper/${encodeURIComponent(record.id)}?limit=1000`);
    assertOwned();
    const revision = result?.revisions?.find(r => r.action === 'delete' && r.status === 'draft' && r.rev === record.revision);
    if (revision?.id) {
      const detail = await request(config, 'GET', `/v1/data/revision/${dataset}/${encodeURIComponent(revision.id)}`);
      assertOwned(); const r = detail?.revision;
      if (r?.type === 'paper' && r.dataset === (config.dataset || 'production') && r.doc_id === record.id.slice(7) &&
          r.rev === record.revision && r.status === 'draft' && r.action === 'delete' && r.title === record.snapshot.title &&
          hash(r.content?.blocks) === hash(record.snapshot.blocks)) { record.status = 'deleted'; save(record); }
    }
    return view(record);
  }
  async function remove(id, revision) {
    writes();
    if (typeof id !== 'string' || !/^drafts\.[a-zA-Z0-9_-]+$/.test(id) || typeof revision !== 'string' || !revision) throw fail('An exact draft and its saved revision are required.');
    const key = keyFor(id, revision);
    return locked(key, async (record, save) => {
      if (!record) {
        const snapshot = (await notes.read(id)).raw;
        if (snapshot._rev !== revision) throw fail('The note changed. Reload it before deleting; no content was removed.');
        record = { version: 1, key, id, revision, profileId, paperOwner, snapshot, snapshotHash: hash(snapshot),
          at: new Date().toISOString(), recoveryRequest: crypto.randomUUID(), status: 'prepared' }; save(record);
      }
      if (record.status === 'refused') throw fail('The server already refused this deletion. Reload the current note before trying again.');
      if (record.status !== 'prepared') return reconcileRecord(record, save);
      record.status = 'sent'; save(record);
      try {
        const response = await request(config, 'POST', `/v1/data/mutate/${dataset}`, { mutations: [{ deleteExactDraft: { id, type: 'paper', ifRevisionID: revision } }] });
        assertOwned();
        const receipt = response?.results?.[0];
        if (response?.results?.length !== 1 || receipt?.operation !== 'deleteExactDraft' || receipt.id !== id || receipt.document?._rev !== revision) throw fail('Deletion was not acknowledged for the exact note. Check its retained record.');
        exactDraft(receipt.document, id);
        if (hash(receipt.document.blocks) !== hash(record.snapshot.blocks)) throw fail('Deletion receipt differs from its retained snapshot.');
        record.status = 'deleted'; save(record); return view(record);
      } catch (error) {
        if ([400, 401, 403, 404, 409, 412, 422].includes(error.status)) { record.status = 'refused'; save(record); throw fail('The server refused deletion. Reload the note; its recovery snapshot was retained.'); }
        try { return await reconcileRecord(record, save); }
        catch { throw fail('Deletion is unconfirmed. Open Deleted notes to check it or recover a copy. No deletion will be replayed.'); }
      }
    });
  }
  async function reconcile(key) {
    return locked(key, async (record, save) => {
      if (!record) throw fail('Recovery record not found.');
      return reconcileRecord(record, save);
    });
  }
  async function recover(key) {
    writes();
    return locked(key, async (record, save) => {
      if (!record || !['sent', 'deleted'].includes(record.status)) throw fail('This record does not represent a dispatched deletion.');
      const paper = await notes.createCopy(record.recoveryRequest, record.snapshot);
      record.copyId = paper.id; save(record); return paper;
    });
  }
  function list() {
    assertOwned();
    const dir = store.filePath('paper-deletions'); let files;
    try { files = fs.readdirSync(dir); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return files.filter(name => name.endsWith('.json')).map(name => {
      const key = name.slice(0, -5), r = JSON.parse(fs.readFileSync(fileFor(key), 'utf8'));
      // Different library bindings in one profile retain separate evidence.
      if (r.profileId === profileId && r.paperOwner !== paperOwner) return null;
      return view(validate(r, key));
    }).filter(r => r && ['sent', 'deleted'].includes(r.status)).sort((a, b) => b.at.localeCompare(a.at));
  }
  return { list,
    remove: async (...args) => writer.run('deletion.remove', () => remove(...args)),
    reconcile: async (...args) => writer.run('deletion.reconcile', () => reconcile(...args)),
    recover: async (...args) => writer.run('deletion.recover', () => recover(...args)),
  };
}
module.exports = { createPaperDeletions };
