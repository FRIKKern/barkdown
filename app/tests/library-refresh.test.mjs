import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryRefresh } from '../renderer/src/library-refresh.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture() {
  const state = { profileId: 'A', generation: 1, documents: [], barkparkDocs: [], settings: { barkpark: { enabled: true, server: 'https://one.example', dataset: 'production', catalogGeneration: 1 } } };
  const pending = [], errors = [], snapshots = [];
  const api = { docs: { list: async () => [{ id: 'local' }] }, barkpark: { list: () => { const d = deferred(); pending.push(d); return d.promise; } } };
  const refresh = createLibraryRefresh({ state, api, report: e => errors.push(e), render: () => snapshots.push(state.barkparkDocs.map(d => d.id)) });
  return { state, pending, errors, snapshots, refresh };
}
test('failed same-scope refresh preserves known notes and human organization', async () => {
  const f = fixture(); f.state.pages = { roots: ['bp:a'], children: {}, archiveFilter: 'kept' };
  const first = f.refresh(); f.pending[0].resolve([{ id: 'a' }]); await first;
  const second = f.refresh(); f.pending[1].reject(new Error('offline')); await second;
  assert.deepEqual(f.state.barkparkDocs, [{ id: 'a' }]);
  assert.deepEqual(f.state.pages, { roots: ['bp:a'], children: {}, archiveFilter: 'kept' });
  assert.match(f.errors[0], /offline.*last successful/);
});
test('latest refresh wins even when an earlier response arrives last', async () => {
  const f = fixture(), old = f.refresh(), recent = f.refresh();
  f.pending[1].resolve([{ id: 'new' }]); await recent;
  f.pending[0].resolve([{ id: 'old' }]); await old;
  assert.deepEqual(f.state.barkparkDocs, [{ id: 'new' }]);
});
test('superseded errors do not toast or clear newer results', async () => {
  const f = fixture(), old = f.refresh(), recent = f.refresh();
  f.pending[1].resolve([{ id: 'new' }]); await recent;
  f.pending[0].reject(new Error('stale')); await old;
  assert.equal(f.errors.length, 0); assert.equal(f.state.barkparkDocs[0].id, 'new');
});
for (const change of ['server', 'dataset', 'catalogGeneration', 'profile']) test(`${change} change clears prior catalog before awaiting and rejects stale results`, async () => {
  const f = fixture(), initial = f.refresh(); f.pending[0].resolve([{ id: 'known' }]); await initial;
  const old = f.refresh();
  if (change === 'profile') f.state.profileId = 'B'; else f.state.settings.barkpark[change] = 'changed';
  const fresh = f.refresh(); assert.deepEqual(f.state.barkparkDocs, []);
  f.pending[1].resolve([{ id: 'old' }]); await old; assert.deepEqual(f.state.barkparkDocs, []);
  f.pending[2].reject(new Error('unavailable')); await fresh;
  assert.deepEqual(f.state.barkparkDocs, []); assert.doesNotMatch(f.errors[0], /last successful/);
});
test('scope changing without another refresh still rejects an in-flight result', async () => {
  const f = fixture(), active = f.refresh(); f.state.settings.barkpark.enabled = false;
  f.pending[0].resolve([{ id: 'obsolete' }]); await active;
  assert.deepEqual(f.state.barkparkDocs, []);
  await f.refresh(); assert.equal(f.pending.length, 1);
});
test('initial render waits for local documents before Pages can be seeded', async () => {
  const f = fixture(), pending = f.refresh();
  assert.deepEqual(f.snapshots, []);
  f.pending[0].resolve([]); await pending;
  assert.deepEqual(f.state.documents, [{ id: 'local' }]); assert.equal(f.snapshots.length, 1);
});
