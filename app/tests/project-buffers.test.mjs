import assert from 'node:assert/strict';

// Import the real renderer helper; no Electron or input window is needed.
globalThis.window = { barkdown: {} };
const { buffers, dirtyCount } = await import('../renderer/src/tabs/project.js');
const first = 'C:/fixture/first', second = 'C:/fixture/second';
try {
  buffers.set(`${first}::note.md`, { saved: 'first saved', draft: 'first unsaved' });
  buffers.set(`${first}::clean.md`, { saved: 'unchanged', draft: 'unchanged' });
  buffers.set(`${second}::note.md`, { saved: 'second saved', draft: 'second unsaved' });
  buffers.set(`${first}-other::note.md`, { saved: 'other saved', draft: 'other unsaved' });
  assert.equal(dirtyCount(), 3, 'profile switch must count dirty buffers in every folder');
  assert.equal(dirtyCount(first), 1, 'tab-specific checks retain their exact folder boundary');
  assert.equal(dirtyCount(second), 1);
  assert.equal(dirtyCount('C:/fixture/missing'), 0);
  const before = structuredClone([...buffers]);
  dirtyCount(); dirtyCount(first);
  assert.deepEqual([...buffers], before, 'checking cannot save, discard or rewrite a draft');
  buffers.get(`${first}::note.md`).saved = 'first unsaved';
  assert.equal(dirtyCount(first), 0);
  assert.equal(dirtyCount(), 2, 'saving one folder must not unblock another dirty folder');
  buffers.clear();
  assert.equal(dirtyCount(), 0);
  console.log('PASS global and exact-root project buffer counts preserve unsaved text without mutation');
} finally { buffers.clear(); delete globalThis.window; }
