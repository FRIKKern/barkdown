// Diagnostic only: execute the real Paper host with the established controlled
// transport/canvas seams. This does not exercise native editor serialization.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd();
const url = p => pathToFileURL(path.join(root, p)).href;
let source = fs.readFileSync(path.join(root, 'app/tests/paper-host.test.mjs'), 'utf8');
source = source.replace("from 'jsdom'", `from '${url('app/node_modules/jsdom/lib/api.js')}'`)
  .replaceAll("'../renderer/src/tabs/paper.js'", `'${url('app/renderer/src/tabs/paper.js')}'`)
  .replaceAll("'../renderer/src/state.js'", `'${url('app/renderer/src/state.js')}'`)
  .replaceAll("'../renderer/src/index.js'", `'${url('app/renderer/src/index.js')}'`);
const marker = 'console.log(JSON.stringify(cases, null, 2));';
if (!source.includes(marker)) throw new Error('Diagnostic injection point changed');
source = source.replace(marker, `
await test('quit must not call an older snapshot kept when content changes during retention', async () => {
  const gate = deferred(); let retained;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async (_, draft) => { retained = structuredClone(draft); return gate.promise; } };
  window.barkdown.paperDrafts.markUnsaved = async () => true;
  const m = mount(); await tick(); await tick();
  try {
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'first unsaved draft' }] }; m.canvas().pending = true;
    const settling = m.controller.settle({ timeoutMs: 0 }); await tick();
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'newer unsaved draft' }] };
    gate.resolve({ key: 'a'.repeat(64) }); const result = await settling;
    assert.equal(retained.snapshot.blocks[0].text, 'first unsaved draft');
    console.log(JSON.stringify({ diagnostic: 'changed-during-retention', retained: retained.snapshot, current: m.canvas().snapshot, result }));
    assert.equal(result.kept, false, 'the acknowledged receipt represents the earlier buffer, not the current words');
  } finally { gate.resolve({}); m.close(); delete window.barkdown.paperDrafts.markUnsaved; }
});
await test('quit must recheck the buffer after the unsaved-marker acknowledgement', async () => {
  const gate = deferred(); let markerStarted = false;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => ({ key: 'c'.repeat(64) }) };
  window.barkdown.paperDrafts.markUnsaved = async () => { markerStarted = true; return gate.promise; };
  const m = mount(); await tick(); await tick();
  try {
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'retained before marker' }] }; m.canvas().pending = true;
    const settling = m.controller.settle({ timeoutMs: 0 }); await tick(); assert.equal(markerStarted, true);
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'newer while marking' }] };
    gate.resolve(true); const result = await settling;
    console.log(JSON.stringify({ diagnostic: 'changed-during-marker', result }));
    assert.equal(result.kept, false, 'a current receipt before the marker await is not proof of current words after it');
  } finally { gate.resolve(true); m.close(); delete window.barkdown.paperDrafts.markUnsaved; }
});
await test('dirty frozen preparation keeps a receipt but quit cannot currently report it retained', async () => {
  let frozenDraft;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => { throw new Error('Profile is preparing'); } };
  const m = mount(); await tick(); await tick();
  try {
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'unsaved frozen words' }] }; m.canvas().pending = true;
    const lease = await m.controller.freezeRecovery({ retain: async (_, draft) => { frozenDraft = structuredClone(draft); return { profileId: 'A', key: 'b'.repeat(64) }; } });
    const result = await m.controller.settle({ timeoutMs: 0 });
    assert.equal(lease.assertCurrent(), true); assert.deepEqual(frozenDraft.snapshot, m.canvas().snapshot);
    console.log(JSON.stringify({ diagnostic: 'unchanged-dirty-freeze', currentMatchesReceipt: true, result }));
    assert.equal(result.saved, false); assert.equal(result.kept, false); assert.match(result.error, /Profile is preparing/);
    lease.release();
  } finally { m.close(); }
});
${marker}`);
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
// Exercise the actual main-process settlement function with only its window
// transport replaced. This proves the decision, not a native shutdown journey.
const main = fs.readFileSync(path.join(root, 'app/main/main.js'), 'utf8');
const from = main.indexOf('const settling = new Map();'), to = main.indexOf('let cookiesFlushed = false;', from);
assert(from >= 0 && to > from, 'main settlement source boundaries changed');
let receive;
const win = { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (_, id) => queueMicrotask(() => receive(id)) } };
const host = new Function('win', 'crypto', main.slice(from, to) + '; return { settleWindow, settling };')(win, crypto);
receive = id => host.settling.get(id)([{ saved: false, kept: false, error: 'Disk unavailable' }]);
let outcome;
try { outcome = { resolved: await host.settleWindow(1000) }; } catch (error) { outcome = { rejected: error.message }; }
console.log(JSON.stringify({ diagnostic: 'main-unsafe-settlement', outcome }));
if (!outcome.rejected) { console.error('FAIL: main settlement resolves when current words are neither saved nor kept'); process.exitCode = 1; }
