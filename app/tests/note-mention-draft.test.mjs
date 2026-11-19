// Which notes a send reads (renderer/src/note-mention.js#mentionsFor): only the tokens picked in this draft. A token
// typed by hand stays text even when an earlier message used the label; history Up brings a message back with its
// mention records (renderer/src/composer-history.js), so a recalled token still names its note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="app"></div><div id="bw-toasts"></div><textarea id="t"></textarea></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'Node', 'getComputedStyle']) globalThis[name] = dom.window[name];
window.barkdown = {};
const { mentionsFor } = await import('../renderer/src/note-mention.js');
const { recallComposer, composerDraftMentions } = await import('../renderer/src/composer-history.js');

const plan = { label: 'Launch plan', title: 'Launch plan', id: 'drafts.bd-note-1', source: 'barkpark', paperOwner: 'a'.repeat(64) };
const chatWithEarlier = () => ({ messages: [{ role: 'user', text: 'see @[Launch plan]', mentions: [plan] }], draftMentions: [] });

test('a hand-typed token that was not picked in this draft is sent as plain text', () => {
  const chat = chatWithEarlier();
  assert.deepEqual(mentionsFor(chat, 'again @[Launch plan]'), [], 'an earlier message using the label does not make it a mention');
  chat.draftMentions = [plan];
  assert.deepEqual(mentionsFor(chat, 'again @[Launch plan]').map(r => r.id), [plan.id], 'picked here, it is one');
});

test('history Up brings a message back with the notes it mentioned, and Down restores the draft\'s own', () => {
  const chat = chatWithEarlier(), input = document.getElementById('t'), key = k => ({ key: k, preventDefault() {}, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false });
  input.value = 'unsent'; input.setSelectionRange(0, 0);
  assert.equal(recallComposer(key('ArrowUp'), input, chat, () => {}), true);
  assert.equal(input.value, 'see @[Launch plan]');
  assert.deepEqual(mentionsFor(chat, input.value).map(r => r.id), [plan.id], 'the recalled token still names its note');
  assert.deepEqual(composerDraftMentions(chat), [], 'what is saved is the unsent draft\'s records, not the recalled entry\'s');
  input.setSelectionRange(input.value.length, input.value.length);
  assert.equal(recallComposer(key('ArrowDown'), input, chat, () => {}), true);
  assert.equal(input.value, 'unsent');
  assert.deepEqual(chat.draftMentions, []);
});
