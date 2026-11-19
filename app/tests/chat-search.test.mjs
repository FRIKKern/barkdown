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
// Every message carries an id (shared/message-id.js); fixtures name theirs <chat>-<n>.
function profile(chats) {
  for (const chat of Object.values(chats)) chat.messages.forEach((m, n) => { m.id ??= `${chat.id}-${n}`; });
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
  assert.deepEqual(hits.map(h => [h.chatId, h.messageId, h.role]), [['side1', 'side1-1', 'assistant'], ['old', 'old-0', 'user']]);
  assert.ok(hits.every(h => !('messageIndex' in h)), 'a hit never names a message by its place');
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

test('read only, caps results, and sees a rewritten workspace once the kept copy is two seconds old', async () => {
  let clock = 0;
  const { search } = createChatSearch({ now: () => clock });
  assert.equal((await search(A.store, 'funicular')).length, 2);
  const file = path.join(A.dir, 'workspace.json'), before = fs.readFileSync(file, 'utf8'), stat = fs.statSync(file);
  const long = 'needle '.repeat(400);
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`c${i}`, { id: `c${i}`, title: `Chat ${i}`, updatedAt: iso(i), messages: [{ role: 'user', text: long }, { role: 'assistant', text: long }, { role: 'user', text: long }, { role: 'assistant', text: long }] }]));
  const C = profile(many);
  const hits = await search(C.store, 'needle', { limit: 12, perChat: 2 });
  assert.equal(hits.length, 12);
  assert.ok(hits.every(h => h.snippet.length <= 160), 'snippets are short');
  assert.deepEqual([...new Set(hits.map(h => h.chatId))], ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
  assert.deepEqual(hits.slice(0, 2).map(h => h.messageId), ['c0-3', 'c0-2'], 'newest message first');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.statSync(file).mtimeMs, stat.mtimeMs);
  const ws = JSON.parse(before); ws.chats.main1.messages.push({ id: 'main1-2', role: 'user', text: 'What about Ulriken?' });
  fs.writeFileSync(file, JSON.stringify(ws));
  assert.deepEqual(await search(A.store, 'ulriken'), [], 'a copy under two seconds old is reused while typing');
  clock += 2000;
  assert.deepEqual((await search(A.store, 'ulriken')).map(h => [h.chatId, h.messageId]), [['main1', 'main1-2']]);
});

test('a missing or broken workspace finds nothing instead of throwing', async () => {
  const { search } = createChatSearch();
  const empty = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chatsearch-')));
  assert.deepEqual(await search(empty, 'anything'), []);
  fs.writeFileSync(empty.filePath('workspace.json'), '{ not json');
  assert.deepEqual(await search(empty, 'anything'), []);
});

test('the internal direct chat is never a hit', async () => {
  const D = profile({
    direct: { id: 'direct', title: 'Direct', updatedAt: iso(0), messages: [{ role: 'user', text: 'Walrus in the direct chat.' }] },
    real: { id: 'real', title: 'Real chat', updatedAt: iso(5), messages: [{ role: 'user', text: 'Walrus in a real chat.' }] },
  });
  assert.deepEqual((await createChatSearch().search(D.store, 'walrus')).map(h => h.chatId), ['real']);
});

test('the kept copies stay under a byte cap across profiles: the oldest goes first, and one too big is not kept', async () => {
  const text = n => 'otter '.repeat(n);
  const small = profile({ s: { id: 's', title: 'S', updatedAt: iso(1), messages: [{ role: 'user', text: text(100) }] } });
  const medium = profile({ m: { id: 'm', title: 'M', updatedAt: iso(1), messages: [{ role: 'user', text: text(150) }] } });
  const huge = profile({ h: { id: 'h', title: 'H', updatedAt: iso(1), messages: [{ role: 'user', text: text(1000) }] } });
  const cost = n => n * 6 * 2 * 2; // text and its lower-case copy, two bytes a character
  const searcher = createChatSearch({ cacheBytes: cost(200) });
  await searcher.search(small.store, 'otter');
  assert.equal(searcher.keptBytes(), cost(100));
  await searcher.search(medium.store, 'otter');
  assert.deepEqual(searcher.keptFiles(), [medium.store.filePath('workspace.json')], 'the oldest copy went to stay under the cap');
  assert.ok(searcher.keptBytes() <= cost(200));
  assert.equal((await searcher.search(huge.store, 'otter')).length, 1, 'a profile too big to keep is still searched');
  assert.ok(searcher.keptBytes() <= cost(200), 'and it is not kept');
  assert.ok(!searcher.keptFiles().includes(huge.store.filePath('workspace.json')));
});

test('a search reads during preparation: chats:search is on the read list', async () => {
  const { createPreparationForeground } = require('../main/preparation-foreground.js');
  const foreground = createPreparationForeground({ isClosed: () => true });
  assert.equal(await foreground.run('p', 'chats:search', () => 'hits'), 'hits');
  assert.throws(() => foreground.run('p', 'state:save', () => 'no'), /preparing/);
});
