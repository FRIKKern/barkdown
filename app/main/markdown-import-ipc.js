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
async function importOne({ plan, note, journal, save, connection, create, upload }) {
  const entry = journal.entries[note.key];
  if (!entry) throw failure('This file has no import request; choose the selection again.', 'import_journal');
  if (entry.noteId) return { done: true, id: entry.noteId, paperOwner: entry.paperOwner, title: entry.title, missing: entry.missing || 0 };
  const parsed = readNote(note, plan);
  for (const image of parsed.images) {
    if (!image.file || Object.hasOwn(journal.media, image.file)) continue;
    try { journal.media[image.file] = (await upload(connection, { name: path.basename(image.file), mime: image.mime, filePath: image.file })).src; }
    catch (error) { journal.media[image.file] = { error: String(error.message || error).slice(0, 200) }; }
    save();
  }
  const { blocks, missing } = noteBlocks(parsed, note, plan, { media: journal.media, docId: docIdFor(journal) });
  const paper = await create(connection, entry.requestId, parsed.title, blocks);
  const { raw, blocks: _blocks, html, markdown, ...summary } = paper;
  Object.assign(entry, { noteId: paper.id, paperOwner: paper.paperOwner, title: paper.title, missing });
  save();
  return { done: false, ...summary, missing };
}

function registerMarkdownImportIpc({ handle, dialog, window, platform = process.platform, profileStore, paperConnection, draftNotes, uploadMedia }) {
  const sessions = new Map();
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
    sessions.set(importId, { profileId, store, plan, binding: captured.binding });
    for (const key of [...sessions.keys()].slice(0, -3)) sessions.delete(key);
    return { importId, notes: plan.notes.map(n => ({ key: n.key, title: n.title, parentKey: n.parentKey, relPath: n.relPath, done: Boolean(journal.entries[n.key].noteId) })),
      skipped: plan.skipped, ignored: plan.ignored };
  });
  handle('barkpark:importMarkdownNote', async ({ importId, key } = {}) => {
    const session = sessions.get(importId);
    if (!session) throw failure('This import is no longer open. Choose the same files again: notes already imported are not created twice.', 'import_closed');
    const { profileId } = profileStore();
    if (profileId !== session.profileId) throw failure('The import belongs to another profile.', 'import_profile');
    const note = session.plan.notes.find(n => n.key === key);
    if (!note) throw failure('That file is not part of this import.', 'import_journal');
    const journal = readJournal(session.store, session.profileId, session.plan.selection);
    return paperConnection.write(session.binding, c => importOne({ plan: session.plan, note, journal, connection: c,
      save: () => writeJournal(session.store, journal), upload: uploadMedia,
      create: (config, requestId, title, blocks) => draftNotes(config).create(requestId, { title }, { blocks }) }))
      .then(result => ({ ...result, binding: session.binding }));
  });
}

module.exports = { registerMarkdownImportIpc, importOne, readJournal, writeJournal, assignRequests, journalName };
