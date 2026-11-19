import assert from 'node:assert/strict';
import test from 'node:test';
// Renderer modules are ESM in this CommonJS package; Node 22 detects that and imports them as they are.
const { createNoteAction } = await import('../renderer/src/note-creation.js');
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

// A kept New page request never blocks later new pages (renderer/src/kept-request.js, shared with clips and chat notes).
const id2 = '22222222-2222-4222-8222-222222222222';
const fresh = f => { const list = [id, id2]; return createNoteAction({ ...f.args, newId: () => list.shift() }); };
const savedRequest = f => f.calls.filter(c => c[0] === 'save').at(-1)[1].pages.noteCreation;
test('a New page request main refuses for good is dropped with the reason, and the next press makes a new page', async () => {
  for (const [code, why] of [['draft_identity', 'The server refused this creation.'], ['writes_disabled', 'Enable local Paper writes before creating a note.']]) {
    const f = fixture(), ok = f.args.api.barkpark.createNote;
    // As it arrives across the context bridge: "[code] text" (preload.js), no .code.
    f.args.api.barkpark.createNote = async request => { f.calls.push(['create', request]); throw new Error(`[${code}] ${why}`); };
    const newPage = fresh(f);
    await newPage('parent');
    assert.equal(f.state.pages.noteCreation, undefined, `${code}: not kept`);
    assert.equal(savedRequest(f), undefined, `${code}: the drop is saved`);
    assert.equal(newPage.kept(), false, 'Pages shows no notice');
    assert.deepEqual(f.errors, [`New page was refused, so that request was dropped. Press again to try anew. ${why}`]);
    f.args.api.barkpark.createNote = ok;
    await newPage(null);
    assert.equal(f.calls.filter(c => c[0] === 'create').at(-1)[1], id2, 'the next press is a new request');
    assert.equal(f.calls.filter(c => c[0] === 'place').length, 1, 'and makes a new page');
  }
});

test('an unconfirmed New page shows Retry and Discard in Pages; Retry checks the same request, Discard lets the next press make a new page', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<div id="app"><nav id="pages"></nav><div id="bw-toasts"></div></div>', { url: 'http://localhost' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  window.barkdown = { state: { save: async () => {} } };
  const { state } = await import('../renderer/src/state.js');
  const { seedTree, renderPages } = await import('../renderer/src/pages.js');
  Object.assign(state, { profileId: 'A', generation: 1, settings: { barkpark: { enabled: true } }, documents: [], barkparkDocs: [], pages: null });
  seedTree();
  const f = fixture(), host = document.getElementById('pages');
  const draw = () => renderPages(host, { isOpen: () => false, openKey: () => {}, onNewPage: () => {}, onNewSubpage: () => {}, openBeside: () => {}, kept: [newPage] });
  const newPage = createNoteAction({ ...f.args, state, pages: () => state.pages, serialise: () => structuredClone({ pages: state.pages }), render: draw, newId: (() => { const list = [id, id2]; return () => list.shift(); })() });
  f.args.api.barkpark.createNote = async request => { f.calls.push(['create', request]); throw Error('lost reply'); };
  await newPage(null);
  assert.equal(state.pages.noteCreation.requestId, id);
  const notice = host.querySelector('.bw-kept-notice');
  assert.ok(notice, 'one kept-request notice');
  assert.equal(notice.querySelector('span').textContent, 'New page not confirmed.');
  assert.ok(host.querySelector('#bw-note-retry') && host.querySelector('#bw-note-discard'), 'Retry and Discard');
  assert.equal(host.querySelectorAll('.bw-library-notice').length, 1, 'no second notice for the same request');
  host.querySelector('#bw-note-retry').click();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(f.calls.filter(c => c[0] === 'create').map(c => c[1]), [id, id], 'Retry checks the same request');
  host.querySelector('#bw-note-discard').click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(state.pages.noteCreation, undefined);
  assert.equal(host.querySelector('.bw-kept-notice'), null, 'the notice is gone');
  f.args.api.barkpark.createNote = async request => { f.calls.push(['create', request]); return { id: 'drafts.new', paperOwner: 'owner' }; };
  await newPage(null);
  assert.equal(f.calls.filter(c => c[0] === 'create').at(-1)[1], id2, 'the next press makes a new page');
});
