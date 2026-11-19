// When a reopened note names words a save could not deliver (main/paper-unsaved.js): the marker's revision, or,
// for a save the library refused with a conflict, that refusal's revision and any later one. Nothing older.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createUnsavedWords, applies } = require('../main/paper-unsaved.js');

const fakeStore = () => { const files = new Map(); return { files, readJson: (name, fallback) => files.has(name) ? structuredClone(files.get(name)) : fallback, writeJson: (name, value) => files.set(name, structuredClone(value)) }; };
const words = store => createUnsavedWords({ store, profileId: 'P', readDraft: key => ({ key, retainedAt: '2026-11-18T23:00:00.000Z', content: { documentId: key.startsWith('note') ? 'note' : 'other' } }) });

test('a conflict at quit is named after the library moved on, and after it moved on again', () => {
  const unsaved = words(fakeStore());
  unsaved.mark({ id: 'note', paperOwner: 'o', key: 'note-draft', rev: 3, refusedRev: 5 });
  assert.equal(unsaved.find({ id: 'note', paperOwner: 'o', rev: 5 })?.key, 'note-draft', 'the revision that refused the words');
  assert.equal(unsaved.find({ id: 'note', paperOwner: 'o', rev: 9 })?.key, 'note-draft', 'other writers moved the note further');
  assert.equal(unsaved.find({ id: 'note', paperOwner: 'o', rev: 3 })?.key, 'note-draft', 'its own revision still applies');
  assert.equal(unsaved.find({ id: 'note', paperOwner: null, rev: 5 }), null, 'another library owner is another note');
});

test('a failed save without a conflict is named only while the note is still at its revision', () => {
  const unsaved = words(fakeStore());
  unsaved.mark({ id: 'note', paperOwner: 'o', key: 'note-draft', rev: 3 });
  assert.equal(unsaved.find({ id: 'note', paperOwner: 'o', rev: 3 })?.key, 'note-draft');
  assert.equal(unsaved.find({ id: 'note', paperOwner: 'o', rev: 4 }), null, 'a newer revision may hold these words already: old words are not brought back');
});

test('a marker written before refusals were recorded keeps the exact-revision rule', () => {
  assert.equal(applies({ key: 'k', rev: 3, at: 'x' }, 3), true);
  assert.equal(applies({ key: 'k', rev: 3, at: 'x' }, 7), false);
  assert.equal(applies({ key: 'k', rev: 3, refusedRev: 3 }, 7), false, 'a refusal must be newer than the words');
  assert.equal(applies(null, 3), false);
});

test('a refusal must name a newer revision, and clearing ends the notice', () => {
  const store = fakeStore(), unsaved = words(store);
  assert.throws(() => unsaved.mark({ id: 'note', paperOwner: 'o', key: 'note-draft', rev: 3, refusedRev: 3 }), /newer library revision/);
  assert.throws(() => unsaved.mark({ id: 'note', paperOwner: 'o', key: 'other-draft', rev: 3, refusedRev: 4 }), /another note/);
  unsaved.mark({ id: 'note', paperOwner: 'o', key: 'note-draft', rev: 3, refusedRev: 4 });
  assert.deepEqual(store.files.get('paper-unsaved.json').notes['o:note'], { key: 'note-draft', rev: 3, refusedRev: 4, at: '2026-11-18T23:00:00.000Z' });
  unsaved.clear({ id: 'note', paperOwner: 'o' });
  assert.equal(unsaved.find({ id: 'note', paperOwner: 'o', rev: 4 }), null);
});
