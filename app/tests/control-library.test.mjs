import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryRefresh } from '../renderer/src/library-refresh.js';
import { mountControl } from '../renderer/src/control.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(afterRefresh = () => {}) {
  const state = { profileId: 'A', generation: 1, documents: [], barkparkDocs: [], pages: { roots: ['human-page'], children: {} }, settings: { barkpark: { enabled: true, server: 'https://one.invalid', dataset: 'production' } } };
  const pending = [], answers = new Map(); let invoke, id = 0;
  const api = { docs: { list: async () => [] }, barkpark: { list: () => { const d = deferred(); pending.push(d); return d.promise; }, get: async id => ({ id, rev: 3, blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'Kept.' }] }] }) }, control: { onInvoke(fn) { invoke = fn; }, result: async answer => { answers.set(answer.id, answer); } } };
  const refresh = createLibraryRefresh({ state, api, render() {}, report() {} });
  mountControl({ state, api, controllers: new Map(), DIRECT: 'direct', refreshLibrary: async () => { const result = await refresh(); afterRefresh(state, refresh); return result; } });
  const list = async context => { const key = ++id; await invoke({ id: key, command: 'note.list', context }); return answers.get(key); };
  const read = async note => { const key = ++id; await invoke({ id: key, command: 'note.read', args: { note } }); return answers.get(key); };
  return { state, pending, refresh, list, read };
}
for (const count of [0, 201]) test(`successful catalog returns all ${count} notes with the existing public shape`, async () => {
  const f = fixture(), request = f.list();
  const notes = Array.from({ length: count }, (_, n) => ({ id: `note-${n}`, title: `Note ${n}`, updatedAt: 'today', updated: 'yesterday', paperOwner: 'private' }));
  f.pending[0].resolve(notes);
  const answer = await request;
  assert.equal(answer.ok, true);
  assert.deepEqual(answer.result, notes.map(({ id, title }) => ({ id, title, updated: 'today' })));
});
for (const cached of [false, true]) test(`failed ${cached ? 'cached' : 'cold'} refresh refuses command, preserves Pages and supports retry`, async () => {
  const f = fixture(), seed = f.refresh();
  f.pending[0].resolve(cached ? [{ id: 'old', title: 'Known note' }] : []); await seed;
  const before = structuredClone(f.state), request = f.list();
  f.pending[1].reject(new Error('Permission lost on page 2'));
  const answer = await request;
  assert.equal(answer.ok, false); assert.equal(answer.code, 'catalog_unavailable'); assert.match(answer.error, /Permission lost/);
  assert.equal(Object.hasOwn(answer, 'result'), false);
  assert.deepEqual(f.state.barkparkDocs, before.barkparkDocs); assert.deepEqual(f.state.pages, before.pages);
  const retry = f.list(); f.pending[2].resolve([{ id: 'fresh', title: 'Fresh', updated: 'now' }]);
  assert.deepEqual((await retry).result, [{ id: 'fresh', title: 'Fresh', updated: 'now' }]);
  assert.equal(f.state.barkparkLibraryError, null);
});
test('overlapping commands refuse the old request even if it returns after a successful newer request', async () => {
  const f = fixture(), old = f.list(), recent = f.list();
  f.pending[1].resolve([{ id: 'new', title: 'New' }]); assert.equal((await recent).ok, true);
  f.pending[0].resolve([{ id: 'old' }]);
  assert.equal((await old).code, 'catalog_changed'); assert.equal(f.state.barkparkDocs[0].id, 'new');
});
for (const change of ['profile', 'connection']) for (const timing of ['pending', 'settled']) test(`${change} change ${timing} refuses the previous owner's command`, async () => {
  const changeOwner = state => { if (change === 'profile') state.profileId = 'B'; else state.settings.barkpark.server = 'https://two.invalid'; };
  const f = fixture(timing === 'settled' ? changeOwner : undefined), request = f.list();
  if (timing === 'pending') changeOwner(f.state);
  f.pending[0].resolve([{ id: 'old-owner' }]);
  assert.equal((await request).code, 'catalog_changed');
});
test('a new refresh after settlement still invalidates the old command before consumption', async () => {
  let replacement;
  const f = fixture((_state, refresh) => { replacement = refresh(); }), request = f.list();
  f.pending[0].resolve([{ id: 'obsolete' }]);
  assert.equal((await request).code, 'catalog_changed');
  f.pending[1].resolve([{ id: 'latest' }]); await replacement;
});
test('command snapshot cannot be substituted by a cache mutation after refresh settles', async () => {
  const f = fixture(state => { state.barkparkDocs[0].title = 'Altered'; state.barkparkDocs.push({ id: 'borrowed' }); }), request = f.list();
  f.pending[0].resolve([{ id: 'original', title: 'Original' }]);
  assert.deepEqual((await request).result, [{ id: 'original', title: 'Original', updated: null }]);
});
test('a note missing from a cold cache is looked up in the library before not-found', async () => {
  const f = fixture(), found = f.read('Harbour ledger');
  f.pending[0].resolve([{ id: 'harbour', title: 'Harbour ledger' }]);
  assert.deepEqual((await found).result, { id: 'harbour', title: 'Harbour ledger', rev: 3, text: 'Kept.' });
  const missing = f.read('Nowhere'); f.pending[1].resolve([{ id: 'harbour', title: 'Harbour ledger' }]);
  assert.equal((await missing).code, 'not_found');
  const away = f.read('Elsewhere'); f.pending[2].reject(new Error('fetch failed'));
  assert.equal((await away).code, 'catalog_unavailable');
});
test('a newer refresh of the same library during the lookup is waited out; a profile change refuses', async () => {
  const f = fixture(), found = f.read('Fresh note'), saving = f.refresh();
  f.pending[1].resolve([{ id: 'fresh', title: 'Fresh note' }]); await saving;
  f.pending[0].resolve([]); await new Promise(resolve => setImmediate(resolve));
  f.pending[2].resolve([{ id: 'fresh', title: 'Fresh note' }]);
  assert.equal((await found).result.id, 'fresh');
  const moved = f.read('Other'); f.state.profileId = 'B'; f.pending[3].resolve([{ id: 'other', title: 'Other' }]);
  assert.equal((await moved).code, 'catalog_changed');
});
test('disabled library succeeds empty without calling the catalog transport', async () => {
  const f = fixture(); f.state.settings.barkpark.enabled = false;
  assert.deepEqual((await f.list()).result, []); assert.equal(f.pending.length, 0);
});

