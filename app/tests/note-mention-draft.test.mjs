// Which notes a send reads (renderer/src/note-mention.js#mentionsFor): only the tokens picked in this draft. A token
// typed by hand stays text even when an earlier message used the label; history Up brings a message back with its
// mention records (renderer/src/composer-history.js), so a recalled token still names its note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="app"></div><div id="bw-toasts"></div><textarea id="t"></textarea></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'InputEvent', 'Node', 'getComputedStyle']) globalThis[name] = dom.window[name];
window.barkdown = {};
const { mentionsFor, attachMentionPicker } = await import('../renderer/src/note-mention.js');
const { recallComposer, composerDraftMentions } = await import('../renderer/src/composer-history.js');
const { restoreFailedMessage } = await import('../renderer/src/submission-state.js');

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

test('copying a message that failed to sign in back to the draft keeps the notes it mentioned', () => {
  const chat = { messages: [{ role: 'user', text: 'see @[Launch plan]', mentions: [plan] }, { role: 'assistant', text: '', authProvider: 'api', error: 'Sign in' }], draft: '', draftImages: [], draftMentions: [] };
  assert.equal(restoreFailedMessage(chat, 1), true);
  assert.equal(chat.draft, 'see @[Launch plan]');
  assert.deepEqual(mentionsFor(chat, chat.draft).map(r => r.id), [plan.id], 'the resent token still names its note');
  assert.notEqual(chat.draftMentions[0], chat.messages[0].mentions[0], 'a copy, not the message\'s own record');
});

// What a send names after an edit, by how the token got back into the draft. Only the draft's own picks count, and
// only while their token is in it: hand typing never brings a deleted pick back; a paste or Undo of it does.
test('a pick whose token left the draft is not sent: select all, delete, then type the same token by hand', () => {
  const input = document.createElement('textarea'); document.body.append(input);
  let chat;
  const picker = attachMentionPicker(input, () => chat);
  const edit = (value, inputType) => { input.value = value; input.setSelectionRange(value.length, value.length); input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType })); };
  const after = steps => { chat = { messages: [], draftMentions: [] }; edit('see @[Launch plan] ', 'insertText'); chat.draftMentions = [plan]; steps(); return mentionsFor(chat, input.value).map(r => r.id); };
  const table = {
    'kept': after(() => edit('see @[Launch plan] now', 'insertText')),
    'select all, delete, type it by hand': after(() => { edit('', 'deleteContentBackward'); edit('@[Launch plan]', 'insertText'); }),
    'delete the token, type it by hand': after(() => { edit('see ', 'deleteContentBackward'); edit('see @[Launch plan]', 'insertText'); }),
    'select all, delete, Undo': after(() => { edit('', 'deleteContentBackward'); edit('see @[Launch plan] ', 'historyUndo'); }),
    'cut it, paste it back': after(() => { edit('see ', 'deleteByCut'); edit('see @[Launch plan]', 'insertFromPaste'); }),
    'paste the token where it was never picked': (() => { chat = { messages: [], draftMentions: [] }; edit('see @[Launch plan]', 'insertFromPaste'); return mentionsFor(chat, input.value).map(r => r.id); })(),
    'delete it, send, paste it into the next draft': after(() => { edit('', 'deleteContentBackward'); chat.draftMentions = []; input.value = ''; edit('@[Launch plan]', 'insertFromPaste'); }),
  };
  picker.destroy(); input.remove();
  assert.deepEqual(table, {
    'kept': [plan.id],
    'select all, delete, type it by hand': [],
    'delete the token, type it by hand': [],
    'select all, delete, Undo': [plan.id],
    'cut it, paste it back': [plan.id],
    'paste the token where it was never picked': [],
    'delete it, send, paste it into the next draft': [],
  });
});
