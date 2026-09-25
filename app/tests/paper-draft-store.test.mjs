import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { createPaperDraftStore } = require('../main/paper-draft-store');
const { controller } = require('../main/writer-admission');
const owner = 'a'.repeat(64), otherOwner = 'b'.repeat(64);
function fixture(profileId = 'A') {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-paper-drafts-')));
  const drafts = createPaperDraftStore({ store, profileId });
  const token = drafts.open({ id: 'same-slug', paperOwner: owner });
  return { store, drafts, token, restart: () => createPaperDraftStore({ store, profileId }) };
}
const draft = (overrides = {}) => ({ sessionId: crypto.randomUUID(), inputVersion: 7, baseRevision: 3,
  title: '  Unsaved title  ', snapshot: { mode: 'rich', blocks: [{ id: 'one', type: 'paragraph', content: [{ type: 'text', value: 'new typing' }] }] }, ...overrides });

test('durable exact title/body and raw Markdown survive restart, distinct versions and repeated retention', () => {
  const f = fixture(), first = draft({ snapshot: { mode: 'markdown', raw_source: '# Raw  \r\n\n', blocks: [] } });
  const receipt = f.drafts.retain(f.token, first), again = f.drafts.retain(f.token, structuredClone(first));
  assert.equal(receipt.key, again.key);
  const next = { ...first, inputVersion: 8, title: 'newer title' };
  const second = f.drafts.retain(f.token, next);
  assert.notEqual(second.key, receipt.key);
  assert.equal(f.drafts.retain(f.token, first).key, receipt.key, 'late old draft never replaces newer version');
  const restarted = f.restart();
  assert.deepEqual(restarted.read(receipt.key).content.draft, first);
  assert.deepEqual(restarted.read(second.key).content.draft, next);
  assert.equal(restarted.list().length, 2);
  assert.throws(() => restarted.retain(f.token, first), /another session/);
});
test('same slug across profile, connection and mounted session stays separate', () => {
  const a = fixture(), b = fixture('B'), value = draft();
  assert.throws(() => b.drafts.retain(a.token, value), /another session/);
  const one = a.drafts.retain(a.token, value), two = b.drafts.retain(b.token, value);
  const connectionToken = a.drafts.open({ id: 'same-slug', paperOwner: otherOwner });
  const three = a.drafts.retain(connectionToken, value);
  const four = a.drafts.retain(a.token, { ...value, sessionId: crypto.randomUUID() });
  assert.equal(new Set([one.key, two.key, three.key, four.key]).size, 4);
  assert.equal(a.drafts.read(one.key).content.paperOwner, owner);
  assert.equal(a.drafts.read(three.key).content.paperOwner, otherOwner);
});
test('forged owner fields cannot override the trusted Paper capability', () => {
  const f = fixture(), r = f.drafts.retain(f.token, { ...draft(), profileId: 'B', paperOwner: otherOwner, documentId: '../escape' });
  assert.equal(r.profileId, 'A'); assert.equal(r.documentId, 'same-slug'); assert.equal(r.paperOwner, owner);
  assert.throws(() => f.drafts.read('../escape'), /Invalid/);
});
test('serialization uncertainty, lossy JSON and invalid revisions refuse before writer admission', () => {
  const f = fixture();
  for (const snapshot of [{ mode: 'rich', serialization_error: 'oops', blocks: [] }, { mode: 'markdown', blocks: [] },
    { mode: 'rich', blocks: [undefined] }, { mode: 'rich', blocks: [NaN] }, { mode: 'rich', blocks: [new Date()] }]) {
    assert.throws(() => f.drafts.retain(f.token, draft({ snapshot })));
  }
  const cyclic = []; cyclic.push(cyclic);
  assert.throws(() => f.drafts.retain(f.token, draft({ snapshot: { mode: 'rich', blocks: cyclic } })));
  assert.throws(() => f.drafts.retain(f.token, draft({ baseRevision: -1 })));
  assert.equal(f.drafts.list().length, 0); assert.equal(controller(f.store).inspect().pending.length, 0);
});
test('corrupt immutable record refuses read, listing and idempotent retention', () => {
  const f = fixture(), value = draft(), r = f.drafts.retain(f.token, value);
  const file = f.store.filePath(`paper-drafts/${r.key}.json`), record = JSON.parse(fs.readFileSync(file));
  record.content.draft.title = 'damaged'; fs.writeFileSync(file, JSON.stringify(record));
  assert.throws(() => f.drafts.read(r.key), /checksum/);
  assert.throws(() => f.drafts.list(), /checksum/);
  assert.throws(() => f.drafts.retain(f.token, value), /checksum/);
  assert.equal(JSON.parse(fs.readFileSync(file)).content.draft.title, 'damaged', 'never repair evidence silently');
});
test('copied recovery records cannot cross store ownership even with the same profile name', () => {
  const a = fixture(), b = fixture(), r = a.drafts.retain(a.token, draft());
  fs.mkdirSync(b.store.filePath('paper-drafts'));
  fs.copyFileSync(a.store.filePath(`paper-drafts/${r.key}.json`), b.store.filePath(`paper-drafts/${r.key}.json`));
  assert.throws(() => b.drafts.read(r.key), /ownership/);
});
test('storage failure retains writer uncertainty and returns no success receipt', () => {
  const f = fixture(); fs.writeFileSync(f.store.filePath('paper-drafts'), 'not a directory');
  assert.throws(() => f.drafts.retain(f.token, draft()));
  assert.equal(controller(f.store).inspect().pending[0].status, 'uncertain');
});
test('closed writer refuses retention while existing records remain readable', () => {
  const f = fixture(), r = f.drafts.retain(f.token, draft());
  const control = controller(f.store); control.quiesce(control.capture());
  assert.throws(() => f.drafts.retain(f.token, draft()), /earlier library generation/);
  assert.equal(f.restart().read(r.key).key, r.key);
});
