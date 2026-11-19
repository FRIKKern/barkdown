// Which notes a send reads (renderer/src/note-mention.js#mentionsFor): only the tokens picked in this draft. A token
// typed by hand stays text even when an earlier message used the label; history Up brings a message back with its
// mention records (renderer/src/composer-history.js), so a recalled token still names its note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="app"></div><div id="bw-toasts"></div><textarea id="t"></textarea></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'InputEvent', 'KeyboardEvent', 'Node', 'getComputedStyle', 'innerWidth', 'innerHeight']) globalThis[name] = dom.window[name];
window.barkdown = {};
const { mentionsFor, attachMentionPicker } = await import('../renderer/src/note-mention.js');
const { recallComposer, composerDraftMentions } = await import('../renderer/src/composer-history.js');
const { restoreFailedMessage } = await import('../renderer/src/submission-state.js');
const { state } = await import('../renderer/src/state.js');

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
    // A paste, drop, Undo or Redo brings a pick back only when it adds that token; elsewhere it leaves a hand-typed one as text.
    'delete it, type it by hand, paste other words': after(() => { edit('', 'deleteContentBackward'); edit('@[Launch plan] ', 'insertText'); edit('@[Launch plan] and pasted words', 'insertFromPaste'); }),
    'delete it, type it by hand, drop other words': after(() => { edit('', 'deleteContentBackward'); edit('@[Launch plan] ', 'insertText'); edit('dropped @[Launch plan] ', 'insertFromDrop'); }),
    'delete it, type it and more by hand, Undo the more': after(() => { edit('', 'deleteContentBackward'); edit('@[Launch plan] ', 'insertText'); edit('@[Launch plan] more', 'insertText'); edit('@[Launch plan] ', 'historyUndo'); }),
    'delete it, type it by hand, Undo and Redo other typing': after(() => { edit('', 'deleteContentBackward'); edit('@[Launch plan] x', 'insertText'); edit('@[Launch plan] ', 'historyUndo'); edit('@[Launch plan] x', 'historyRedo'); }),
    'delete it, type it by hand, paste it a second time': after(() => { edit('', 'deleteContentBackward'); edit('@[Launch plan] ', 'insertText'); edit('@[Launch plan] @[Launch plan] ', 'insertFromPaste'); }),
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
    'delete it, type it by hand, paste other words': [],
    'delete it, type it by hand, drop other words': [],
    'delete it, type it and more by hand, Undo the more': [],
    'delete it, type it by hand, Undo and Redo other typing': [],
    'delete it, type it by hand, paste it a second time': [plan.id],
  });
});

// Notes titled alike, picked through the real menu. Within one draft a label names exactly one note for the draft's
// whole life, deleted picks included, so the note sent is always the one whose token is on screen.
const twins = [{ id: 'note-x', title: 'Twin plan' }, { id: 'note-y', title: 'Twin plan' }, { id: 'note-z', title: 'Twin plan' }];
function composer() {
  state.documents = twins; state.barkparkDocs = [];
  const input = document.createElement('textarea'); document.body.append(input);
  const chat = { id: 'c', messages: [], draftMentions: [] };
  const picker = attachMentionPicker(input, () => chat);
  const edit = (value, inputType) => { input.value = value; input.setSelectionRange(value.length, value.length); input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType })); };
  const press = key => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  // Type "@Twin" after the text, move to the nth row and press Enter; returns the label the pick wrote.
  const pick = n => {
    edit(input.value + '@Twin', 'insertText');
    for (let i = 0; i < n; i++) press('ArrowDown');
    press('Enter');
    const record = chat.draftMentions[chat.draftMentions.length - 1];
    assert.equal(record.id, twins[n].id, 'the menu picked the row asked for');
    return record.label;
  };
  return { input, chat, edit, pick, sent: () => mentionsFor(chat, input.value).map(r => r.id), done: () => { picker.destroy(); input.remove(); } };
}

test('the reviewer\'s steps: pick X "Twin plan", select all + Backspace, pick Y "Twin plan", select all + Backspace, Undo sends Y', () => {
  const t = composer();
  const x = t.pick(0);
  t.edit('', 'deleteContentBackward');
  const y = t.pick(1);
  const shown = t.input.value;
  t.edit('', 'deleteContentBackward');
  t.edit(shown, 'historyUndo');
  assert.deepEqual(t.sent(), ['note-y'], 'the token on screen is Y\'s');
  assert.notEqual(y, x, 'Y is numbered: a deleted pick keeps its label');
  t.done();
});

test('picking, deleting and re-picking notes titled alike in mixed order, with Undo and Redo: the note sent is the one on screen', () => {
  const t = composer();
  const owner = new Map(); // label -> the one note it names in this draft
  const history = [''];
  let at = 0;
  const push = () => { history.splice(at + 1, Infinity, t.input.value); at = history.length - 1; };
  const steps = {
    'pick X': () => { const label = t.pick(0); if (owner.has(label)) assert.equal(owner.get(label), 'note-x', `${label} names one note`); owner.set(label, 'note-x'); push(); },
    'pick Y': () => { const label = t.pick(1); if (owner.has(label)) assert.equal(owner.get(label), 'note-y', `${label} names one note`); owner.set(label, 'note-y'); push(); },
    'pick Z': () => { const label = t.pick(2); if (owner.has(label)) assert.equal(owner.get(label), 'note-z', `${label} names one note`); owner.set(label, 'note-z'); push(); },
    'select all, delete': () => { t.edit('', 'deleteContentBackward'); push(); },
    'Undo': () => { if (at > 0) t.edit(history[--at], 'historyUndo'); },
    'Redo': () => { if (at < history.length - 1) t.edit(history[++at], 'historyRedo'); },
  };
  const plan = ['pick X', 'select all, delete', 'pick Y', 'select all, delete', 'Undo', 'Undo', 'Undo', 'Redo', 'Redo', 'pick Z',
    'select all, delete', 'pick X', 'Undo', 'Undo', 'pick Y', 'select all, delete', 'Undo', 'Redo', 'Undo', 'pick Z', 'pick X', 'select all, delete', 'Undo'];
  const seen = [];
  for (const step of plan) {
    steps[step]();
    const onScreen = [...new Set([...t.input.value.matchAll(/@\[([^\]]+)\]/g)].map(m => owner.get(m[1])))];
    seen.push([step, t.input.value, t.sent()]);
    assert.deepEqual(t.sent(), onScreen, `after ${seen.map(s => s[0]).join(', ')}: ${JSON.stringify(t.input.value)}`);
  }
  assert.equal(new Set([...owner.keys()]).size, 3, 'three notes titled alike, three labels');
  t.done();
});
