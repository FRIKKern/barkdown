// Importing Markdown into this profile's Paper library, one note per request so the window shows
// progress and a profile switch waits for at most one note. The journal (one per chosen selection,
// in the profile's own store) records each file's creation request before it is sent, and every
// image upload, so running the same selection again finishes the rest without a second note.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { planImport, readNote, noteBlocks } = require('./markdown-import');

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const journalName = selection => `markdown-import/${crypto.createHash('sha256').update(JSON.stringify(selection)).digest('hex').slice(0, 32)}.json`;
const failure = (message, code) => Object.assign(new Error(message), { code });

// An unreadable journal is kept and refuses: guessing would hand out new requests and duplicate notes.
function readJournal(store, profileId, selection) {
  const file = store.filePath(journalName(selection));
  let value = null;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw failure('The import record for this selection is unreadable; it was kept. Nothing was imported.', 'import_journal'); }
  if (!value) return { version: 1, profileId, selection, entries: {}, media: {} };
  if (value.version !== 1 || value.profileId !== profileId || JSON.stringify(value.selection) !== JSON.stringify(selection) || !value.entries || !value.media) throw failure('The import record belongs to another profile or selection; it was kept.', 'import_journal');
  return value;
}
function writeJournal(store, journal) { store.writeJson(journalName(journal.selection), journal); }

// Every file gets its creation request before the first note is sent.
function assignRequests(journal, plan, newId = crypto.randomUUID) {
  let changed = false;
  for (const note of plan.notes) if (!uuid.test(journal.entries[note.key]?.requestId || '')) { journal.entries[note.key] = { requestId: newId() }; changed = true; }
  return changed;
}
const docIdFor = journal => note => `drafts.bd-note-${journal.entries[note.key].requestId}`;

// One note: upload its images (each recorded as it lands), create it under its recorded request,
// record the result. A note the journal already holds is returned without sending anything.
// A library that is gone (connection refused) gets its own code, so the window stops after two in a row.
const unreachable = error => error?.cause?.code === 'ECONNREFUSED' || error?.code === 'ECONNREFUSED'
  ? Object.assign(new Error('The library is not answering. Import the same files again later; nothing is created twice.', { cause: error }), { code: 'import_unreachable' }) : error;
const refusedOnce = (note, reason) => failure(`${note.relPath}: ${reason}`, 'import_note_refused');
// A token that may not write (401/403) is the library's answer to the whole import, not to one note: it stops the
// import, and nothing is recorded as refused, so the same selection imports everything once writing is allowed.
const reasonOf = error => String(error?.message || error).replace(/^\[[\w-]+\]\s*/, '').slice(0, 200);
const forbidden = error => [401, 403].includes(error?.status)
  ? Object.assign(new Error(`Barkdown is not allowed to write notes here: ${reasonOf(error)}. Nothing more was imported.`, { cause: error }), { code: 'import_forbidden' }) : null;

async function importOne({ plan, note, journal, save, connection, create, upload, closing = () => false }) {
  const entry = journal.entries[note.key];
  if (!entry) throw failure('This file has no import request; choose the selection again.', 'import_journal');
  if (entry.noteId) return { done: true, id: entry.noteId, paperOwner: entry.paperOwner, title: entry.title, missing: entry.missing || 0 };
  // A note the library refused stays refused: the rerun reports it and goes on to the rest.
  if (entry.refused) throw refusedOnce(note, entry.refused);
  const parsed = readNote(note, plan);
  for (const image of parsed.images) {
    if (!image.file || Object.hasOwn(journal.media, image.file)) continue;
    if (closing()) throw failure('Barkdown is quitting. Import the same files again to finish; nothing is created twice.', 'import_closed');
    try { journal.media[image.file] = (await upload(connection, { name: path.basename(image.file), mime: image.mime, filePath: image.file })).src; }
    catch (error) {
      // Only a refusal is the picture's answer; a rate limit, a held library or a lost connection is tried again.
      if (forbidden(error)) throw forbidden(error);
      if (!(error.status >= 400 && error.status < 500 && error.status !== 429)) throw unreachable(error);
      journal.media[image.file] = { error: String(error.message || error).slice(0, 200) };
    }
    save();
  }
  const { blocks, missing } = noteBlocks(parsed, note, plan, { media: journal.media, docId: docIdFor(journal) });
  let paper;
  try { paper = await create(connection, entry.requestId, parsed.title, blocks); }
  catch (error) {
    // The server refused the create (draft-notes keeps it refused), or the request was sent with other content
    // before (the file changed after a create that may have landed): recorded, so this note fails alone and every
    // rerun goes on. A create held at the door and the file edited since is not this: it imports the new content.
    if (forbidden(error)) throw forbidden(error);
    if (error.code === 'draft_identity' || [400, 409, 422].includes(error.status)) {
      entry.refused = reasonOf(error); save();
      throw refusedOnce(note, entry.refused);
    }
    throw unreachable(error);
  }
  const { raw, blocks: _blocks, html, markdown, ...summary } = paper;
  Object.assign(entry, { noteId: paper.id, paperOwner: paper.paperOwner, title: paper.title, missing });
  save();
  return { done: false, ...summary, missing };
}

