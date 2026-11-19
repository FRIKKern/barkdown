// Words a save could not deliver (A3): the note's retained draft is remembered per note, in the profile's own store,
// until a later save from that note succeeds, its words are put back, or the person dismisses the notice.
//
// A marker names the revision the words were written on (rev). Reopening the note shows the notice when it applies:
// - The library's revision is still rev: nothing reached the note since, so the words are missing.
// - The save was refused by a conflict (412) and the marker says so (refusedRev, the library's newer revision then):
//   a refusal proves the words never landed, and the window that held them is gone, so no later retry can have sent
//   them. The notice applies at refusedRev and every later revision, however far other writers moved the note.
// - Any other marker whose note has moved on is not shown. Such a failure (library away, database dead) can be
//   followed by that window's own retry landing the words, so a newer revision may hold them already; putting an
//   old draft back over it would bring back old words.
function applies(entry, rev) {
  if (!entry || !Number.isSafeInteger(rev)) return false;
  return entry.rev === rev || (Number.isSafeInteger(entry.refusedRev) && entry.refusedRev > entry.rev && rev >= entry.refusedRev);
}

function createUnsavedWords({ store, profileId, readDraft }) {
  const read = () => { const value = store.readJson('paper-unsaved.json', null); return value?.version === 1 && value.profileId === profileId && value.notes && typeof value.notes === 'object' ? value : { version: 1, profileId, notes: {} }; };
  const name = (id, paperOwner) => `${paperOwner || 'unowned'}:${id}`;
  return {
    mark({ id, paperOwner, key, rev, refusedRev }) {
      if (typeof id !== 'string' || typeof key !== 'string' || !Number.isSafeInteger(rev)) throw new Error('A note, its retained draft and its revision are required.');
      if (refusedRev !== undefined && !(Number.isSafeInteger(refusedRev) && refusedRev > rev)) throw new Error('A refused save names a newer library revision.');
      const record = readDraft(key); if (record.content.documentId !== id) throw new Error('The retained draft belongs to another note.');
      const value = read(); value.notes[name(id, paperOwner)] = { key, rev, ...(refusedRev !== undefined ? { refusedRev } : {}), at: record.retainedAt };
      store.writeJson('paper-unsaved.json', value); return true;
    },
    clear({ id, paperOwner }) { const value = read(); if (value.notes[name(id, paperOwner)]) { delete value.notes[name(id, paperOwner)]; store.writeJson('paper-unsaved.json', value); } return true; },
    find({ id, paperOwner, rev }) { const entry = read().notes[name(id, paperOwner)]; return applies(entry, rev) ? entry : null; },
  };
}

module.exports = { createUnsavedWords, applies };
