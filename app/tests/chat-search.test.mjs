// Quick open's search inside chats (main/chat-search.js): words in the person's messages and the
// assistant's replies, side chats included, read from one profile's workspace.json and never another's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const { createStore } = require('../main/store.js');
const { createChatSearch } = require('../main/chat-search.js');

const iso = minutesAgo => new Date(Date.now() - minutesAgo * 60000).toISOString();
function profile(chats) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chatsearch-'));
  const store = createStore(dir);
  fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, order: Object.keys(chats), chats }));
  return { dir, store };
}
const A = profile({
  main1: { id: 'main1', title: 'Trip to Bergen', side: false, parent: null, updatedAt: iso(9), messages: [
    { role: 'user', text: 'Plan a weekend in Bergen.' },
    { role: 'assistant', text: 'Two days: Bryggen first, then the fjord boat.' },
  ] },
  side1: { id: 'side1', title: 'Rain plan', side: true, parent: 'main1', updatedAt: iso(2), messages: [
    { role: 'user', text: 'Is Fløyen worth it in rain?' },
    { role: 'assistant', text: 'Yes. The <b>funicular</b> runs in any weather, and the café at the top stays open.' },
  ] },
  old: { id: 'old', title: 'Old chat', side: false, parent: null, updatedAt: iso(60), messages: [
    { role: 'user', text: 'Funicular prices?', images: [{ id: 'i' }] },
    { role: 'assistant', text: '', streaming: true },
  ] },
});
const B = profile({
  other: { id: 'other', title: 'Profile B secrets', side: false, parent: null, updatedAt: iso(1), messages: [
    { role: 'user', text: 'The zeppelin code is 4411.' },
    { role: 'assistant', text: 'Noted: zeppelin.' },
  ] },
});

test('finds a word in an assistant reply of a side chat, newest chat first, with an escaped-ready snippet', async () => {
  const { search } = createChatSearch();
  const hits = await search(A.store, 'FUNICULAR');
  assert.deepEqual(hits.map(h => [h.chatId, h.messageIndex, h.role]), [['side1', 1, 'assistant'], ['old', 0, 'user']]);
  const [hit] = hits;
  assert.equal(hit.title, 'Rain plan');
  assert.equal(hit.side, true);
  assert.equal(hit.parentTitle, 'Trip to Bergen');
  assert.equal(hit.snippet.slice(hit.match.start, hit.match.start + hit.match.length), 'funicular');
  assert.ok(hit.snippet.includes('<b>funicular</b>'), 'raw text returned; the renderer escapes it: ' + hit.snippet);
});

test('every word must be in the same message; too-short queries return nothing', async () => {
  const { search } = createChatSearch();
  assert.deepEqual((await search(A.store, 'café funicular')).map(h => h.chatId), ['side1']);
  assert.deepEqual(await search(A.store, 'funicular bergen'), []);
  assert.deepEqual(await search(A.store, 'f'), []);
  assert.deepEqual(await search(A.store, '   '), []);
});

test('never finds a word that exists only in another profile, even after that profile was searched', async () => {
  const { search } = createChatSearch();
  assert.deepEqual(await search(A.store, 'zeppelin'), []);
  assert.equal((await search(B.store, 'zeppelin')).length, 2);
  assert.deepEqual(await search(A.store, 'zeppelin'), [], 'the cache is per profile');
  assert.deepEqual(await search(B.store, 'funicular'), []);
});

test('read only, caps results, and sees a rewritten workspace', async () => {
  const { search } = createChatSearch();
  const file = path.join(A.dir, 'workspace.json'), before = fs.readFileSync(file, 'utf8'), stat = fs.statSync(file);
  const long = 'needle '.repeat(400);
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`c${i}`, { id: `c${i}`, title: `Chat ${i}`, updatedAt: iso(i), messages: [{ role: 'user', text: long }, { role: 'assistant', text: long }, { role: 'user', text: long }, { role: 'assistant', text: long }] }]));
  const C = profile(many);
  const hits = await search(C.store, 'needle', { limit: 12, perChat: 2 });
  assert.equal(hits.length, 12);
  assert.ok(hits.every(h => h.snippet.length <= 160), 'snippets are short');
  assert.deepEqual([...new Set(hits.map(h => h.chatId))], ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
  assert.deepEqual(hits.slice(0, 2).map(h => h.messageIndex), [3, 2], 'newest message first');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.statSync(file).mtimeMs, stat.mtimeMs);
  const ws = JSON.parse(before); ws.chats.main1.messages.push({ role: 'user', text: 'What about Ulriken?' });
  fs.writeFileSync(file, JSON.stringify(ws));
  assert.deepEqual((await search(A.store, 'ulriken')).map(h => [h.chatId, h.messageIndex]), [['main1', 2]]);
});

test('a missing or broken workspace finds nothing instead of throwing', async () => {
  const { search } = createChatSearch();
  const empty = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chatsearch-')));
  assert.deepEqual(await search(empty, 'anything'), []);
  fs.writeFileSync(empty.filePath('workspace.json'), '{ not json');
  assert.deepEqual(await search(empty, 'anything'), []);
});
