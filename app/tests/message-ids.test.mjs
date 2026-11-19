// Every transcript message has an id (shared/message-id.js), and a search hit names its message by that id.
// Old messages get one when the profile is loaded, once, and it is saved; a hit chosen after a message above it
// was deleted highlights its own message, never the neighbour now at its old place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);

test('one scheme: <role>-<turn>, and old messages get one once', () => {
  const { messageId, assignMessageIds } = require('../shared/message-id.js');
  assert.equal(messageId('user', 'abc'), 'user-abc');
  assert.equal(messageId('assistant', 'abc'), 'assistant-abc');
  assert.match(messageId('user'), /^user-[0-9a-f-]{36}$/);
  const chats = { c: { id: 'c', messages: [{ role: 'user', text: 'a' }, { id: 'assistant-kept', role: 'assistant', text: 'b' }] } };
  assert.equal(assignMessageIds(chats), true);
  const given = chats.c.messages[0].id;
  assert.match(given, /^user-/); assert.equal(chats.c.messages[1].id, 'assistant-kept');
  assert.equal(assignMessageIds(chats), false, 'nothing changes the second time');
  assert.equal(chats.c.messages[0].id, given);
});

test('loading a profile gives old messages ids and saves them, so they stay the same', () => {
  const { createProfileRegistry } = require('../main/profile-registry');
  const { createWorkspaceRepository } = require('../main/workspace-repository');
  const registry = createProfileRegistry(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-message-ids-')), 'registry'));
  const profile = registry.createProfile({ name: 'A' }), repo = createWorkspaceRepository({ registry });
  repo.saveView(profile.id, { version: 1, chats: { old: { id: 'old', title: 'Old', messages: [], tabs: [] } }, order: ['old'], current: 'old' });
  const file = path.join(registry.storeFor(profile.id).storeDir, 'workspace.json'), ws = JSON.parse(fs.readFileSync(file, 'utf8'));
  ws.chats.old.messages = [{ role: 'user', text: 'Before ids.' }, { role: 'assistant', text: 'Also before ids.' }];
  fs.writeFileSync(file, JSON.stringify(ws));
  const first = repo.interruptOrdinary(profile.id, () => false).chats.old.messages.map(m => m.id);
  assert.ok(first.every(id => /^(user|assistant)-/.test(id)), first.join());
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).chats.old.messages.map(m => m.id), first, 'saved');
  assert.deepEqual(repo.interruptOrdinary(profile.id, () => false).chats.old.messages.map(m => m.id), first, 'the same on the next load');
});

test('a hit chosen after a message above it was deleted highlights its own message', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="t"></div></body>', { url: 'http://localhost', pretendToBeVisual: true });
  for (const name of ['window', 'document', 'HTMLElement', 'CSS', 'Node', 'getComputedStyle']) globalThis[name] = dom.window[name];
  globalThis.CSS ??= { escape: value => String(value).replace(/["\\]/g, '\\$&') };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.barkdown = {};
  const { transcriptHtml } = await import('../renderer/src/conversation.js');
  const { revealMessage } = await import('../renderer/src/chat-search.js');
  const { createStore } = require('../main/store.js');
  const { createChatSearch } = require('../main/chat-search.js');
  const chat = { id: 'c', title: 'C', messages: [
    { id: 'user-1', role: 'user', text: 'First question.' }, { id: 'assistant-1', role: 'assistant', text: 'First answer.' },
    { id: 'user-2', role: 'user', text: 'Second question about herons.' }, { id: 'assistant-2', role: 'assistant', text: 'Herons wade.' },
  ] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-reveal-'));
  fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, order: ['c'], chats: { c: chat } }));
  const [hit] = await createChatSearch().search(createStore(dir), 'herons about');
  chat.messages.splice(0, 1); // deleted since the search: every later message moves up one place
  const container = document.getElementById('t');
  container.innerHTML = transcriptHtml(chat);
  assert.equal(revealMessage(container, hit.messageId), true);
  const found = [...container.querySelectorAll('.bw-found')];
  assert.equal(found.length, 1); assert.match(found[0].textContent, /Second question about herons/);
  chat.messages.splice(chat.messages.findIndex(m => m.id === hit.messageId), 1);
  container.innerHTML = transcriptHtml(chat);
  assert.equal(revealMessage(container, hit.messageId), false, 'a deleted message is not found, and nothing is highlighted');
  assert.equal(container.querySelectorAll('.bw-found').length, 0);
});