function registerMarkdownImportIpc({ handle, dialog, window, platform = process.platform, profileStore, paperConnection, draftNotes, uploadMedia, closing = () => false }) {
  const sessions = new Map(), inflight = new Set();
  handle('barkpark:importMarkdownChoose', async ({ kind } = {}) => {
    const { profileId, store } = profileStore();
    // The library must be this profile's own before anything is chosen.
    const captured = await paperConnection.read(undefined, c => { draftNotes(c); });
    const properties = platform === 'darwin' ? ['openFile', 'openDirectory', 'multiSelections'] : kind === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections'];
    const chosen = await dialog.showOpenDialog(window(), { title: 'Import Markdown', buttonLabel: 'Import', properties, filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] });
    if (chosen.canceled || !chosen.filePaths?.length) return null;
    const plan = planImport(chosen.filePaths);
    const journal = readJournal(store, profileId, plan.selection);
    if (assignRequests(journal, plan)) writeJournal(store, journal);
    const importId = crypto.randomUUID();
    sessions.set(importId, { profileId, store, plan, journal, binding: captured.binding });
    for (const key of [...sessions.keys()].slice(0, -3)) sessions.delete(key);
    return { importId, notes: plan.notes.map(n => ({ key: n.key, title: n.title, parentKey: n.parentKey, relPath: n.relPath, done: Boolean(journal.entries[n.key].noteId) })),
      skipped: plan.skipped, ignored: plan.ignored };
  });
  handle('barkpark:importMarkdownNote', async ({ importId, key } = {}) => {
    // Quitting stops the import between notes; the journal lets the same selection finish later.
    if (closing()) throw failure('Barkdown is quitting. Import the same files again to finish; nothing is created twice.', 'import_closed');
    const session = sessions.get(importId);
    if (!session) throw failure('This import is no longer open. Choose the same files again: notes already imported are not created twice.', 'import_closed');
    const { profileId } = profileStore();
    if (profileId !== session.profileId) throw failure('The import belongs to another profile.', 'import_profile');
    const note = session.plan.notes.find(n => n.key === key);
    if (!note) throw failure('That file is not part of this import.', 'import_journal');
    // After a 401/403 this import sends nothing more, even if the window asks for the next note.
    if (session.forbidden) throw session.forbidden;
    // Only this session writes its journal (the window runs one import at a time), so it stays in memory.
    const { journal } = session;
    // The library is checked here, before the note: a library refusal stops the import, it is not this note's answer.
    const work = paperConnection.write(session.binding, c => { const notes = draftNotes(c); return importOne({ plan: session.plan, note, journal, connection: c, closing,
      save: () => writeJournal(session.store, journal), upload: uploadMedia,
      create: (_c, requestId, title, blocks) => notes.create(requestId, { title }, { blocks }) }); })
      .then(result => ({ ...result, binding: session.binding }));
    inflight.add(work);
    try { return await work; }
    catch (error) { if (error.code === 'import_forbidden') session.forbidden = error; throw error; }
    finally { inflight.delete(work); }
  });
  return { drain: () => Promise.allSettled([...inflight]) };
}

module.exports = { registerMarkdownImportIpc, importOne, readJournal, writeJournal, assignRequests, journalName };