for (const profileOwner of [{ profileId: 'B', generation: 1 }, { profileId: 'A', generation: 2 }]) test('stale assistant profile/generation is refused before renderer catalog dispatch', async () => {
  const f = fixture(), answer = await f.list({ chatId: 'same', profileOwner });
  assert.equal(answer.code, 'profile_changed'); assert.equal(f.pending.length, 0);
});

test('matching assistant profile context retains successful catalog behavior', async () => {
  const f = fixture(), result = f.list({ chatId: 'same', profileOwner: { profileId: 'A', generation: 1 } });
  f.pending[0].resolve([{ id: 'owned', title: 'A' }]); assert.equal((await result).result[0].id, 'owned');
});

for (const boundary of ['status', 'prepare']) test(`explicit assistant profile switch rechecks ownership after ${boundary}`, async () => {
  const state = { profileId: 'A', generation: 1, chats: {} }, answers = []; let invoke, selected = false;
  const api = { control: { onInvoke(fn) { invoke = fn; }, result: async answer => answers.push(answer) }, profiles: {
    status: async () => { if (boundary === 'status') state.generation = 2; return { enabled: true, profileId: 'A', profiles: [{ id: 'B', name: 'B' }] }; },
    select: async () => { selected = true; }
  } };
  mountControl({ api, state, controllers: new Map(), DIRECT: 'direct', beforeProfileSwitch: async () => { state.generation = 2; return true; } });
  await invoke({ id: 1, command: 'profile.switch', args: { profile: 'B' }, context: { chatId: 'same', profileOwner: { profileId: 'A', generation: 1 } } });
  assert.equal(answers[0].code, 'profile_changed'); assert.equal(selected, false);
});
