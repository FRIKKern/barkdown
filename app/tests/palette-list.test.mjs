// Quick open's list (renderer/src/palette-list.js): a query is collected once and drawn. Collecting runs every
// search, and a chat profile over the search cache's size is reparsed by each one (main/chat-search.js), so the
// arrow keys and Enter work on the drawn list and never collect again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="p"><input id="i"><div id="l"></div></div></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'Node', 'getComputedStyle']) globalThis[name] = dom.window[name];
const { createPaletteList } = await import('../renderer/src/palette-list.js');

const key = k => ({ key: k, shiftKey: false, preventDefault() {} });
const settle = () => new Promise(r => setTimeout(r, 0));

// A palette whose collect counts its calls; `results` is what a collect would find now.
function setup(results) {
  const panel = document.getElementById('p'), input = document.getElementById('i'), list = document.getElementById('l');
  panel.hidden = false; input.value = '';
  const ran = [];
  const state = { results, collects: 0, gate: null };
  const item = label => ({ group: 'Chats', icon: 'search', label, hint: '', noFilter: true, run: () => ran.push(label) });
  const collect = async () => { state.collects++; const found = state.results.map(item); if (state.gate) await state.gate; return found; };
  const palette = createPaletteList({ panel, input, list, collect, scope: () => 'profile-a' });
  const highlighted = () => list.querySelector('[aria-selected="true"]')?.textContent;
  return { panel, input, palette, ran, state, highlighted };
}

test('moving through hits collects nothing: one collect for the query, none for the arrows or Enter', async () => {
  const p = setup(['first', 'second', 'third']);
  await p.palette.open();
  assert.equal(p.state.collects, 1);
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) assert.equal(p.palette.keydown(key(k)), true);
  await settle();
  assert.equal(p.state.collects, 1, 'an arrow key moves the highlight over the drawn rows; it does not search again');
  assert.equal(p.highlighted(), 'second', 'down three wraps to the top, up wraps to the bottom, down twice lands on the second');
  p.palette.keydown(key('Enter'));
  await settle();
  assert.equal(p.state.collects, 1, 'Enter runs a drawn row; it does not search again');
  assert.deepEqual(p.ran, ['second']);
  assert.equal(p.panel.hidden, true);
});

test('Enter runs the row highlighted on screen even when the results changed after the list was drawn', async () => {
  const p = setup(['Launch plan', 'Budget']);
  await p.palette.open();
  p.palette.keydown(key('ArrowDown'));
  assert.equal(p.highlighted(), 'Budget');
  p.state.results = ['Budget', 'Launch plan']; // a search now would put another item under the highlight
  p.palette.keydown(key('Enter'));
  await settle();
  assert.deepEqual(p.ran, ['Budget']);
  assert.equal(p.state.collects, 1);
});

test('Enter right after a keystroke waits for that keystroke\'s list, collects nothing more, and runs its top row', async () => {
  const p = setup(['old top', 'old second']);
  await p.palette.open();
  p.palette.keydown(key('ArrowDown'));
  let open; p.state.gate = new Promise(r => { open = r; });
  p.state.results = ['new top', 'new second'];
  p.input.value = 'n'; p.palette.open(); // the input event for a keystroke
  p.palette.keydown(key('Enter'));
  await settle();
  assert.deepEqual(p.ran, [], 'nothing runs from the list drawn for the previous query');
  open();
  await settle(); await settle();
  assert.deepEqual(p.ran, ['new top'], 'the new query starts at the top, and that is what Enter runs once it is drawn');
  assert.equal(p.state.collects, 2, 'one collect per query: the open and the keystroke');
});
