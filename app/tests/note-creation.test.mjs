import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
// Renderer modules are browser ESM inside a CommonJS package.
const library = fs.readFileSync(new URL('../renderer/src/library-refresh.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../renderer/src/note-creation.js', import.meta.url), 'utf8').replace("import { libraryScope } from './library-refresh.js';", library);
const { createNoteAction } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const id = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const state = { profileId: 'A', generation: 1, pages: {}, barkparkDocs: [], settings: { barkpark: { enabled: true } } };
  const calls = [], errors = [];
  const args = { state, api: { state: { save: async value => { calls.push(['save', value]); } }, barkpark: { createNote: async request => { calls.push(['create', request]); return { id: 'drafts.test', paperOwner: 'owner' }; } } },
    serialise: () => structuredClone(state), pages: () => state.pages, refresh: async () => {}, place: (note, parent) => calls.push(['place', note, parent]),
    open: note => calls.push(['open', note]), report: e => errors.push(e), render: () => {}, newId: () => id };
  return { state, calls, errors, args };
}
test('new-page intent is saved before creation and preserves requested placement', async () => {
  const f = fixture(); await createNoteAction(f.args)('parent');
  assert.equal(f.calls[0][0], 'save'); assert.equal(f.calls[0][1].pages.noteCreation.requestId, id);
  assert.deepEqual(f.calls[1], ['create', id]); assert.equal(f.calls.find(c => c[0] === 'place')[2], 'parent');
  assert.equal(f.state.pages.noteCreation, undefined); assert.equal(f.state.barkparkDocs.length, 1);
});
test('unconfirmed reply survives reconstruction and reuses original request and parent', async () => {
  const f = fixture(); f.args.api.barkpark.createNote = async request => { f.calls.push(['create', request]); throw Error('lost reply'); };
  await createNoteAction(f.args)('original-parent');
  assert.equal(f.state.pages.noteCreation.requestId, id);
  f.args.api.barkpark.createNote = async request => { f.calls.push(['retry', request]); return { id: 'drafts.test', paperOwner: 'owner' }; };
  await createNoteAction(f.args)('different-parent');
  assert.equal(f.calls.find(c => c[0] === 'retry')[1], id); assert.equal(f.calls.find(c => c[0] === 'place')[2], 'original-parent');
});
test('late result after profile switch cannot place or open into the new profile', async () => {
  const f = fixture(), original = f.state.pages;
  f.args.api.barkpark.createNote = async () => { f.state.profileId = 'B'; f.state.generation++; f.state.pages = {}; return { id: 'drafts.test' }; };
  await createNoteAction(f.args)(null);
  assert.equal(original.noteCreation.requestId, id); assert.equal(f.state.pages.noteCreation, undefined);
  assert(!f.calls.some(c => ['place', 'open'].includes(c[0]))); assert.equal(f.state.barkparkDocs.length, 0);
});
test('failed durable intent save prevents server creation', async () => {
  const f = fixture(); f.args.api.state.save = async () => { throw Error('disk unavailable'); };
  await createNoteAction(f.args)(null);
  assert(!f.calls.some(c => c[0] === 'create')); assert.equal(f.errors.length, 1);
});
