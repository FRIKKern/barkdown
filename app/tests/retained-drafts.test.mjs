import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { openRetainedDrafts } from '../renderer/src/retained-drafts.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const record = key => ({ key, retainedAt: '2026-09-25T10:00:00Z', content: { profileId: 'a', documentId: 'paper', draft: {
  title: '<img src="https://invalid.example/x" onerror="alert(1)">', baseRevision: 4,
  snapshot: { mode: 'markdown', raw_source: 'Exact **source**  \n<script>not executable</script>\n', blocks: [] },
} } });
function setup(read = async key => record(key)) {
  const dom = new JSDOM('<body></body>'); globalThis.document = dom.window.document;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.dispatchEvent(new dom.window.Event('close')); };
  let active = true; const copied = [];
  const api = { paperDrafts: { list: async () => ['one', 'two'].map(key => ({ key, title: record(key).content.draft.title, retainedAt: record(key).retainedAt, inputVersion: 2 })), read,
    copy: async (key, format) => copied.push({ key, format }) } };
  return { api, owner: { profileId: 'a', generation: 'one' }, isCurrent: () => active, leave: () => active = false, copied, dom };
}
test('reader treats retained markup as text and copies only a verified owned key', async () => {
  const f = setup(); await openRetainedDrafts(f);
  const dialog = document.querySelector('dialog');
  assert.equal(dialog.querySelector('img,script,a'), null);
  assert.equal(dialog.querySelector('.bw-retained-text').value, record('one').content.draft.snapshot.raw_source);
  assert.equal(dialog.querySelector('.bw-retained-text').readOnly, true);
  dialog.querySelector('[data-record]').click(); await tick();
  assert.deepEqual(f.copied, [{ key: 'one', format: 'record' }]);
  dialog.querySelector('[data-close]').click(); assert.equal(document.querySelector('dialog'), null);
});
test('late first read cannot replace a newer selection or a closed reader', async () => {
  const first = deferred(), f = setup(key => key === 'one' ? first.promise : Promise.resolve(record(key)));
  const opened = openRetainedDrafts(f); await tick();
  const dialog = document.querySelector('dialog'), select = dialog.querySelector('select');
  select.value = 'two'; select.dispatchEvent(new f.dom.window.Event('change')); await tick();
  assert.equal(JSON.parse(dialog.querySelector('details textarea').value).key, 'two');
  first.resolve(record('one')); await opened;
  assert.equal(JSON.parse(dialog.querySelector('details textarea').value).key, 'two');
  dialog.querySelector('[data-close]').click();
});
test('foreign response and changed profile cannot expose or copy the retained contents', async () => {
  const f = setup(async key => ({ ...record(key), content: { ...record(key).content, profileId: 'b' } }));
  await openRetainedDrafts(f);
  assert.equal(document.querySelector('.bw-retained-text').value, '');
  assert.equal(document.querySelector('[data-record]').disabled, true);
  document.querySelector('[data-close]').click();
  const late = deferred(), other = setup(() => late.promise);
  const opening = openRetainedDrafts(other); await tick(); other.leave(); late.resolve(record('one')); await opening;
  assert.equal(document.querySelector('.bw-retained-text').value, '');
  assert.equal(document.querySelector('[data-record]').disabled, true);
});
