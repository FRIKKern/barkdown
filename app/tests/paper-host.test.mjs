// Real Paper host with controlled transport/canvas seams: async ownership, not editor fidelity.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
const dom = new JSDOM('<!doctype html><body><div id="bw-toasts"></div><div id="bw-dialog" hidden></div></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','HTMLElement','customElements','CustomEvent','Node','NodeFilter']) globalThis[name] = dom.window[name];
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.matchMedia = () => ({ matches: false });
let transport;
window.barkdown = {
  paperDrafts: { retain: (...args) => transport.retain(...args), read: (...args) => transport.readDraft ? transport.readDraft(...args) : Promise.reject(new Error('Profile is preparing')), markUnsaved: (...args) => transport.markUnsaved?.(...args) },
  barkpark: { get: (...args) => transport.get(...args), applyOps: (...args) => transport.applyOps(...args), patchTitle: (...args) => transport.patchTitle(...args), backlinks: async () => [], history: () => transport.history?.() || Promise.resolve([]), bundle: () => transport.bundle?.() || Promise.resolve({}), onLocalStatus: () => () => {} },
  docs: { paperProposals: id => transport.proposals?.(id) || Promise.resolve([]), agentEdit: async () => null },
};
class Canvas extends HTMLElement {
  pending = false; acknowledgements = []; echoes = [];
  connectedCallback() {
    this.innerHTML = '<div class="ProseMirror" tabindex="0"></div>';
    if (transport.imageReady) {
      const image = document.createElement('img'); Object.defineProperty(image, 'complete', { value: false });
      if (transport.lazyImage) image.loading = 'lazy';
      image.decode = () => transport.imageReady; this.querySelector('.ProseMirror').append(image);
    }
  }
  hasPendingChanges() { return this.pending; }
  recoverySnapshot() { return this.snapshot || { mode: 'rich', blocks: this.blocks }; }
  flushPendingChanges() { this.flushed = true; }
  acknowledgeOps(seq) { this.acknowledgements.push(seq); this.pending = false; this.onAck?.(); }
  applyServerBlocks(blocks) { this.echoes.push(blocks); this.blocks = blocks; }
  applyServerBlocksIfIdle(blocks) { if (this.rejectExternal) return false; this.applyServerBlocks(blocks); return true; }
  resolveConflictWithServerBlocks(blocks) { this.blocks=blocks;this.pending=false; }
  discardInflightOps() { return true; }
  emit(seq = 1) { this.pending = true; this.dispatchEvent(new CustomEvent('bp-canvas-ops', { detail: { seq, ops: [{ op: 'patch-block', id: this.blocks[0].id, patch: { text: 'edited' } }] } })); }
}
customElements.define('bp-paper-canvas', Canvas);
const { mountPaper } = await import('../renderer/src/tabs/paper.js');
const { state } = await import('../renderer/src/state.js');
state.settings = { barkpark: { writes: true } };
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const paper = (id, rev = 1) => ({ id, slug: id, title: id, rev, binding: 'connection-A', blocks: [{ id: id + '-p', type: 'paragraph', content: [{ type: 'text', value: id }] }] });
const mount = (tabState = {}) => {
  const host = document.createElement('div'); document.body.append(host);
  const tab = { id: 'test', source: 'barkpark', path: ['A'], ...tabState };
  const changes = [];
  const controller = mountPaper(tab, host, { tabChanged() {}, libraryChanged() {}, userIsEditing() {}, documentChanged: d => changes.push(d.id) });
  return { host, tab, changes, controller, canvas: () => host.querySelector('bp-paper-canvas'), close() { controller.destroy(); host.remove(); } };
};
const cases = [];
const indexSource = fs.readFileSync(new URL('../renderer/src/index.js', import.meta.url), 'utf8');
const functionSource = (start, end) => {
  const from = indexSource.indexOf(start), next = indexSource.indexOf(end, from);
  assert(from >= 0 && next > from, 'navigation fixture must locate actual source boundaries');
  // The following declaration may now be async; exclude its complete line.
  return indexSource.slice(from, indexSource.lastIndexOf('\n', next) + 1);
};
function normalTabNavigation(m, kind) {
  const chat = { id: 'chat', active: m.tab.id, tabs: [m.tab], closedTargets: [] };
  const savePositions = new Function('workspaceChat', 'controllers', 'q', 'DIRECT',
    functionSource('function savePositions()', '// ---------- chats ----------') + '; return savePositions;')(
      () => chat, new Map([[m.tab.id, m.controller]]), () => ({ scrollTop: 0, value: '' }), 'direct');
  if (kind === 'focusTab') {
    return new Function('savePositions', 'pauseFollow', 'activeTab', 'hideMenus', 'renderTabs', 'renderWorkspace', 'save',
      functionSource('function focusTab(', 'function closeTab(') + '; return focusTab;')(
        savePositions, () => {}, () => m.tab, () => {}, () => {}, () => {}, () => {})(chat, m.tab.id);
  }
  return new Function('savePositions', 'pauseFollow', 'findTabForTarget', 'controllers', 'state', 'DIRECT', 'render', 'userIsTyping',
    functionSource('function openTarget(', 'function attachImages(') + '; return openTarget;')(
      savePositions, () => {}, () => m.tab, new Map([[m.tab.id, m.controller]]), { current: chat.id, mode: 'chat' }, 'direct', () => {}, () => false)(
        { kind: 'doc', id: 'A', source: 'barkpark' }, chat, true);
}
async function test(name, fn) { try { await fn(); cases.push({ name, pass: true }); } catch(error) { cases.push({name, pass:false, error:error.message}); } }

await test('a cold bundle resolves before committing destination identity or mounting either canvas', async () => {
  const bundle=deferred();transport={get:async id=>paper(id),bundle:()=>bundle.promise};
  const m=mount();await tick();assert.equal(m.canvas(),null);assert.equal(m.tab.title,undefined);
  m.tab.path=['B'];m.controller.navigate();await tick();assert.equal(m.canvas(),null);assert.equal(m.tab.title,undefined);
  bundle.resolve({});await tick();
  try {assert.equal(m.canvas().blocks[0].id,'B-p');assert.equal(m.tab.title,'B');} finally {m.close();}
});
await test('document targets reuse only tabs with the same explicit source', async () => {
  const find = new Function(functionSource('function findTabForTarget(', '// Open (or reuse)') + '; return findTabForTarget;')();
  const local={type:'doc',path:['A']},cloud={type:'doc',source:'barkpark',path:['A','B']};
  const chat={tabs:[local,cloud]};
  assert.equal(find(chat,{kind:'doc',id:'A'}),local);
  assert.equal(find(chat,{kind:'doc',id:'A',source:'barkpark'}),cloud);
  assert.equal(find({tabs:[local]},{kind:'doc',id:'A',source:'barkpark'}),undefined);
});
await test('opening an earlier target in a mounted Paper path changes the actual canvas', async () => {
  transport={get:async id=>paper(id)};
  const m=mount({path:['A','B']});await tick();await tick();
  try {
    assert.equal(m.canvas().blocks[0].id,'B-p');
    normalTabNavigation(m,'openTarget');await tick();await tick();
    assert.deepEqual(m.tab.path,['A']);assert.equal(m.canvas().blocks[0].id,'A-p');
  } finally {m.close();}
});
await test('opening an earlier target retains the current Paper when native changes are pending', async () => {
  transport={get:async id=>paper(id)};
  const m=mount({path:['A','B']});await tick();await tick();
  try {
    m.canvas().pending=true;normalTabNavigation(m,'openTarget');await tick();
    assert.deepEqual(m.tab.path,['A','B']);assert.equal(m.canvas().blocks[0].id,'B-p');assert.equal(m.canvas().pending,true);
  } finally {m.close();}
});

await test('an external edit during the first paper load is refreshed after mounting', async () => {
  const first = deferred(); let gets = 0;
  transport = { get: async id => ++gets === 1 ? first.promise : paper(id, 2) };
  const m = mount();
  await m.controller.refresh('bp:A');
  first.resolve(paper('A', 1)); await tick(); await tick();
  try { assert.equal(m.canvas().echoes.length, 1); assert.match(m.host.querySelector('#save-state').textContent, /Saved · rev 2/); }
  finally { m.close(); }
});
await test('human position takeover during loading still consumes a queued external edit', async () => {
  const first = deferred(); let gets = 0;
  transport = { get: async id => ++gets === 1 ? first.promise : paper(id, 2) };
  const m = mount({ scroll: 360 });
  try {
    m.host.querySelector('#current').dispatchEvent(new dom.window.Event('pointerdown'));
    await m.controller.refresh('bp:A');
    first.resolve(paper('A', 1)); await tick(); await tick(); await tick();
    assert.equal(m.canvas().echoes.length, 1);
    assert.match(m.host.querySelector('#save-state').textContent, /Saved · rev 2/);
    assert.equal(m.host.querySelector('#current').scrollTop, 0);
  } finally { first.resolve(paper('A', 1)); m.close(); }
});
await test('tab navigation during initial Paper read preserves the saved reading position', async () => {
  const read = deferred(); transport = { get: () => read.promise };
  const m = mount({ scroll: 360 });
  try {
    await tick(); assert.equal(m.canvas(), null);
    assert.equal(m.host.querySelector('#current').scrollTop, 0);
    // Normal focusTab/openTarget/savePositions calls every mounted controller,
    // including a Paper whose initial read has not returned yet.
    normalTabNavigation(m, 'focusTab'); normalTabNavigation(m, 'openTarget');
    assert.equal(m.tab.scroll, 360, 'loading DOM must not replace persisted nonzero position');
    read.resolve(paper('A')); await tick(); await tick(); await tick();
    assert.equal(m.host.querySelector('#current').scrollTop, 360);
    m.host.querySelector('#current').scrollTop = 240;
    m.controller.savePosition(); assert.equal(m.tab.scroll, 240, 'loaded user scrolling still saves');
    m.host.querySelector('#current').scrollTop = 0;
    normalTabNavigation(m, 'focusTab'); assert.equal(m.tab.scroll, 0, 'a loaded return to top is valid');
  } finally { read.resolve(paper('A')); await tick(); m.close(); }
});

await test('late initial load cannot replace a newer destination', async () => {
  const a = deferred(); transport = { get: id => id === 'A' ? a.promise : Promise.resolve(paper(id)) };
  const m = mount(); m.tab.path = ['B']; m.controller.navigate(); await tick();
  a.resolve(paper('A')); await tick();
  try { assert.equal(m.canvas().blocks[0].id, 'B-p'); assert.equal(m.tab.title, 'B'); } finally { m.close(); }
});
await test('pending initial layout preserves position but explicit user scrolling wins', async () => {
  for (const humanScroll of [false, true]) {
    const history = deferred(); transport = { get: async id => paper(id), history: () => history.promise };
    const m = mount({ scroll: 360 });
    try {
      await tick(); await tick(); assert(m.canvas());
      const scroller = m.host.querySelector('#current'); scroller.scrollTop = 0;
      if (humanScroll) scroller.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -360 }));
      normalTabNavigation(m, 'focusTab'); normalTabNavigation(m, 'openTarget');
      assert.equal(m.tab.scroll, humanScroll ? 0 : 360);
      history.resolve([]); await tick(); await tick(); await tick();
      assert.equal(scroller.scrollTop, humanScroll ? 0 : 360);
      m.controller.savePosition(); assert.equal(m.tab.scroll, humanScroll ? 0 : 360);
    } finally { history.resolve([]); await tick(); m.close(); }
  }
});
await test('undecoded initial images cannot acknowledge a clamped loading position', async () => {
  const image = deferred(); transport = { get: async id => paper(id), imageReady: image.promise };
  const m = mount({ scroll: 360 });
  try {
    await tick(); await tick(); const scroller = m.host.querySelector('#current'); scroller.scrollTop = 0;
    normalTabNavigation(m, 'openTarget'); assert.equal(m.tab.scroll, 360);
    image.resolve(); await tick(); await tick(); await tick();
    assert.equal(scroller.scrollTop, 360);
    scroller.scrollTop = 0; normalTabNavigation(m, 'focusTab'); assert.equal(m.tab.scroll, 0);
  } finally { image.resolve(); await tick(); m.close(); }
});
await test('human engagement before canvas readiness defeats late restoration', async () => {
  for (const event of ['pointerdown', 'keydown', 'beforeinput']) {
    const read = deferred(); transport = { get: () => read.promise };
    const m = mount({ scroll: 360 });
    try {
      const scroller = m.host.querySelector('#current');
      scroller.dispatchEvent(event === 'keydown' ? new dom.window.KeyboardEvent(event, { key: 'Home' }) : new dom.window.Event(event));
      normalTabNavigation(m, 'focusTab'); assert.equal(m.tab.scroll, 0);
      read.resolve(paper('A')); await tick(); await tick(); await tick();
      assert.equal(scroller.scrollTop, 0, 'late document arrival cannot snap back after engagement');
    } finally { read.resolve(paper('A')); await tick(); m.close(); }
  }
});
await test('an offscreen lazy image does not block initial restoration', async () => {
  const image = deferred(); transport = { get: async id => paper(id), imageReady: image.promise, lazyImage: true };
  const m = mount({ scroll: 360 });
  try {
    await tick(); await tick(); await tick();
    const scroller = m.host.querySelector('#current'); assert.equal(scroller.scrollTop, 360);
    scroller.scrollTop = 0; normalTabNavigation(m, 'focusTab'); assert.equal(m.tab.scroll, 0);
  } finally { image.resolve(); m.close(); }
});
await test('unresolved metadata never blocks navigation and a destroyed host never restores later', async () => {
  const history = deferred(); transport = { get: async id => paper(id), history: () => history.promise };
  const m = mount({ scroll: 360 });
  await tick();
  await Promise.race([m.controller.navigate(), new Promise((_, reject) => setTimeout(() => reject(new Error('layout blocked load')), 100))]);
  const scroller = m.host.querySelector('#current'); m.close(); scroller.scrollTop = 17;
  history.resolve([]); await tick(); await tick(); await tick();
  assert.equal(scroller.scrollTop, 17);
});
await test('reload preserves a pending human edit and the mounted canvas', async () => {
  transport = { get: async id => paper(id) };
  const m = mount(); await tick(); const canvas = m.canvas(); canvas.pending = true;
  m.host.querySelector('[title="Reload from server"]').click(); await tick();
  try { assert.equal(m.canvas(), canvas); assert.equal(canvas.pending, true); } finally { m.close(); }
});
await test('navigation refuses to discard pending content and restores the source path', async () => {
  transport = { get: async id => paper(id) };
  const m = mount(); await tick(); const canvas = m.canvas(); canvas.pending = true;
  m.tab.path = ['B']; m.controller.navigate(); await tick();
  try { assert.equal(m.canvas(), canvas); assert.deepEqual(m.tab.path, ['A']); } finally { m.close(); }
});
await test('a rejected batch stays on screen during reload', async () => {
  transport = { get: async id => paper(id), applyOps: async () => { throw new Error('offline'); } };
  const m = mount(); await tick(); const canvas = m.canvas(); canvas.emit(); await tick();
  m.host.querySelector('[title="Reload from server"]').click(); await tick();
  try { assert.equal(m.canvas(), canvas); assert.match(m.host.querySelector('#save-state').textContent, /Not saved/); } finally { m.close(); }
});
await test('reload requested during an in-flight write retains that document until acknowledgement', async () => {
  const save = deferred(); transport = { get: async id => paper(id), applyOps: () => save.promise };
  const m = mount(); await tick(); const canvas = m.canvas(); canvas.emit();
  m.tab.path = ['B']; m.controller.navigate(); await tick(); save.resolve({ rev: 2 }); await tick();
  try { assert.equal(m.canvas(), canvas); assert.deepEqual(m.tab.path, ['A']); assert.deepEqual(canvas.acknowledgements,[1]); assert.ok(m.changes.every(id => id === 'bp:A')); } finally { m.close(); }
});
await test('out-of-order save echoes cannot roll the acknowledged baseline back', async () => {
  const oldEcho = deferred(); let gets = 0;
  transport = { get: async id => ++gets === 2 ? oldEcho.promise : paper(id, gets > 2 ? 3 : 1), applyOps: async () => ({ rev: gets < 2 ? 2 : 3 }) };
  const m = mount(); await tick(); const canvas = m.canvas(); canvas.emit(1); await tick(); canvas.emit(2); await tick();
  oldEcho.resolve(paper('A',2)); await tick();
  try { assert.equal(canvas.echoes.length,1); assert.match(m.host.querySelector('#save-state').textContent,/rev 3/); } finally { m.close(); }
});
await test('human typing during a reload wins over its delayed response', async () => {
  let gets = 0; const reload = deferred();
  transport = { get: async id => ++gets === 1 ? paper(id) : reload.promise };
  const m = mount(); await tick(); const canvas = m.canvas();
  m.host.querySelector('[title="Reload from server"]').click(); canvas.pending = true;
  reload.resolve(paper('A',2)); await tick();
  try { assert.equal(m.canvas(),canvas); assert.equal(canvas.pending,true); } finally { m.close(); }
});
await test('a chained acknowledgement cannot clear the next batch save guard', async () => {
  let saves = 0; const second = deferred();
  transport = { get: async id => paper(id), applyOps: async () => ++saves === 1 ? { rev: 2 } : second.promise };
  const m = mount(); await tick(); const canvas = m.canvas();
  canvas.onAck = () => { canvas.onAck = null; canvas.emit(2); }; canvas.emit(1); await tick();
  // The host must guard an active transport even if the canvas itself has no pending flag.
  canvas.pending = false;
  m.host.querySelector('[title="Reload from server"]').click(); await tick();
  try { assert.equal(m.canvas(),canvas); assert.equal(m.controller.isDirty(),true); }
  finally { second.resolve({rev:3}); await tick(); m.close(); }
});
await test('wrapped titles retain single-line input and Enter respects composition', async () => {
  transport={get:async id=>paper(id),patchTitle:async()=>{}};
  const m=mount(); await tick(); const title=m.host.querySelector('#title');
  try {
    title.value='A\nlong\rtitle';title.setSelectionRange(11,11);title.oninput();
    assert.equal(title.value,'Alongtitle');assert.equal(m.controller.isDirty(),true);
    title.focus(); const composing=new dom.window.KeyboardEvent('keydown',{key:'Enter',isComposing:true,cancelable:true});title.dispatchEvent(composing);
    assert.equal(composing.defaultPrevented,false);assert.equal(document.activeElement,title);
    const enter=new dom.window.KeyboardEvent('keydown',{key:'Enter',cancelable:true});title.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented,true);assert.notEqual(document.activeElement,title);
  } finally { m.close(); }
});
await test('pending title save prevents navigation and remains owned by its paper', async () => {
  const save = deferred(); const writes=[];
  transport = { get: async id => paper(id), patchTitle: (...args) => { writes.push(args); return save.promise; } };
  const m=mount(); await tick(); const title=m.host.querySelector('#title');title.value='Renamed A';title.onchange();
  m.tab.path=['B'];m.controller.navigate();await tick();
  try { assert.deepEqual(m.tab.path,['A']); assert.deepEqual(writes,[['A','Renamed A','connection-A']]); save.resolve();await tick();assert.equal(m.tab.title,'Renamed A'); }
  finally {save.resolve();m.close();}
});
await test('failed title remains editable until retry or explicit discard', async () => {
  transport={get:async id=>paper(id),patchTitle:async()=>{throw new Error('offline');}};
  const m=mount();await tick();const title=m.host.querySelector('#title');title.value='Unsent title';await title.onchange();
  try {assert.equal(title.value,'Unsent title');assert.equal(m.controller.canClose(),false);m.host.querySelector('[data-act="discard-title"]').click();assert.equal(title.value,'A');assert.equal(m.controller.canClose(),true);}
  finally {m.close();}
});
function renameFromTab(m) {
  m.tab.type='doc';
  const chat={tabs:[m.tab]}, favorite={label:m.tab.title,target:{}};
  const rename=new Function('controllers','api','state','refreshLibrary','toast','errorMessage','renderTabs','favoriteKey','tabToTarget','render',
    functionSource('async function renameTab(', 'function startRenameTab(')+'; return renameTab;')(
      new Map([[m.tab.id,m.controller]]),window.barkdown,{chats:{},favorites:[favorite]},()=>{},()=>{},e=>e.message,()=>{},()=> 'same',()=> ({}),()=>{});
  return {favorite,rename:title=>rename(chat,m.tab.id,title)};
}
await test('tab rename waits for captured-owner acknowledgement before changing tab and favorite', async () => {
  const ack=deferred(),writes=[];transport={get:async id=>paper(id),patchTitle:(...args)=>{writes.push(args);return ack.promise;}};
  const m=mount();await tick();const ui=renameFromTab(m),pending=ui.rename('Acknowledged title');
  try {
    assert.equal(m.tab.title,'A');assert.equal(ui.favorite.label,'A');assert.equal(m.controller.canClose(),false);
    m.tab.path=['B'];await m.controller.navigate();assert.deepEqual(m.tab.path,['A']);
    assert.deepEqual(writes,[['A','Acknowledged title','connection-A']]);ack.resolve();await pending;
    assert.equal(m.tab.title,'Acknowledged title');assert.equal(ui.favorite.label,'Acknowledged title');
  } finally {ack.resolve();await pending;m.close();}
});
await test('refused tab rename retains title draft without relabelling the tab or favorite', async () => {
  const writes=[];transport={get:async id=>paper(id),patchTitle:async(...args)=>{writes.push(args);throw Error('paper_connection_changed');}};
  const m=mount();await tick();const ui=renameFromTab(m);
  try {
    await ui.rename('Unsent tab title');assert.deepEqual(writes,[['A','Unsent tab title','connection-A']]);
    assert.equal(m.tab.title,'A');assert.equal(ui.favorite.label,'A');assert.equal(m.host.querySelector('#title').value,'Unsent tab title');
    assert.equal(m.controller.canClose(),false);assert.match(m.host.querySelector('#title-error').textContent,/paper_connection_changed/);
    m.host.querySelector('[data-act="discard-title"]').click();assert.equal(m.host.querySelector('#title').value,'A');
  } finally {m.close();}
});
await test('tab rename cannot replace an unsaved human title', async () => {
  let writes=0;transport={get:async id=>paper(id),patchTitle:async()=>{writes++;}};
  const m=mount();await tick();const title=m.host.querySelector('#title');title.value='Human draft';title.oninput();
  try {await assert.rejects(m.controller.renameTitle('Tab overwrite'),/Finish saving/);assert.equal(title.value,'Human draft');assert.equal(writes,0);}
  finally {m.close();}
});
await test('destroyed host ignores late failed writes', async () => {
  const save=deferred();transport={get:async id=>paper(id),applyOps:()=>save.promise};
  const m=mount();await tick();m.canvas().emit();const pane=m.controller.el;m.close();save.reject(new Error('late failure'));await tick();
  assert.equal(pane.querySelector('[data-act="retry"]'),null);
});
await test('failed navigation read retains the old editor including input made during the read', async () => {
  const read=deferred();transport={get:async id=>id==='A'?paper(id):read.promise};
  const m=mount();await tick();const canvas=m.canvas();m.tab.path=['B'];m.controller.navigate();canvas.pending=true;read.reject(new Error('offline'));await tick();
  try {assert.equal(m.canvas(),canvas);assert.deepEqual(m.tab.path,['A']);assert.equal(canvas.pending,true);}finally{m.close();}
});
await test('failed navigation does not invalidate the retained title editor', async () => {
  transport={get:async id=>{if(id==='B')throw new Error('offline');return paper(id);},patchTitle:async()=>({})};
  const m=mount();await tick();m.tab.path=['B'];await m.controller.navigate();const title=m.host.querySelector('#title');title.value='Still editable';await title.onchange();
  try {assert.equal(m.tab.title,'Still editable');assert.equal(m.controller.isDirty(),false);}finally{m.close();}
});
await test('discard waits for a saved copy and cannot overwrite intervening input', async () => {
  let gets=0;const read=deferred();transport={get:async id=>++gets===1?paper(id):read.promise,applyOps:async()=>{throw new Error('offline');}};
  const m=mount();await tick();const canvas=m.canvas();canvas.emit();await tick();m.host.querySelector('[data-act="discard"]').click();await new Promise(r=>setTimeout(r,25));document.querySelector('#bw-dialog [data-ok]').click();await tick();
  canvas.dispatchEvent(new CustomEvent('beforeinput'));read.resolve(paper('A',2));await tick();
  try {assert.equal(canvas.pending,true);assert.ok(m.host.querySelector('[data-act="retry"]'));}finally{m.close();}
});
await test('title writes serialize while retaining a newer typed title', async () => {
  const first=deferred(),second=deferred(),writes=[];
  transport={get:async id=>paper(id),patchTitle:(id,title,binding)=>{writes.push([id,title,binding]);return writes.length===1?first.promise:second.promise;}};
  const m=mount();await tick();const title=m.host.querySelector('#title');title.value='First title';title.onchange();title.value='Latest title';title.oninput();title.onchange();
  try {assert.equal(writes.length,1);first.resolve();await tick();assert.deepEqual(writes,[['A','First title','connection-A'],['A','Latest title','connection-A']]);assert.equal(title.value,'Latest title');second.resolve();await tick();assert.equal(m.tab.title,'Latest title');assert.equal(m.controller.isDirty(),false);}finally{first.resolve();second.resolve();m.close();}
});
await test('choosing the server conflict version clears the dirty navigation guard', async () => {
  transport={get:async id=>paper(id,2),applyOps:async()=>{const error=new Error('conflict');error.status=412;throw error;}};
  const m=mount();await tick();m.canvas().emit();await tick();m.host.querySelector('[data-act="theirs"]').click();
  try {assert.equal(m.controller.isDirty(),false);assert.equal(m.controller.canClose(),true);}finally{m.close();}
});
await test('a fully acknowledged human edit during reload also defeats its stale snapshot', async () => {
  let proposals=0,gets=0;const held=deferred();
  transport={get:async id=>paper(id,++gets>2?2:1),proposals:()=>++proposals===2?held.promise:Promise.resolve([]),applyOps:async()=>({rev:2})};
  const m=mount();await tick();const canvas=m.canvas();const reload=m.controller.navigate();await tick();canvas.emit();await tick();assert.equal(m.controller.isDirty(),false);
  held.resolve([]);await reload;
  try {assert.equal(m.canvas(),canvas);assert.match(m.host.querySelector('#save-state').textContent,/rev 2/);}finally{m.close();}
});
await test('a fully saved title during reload defeats the stale title snapshot', async () => {
  let proposals=0;const held=deferred();
  transport={get:async id=>paper(id),proposals:()=>++proposals===2?held.promise:Promise.resolve([]),patchTitle:async()=>({})};
  const m=mount();await tick();const canvas=m.canvas();const reload=m.controller.navigate();await tick();const title=m.host.querySelector('#title');title.value='Fresh title';await title.onchange();assert.equal(m.controller.isDirty(),false);held.resolve([]);await reload;
  try {assert.equal(m.canvas(),canvas);assert.equal(title.value,'Fresh title');assert.equal(m.tab.title,'Fresh title');}finally{m.close();}
});
await test('a refused external application never advances the next write revision', async () => {
  let gets=0;const writes=[];transport={get:async id=>paper(id,++gets===1?1:2),applyOps:async(...args)=>{writes.push(args);return{rev:3};}};
  const m=mount();await tick();const canvas=m.canvas();canvas.rejectExternal=true;await m.controller.refresh();
  try {assert.equal(canvas.echoes.length,0);canvas.emit();await tick();assert.equal(writes[0][2],1);}finally{m.close();}
});
await test('an accepted external application advances the next write revision', async () => {
  let gets=0;const writes=[];transport={get:async id=>paper(id,++gets===1?1:2),applyOps:async(...args)=>{writes.push(args);return{rev:3};}};
  const m=mount();await tick();await m.controller.refresh();
  try {assert.equal(m.canvas().echoes.length,1);m.canvas().emit();await tick();assert.equal(writes[0][2],2);}finally{m.close();}
});
await test('older bundles retain their original revision and offer an explicit reload', async () => {
  let gets=0;const writes=[];transport={get:async id=>paper(id,++gets===1?1:2),applyOps:async(...args)=>{writes.push(args);return{rev:3};}};
  const m=mount();await tick();m.canvas().applyServerBlocksIfIdle=undefined;await m.controller.refresh();
  try {assert.equal(m.canvas().echoes.length,0);assert.match(m.host.querySelector('#save-state').textContent,/Update available/);m.canvas().emit();await tick();assert.equal(writes[0][2],1);}finally{m.close();}
});
await test('an outstanding own echo finishes before a newer external revision can be accepted', async () => {
  const oldEcho=deferred();let gets=0;const writes=[];
  transport={get:async id=>++gets===2?oldEcho.promise:paper(id,gets===1?1:3),applyOps:async(...args)=>{writes.push(args);return{rev:writes.length===1?2:4};}};
  const m=mount();await tick();const canvas=m.canvas();canvas.emit();await tick();await m.controller.refresh();
  assert.equal(canvas.echoes.length,0,'the existing save guard includes its outstanding echo read');
  oldEcho.resolve(paper('A',2));await tick();
  await m.controller.refresh();
  try {assert.equal(canvas.echoes.length,2);canvas.emit(2);await tick();assert.equal(writes[1][2],3);}finally{m.close();}
});
await test('connection change keeps the mounted buffer and forwards its original binding on retry and reload', async () => {
  const reads=[], writes=[]; let other=false;
  const failure=()=>Object.assign(new Error('Restore original connection'),{code:'paper_connection_changed'});
  transport={get:async(id,binding)=>{reads.push(binding);if(other&&binding)throw failure();return paper(id);},applyOps:async(...args)=>{writes.push(args);if(other)throw failure();return{rev:2};}};
  const m=mount();await tick();const canvas=m.canvas();other=true;canvas.emit();await tick();
  try {assert.equal(m.canvas(),canvas);assert.equal(m.controller.isDirty(),true);assert.equal(writes[0][3],'connection-A');assert.match(m.host.querySelector('#conflict').textContent,/Restore original connection/);
    other=false;canvas.emit(2);await tick();assert.equal(writes[1][3],'connection-A');assert.ok(reads.slice(1).every(b=>b==='connection-A'));
  } finally {m.close();}
});
await test('connection-change banner never labels the old paper as editing the new library', async () => {
  const old=state.settings;state.settings={barkpark:{writes:true,connectionIdentity:'A'}};transport={get:async id=>({...paper(id),connectionIdentity:'A'})};
  const m=mount();await tick();try {state.settings={barkpark:{writes:true,connectionIdentity:'B'}};m.controller.connectionChanged();assert.match(m.host.querySelector('#banner').textContent,/Connection changed/);assert.doesNotMatch(m.host.querySelector('#meta').textContent,/Editing live/);
    state.settings={barkpark:{writes:true,connectionIdentity:'A'}};m.controller.connectionChanged();assert.match(m.host.querySelector('#meta').textContent,/Editing live/);
  } finally {m.close();state.settings=old;}
});
await test('recovery flushes rich node controls and retains live projection plus exact unsaved title', async () => {
  let retained;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async (token, draft) => { retained = { token, draft }; return { key: 'retained' }; } };
  const m = mount(); await tick(); await tick();
  try {
    const c = m.canvas(), node = document.createElement('div'); node.dataset.bpType = 'code'; c.append(node);
    c.pending = true;
    node.addEventListener('bp-flush-node', () => { c.snapshot = { mode: 'rich', blocks: [{ id: 'code', type: 'code', value: 'pending code' }] }; });
    const title = m.host.querySelector('#title'); title.value = '  raw title  '; title.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const r = await m.controller.retainRecovery();
    assert.equal(r.current, true); assert.equal(retained.token, 'owned-A');
    assert.equal(retained.draft.title, '  raw title  '); assert.equal(retained.draft.baseRevision, 1);
    assert.equal(retained.draft.snapshot.blocks[0].value, 'pending code');
    assert.equal(c.blocks[0].id, 'A-p'); assert.equal(m.controller.isDirty(), true);
    assert.equal(c.flushed, undefined, 'does not force full canvas flush');
  } finally { m.close(); }
});
await test('recovery keeps raw Markdown source and refuses composition without ending it', async () => {
  let calls = 0;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async (_, d) => { calls++; assert.equal(d.snapshot.raw_source, '## Raw  \r\n'); return {}; } };
  const m = mount(); await tick(); await tick();
  try {
    const c = m.canvas(); c.snapshot = { mode: 'markdown', raw_source: '## Raw  \r\n', blocks: [] };
    const label = c.querySelector('.ProseMirror');
    label.dispatchEvent(new dom.window.Event('compositionstart', { bubbles: true }));
    assert.equal(m.controller.isDirty(), true);
    await assert.rejects(m.controller.retainRecovery(), /Finish composing/); assert.equal(calls, 0);
    assert.equal(c.flushed, undefined);
    label.dispatchEvent(new dom.window.Event('compositionend', { bubbles: true }));
    assert.equal((await m.controller.retainRecovery()).current, true); assert.equal(calls, 1);
    assert.equal(c.flushed, undefined);
  } finally { m.close(); }
});
await test('late local retention acknowledgement cannot certify newer typing or clear dirty state', async () => {
  const gate = deferred(); let retained;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async (_, d) => { retained = structuredClone(d); return gate.promise; } };
  const m = mount(); await tick(); await tick();
  try {
    const c = m.canvas(); c.pending = true; c.snapshot = { mode: 'rich', blocks: [{ text: 'first draft' }] };
    const result = m.controller.retainRecovery();
    c.snapshot = { mode: 'rich', blocks: [{ text: 'newer toolbar change without DOM input' }] };
    gate.resolve({ key: 'older-copy' });
    assert.equal((await result).current, false); assert.equal(retained.snapshot.blocks[0].text, 'first draft');
    assert.equal(c.snapshot.blocks[0].text, 'newer toolbar change without DOM input'); assert.equal(m.controller.isDirty(), true);
  } finally { gate.resolve({}); m.close(); }
});
await test('recovery retains original connection capability after Settings changes and refuses failed storage', async () => {
  const old = state.settings;
  state.settings = { barkpark: { writes: true, connectionIdentity: 'A' } };
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'original-owner', connectionIdentity: 'A' }), retain: async token => { assert.equal(token, 'original-owner'); throw new Error('Disk unavailable'); } };
  const m = mount(); await tick(); await tick();
  try {
    m.canvas().pending = true; state.settings = { barkpark: { writes: true, connectionIdentity: 'B' } };
    await assert.rejects(m.controller.retainRecovery(), /Disk unavailable/);
    assert.equal(m.controller.isDirty(), true); assert.equal(m.canvas().blocks[0].id, 'A-p');
  } finally { m.close(); state.settings = old; }
});
await test('recovery refuses unavailable or failed serialization before storage', async () => {
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => assert.fail('must not retain an incomplete projection') };
  const m = mount(); await tick(); await tick();
  try {
    m.canvas().snapshot = { mode: 'rich', serialization_error: 'failed', blocks: [] };
    await assert.rejects(m.controller.retainRecovery(), /serialization failed/);
    m.canvas().recoverySnapshot = undefined;
    await assert.rejects(m.controller.retainRecovery(), /serialization failed/);
  } finally { m.close(); }
});
await test('Paper preparation freeze holds its exact buffer and cannot outlive its owned controller', async () => {
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => ({ profileId: 'A', key: 'a'.repeat(64) }) };
  const m = mount(); await tick(); await tick();
  try {
    const lease = await m.controller.freezeRecovery();
    assert.equal(lease.profileId, 'A'); assert.equal(m.controller.el.inert, true); assert.equal(lease.assertCurrent(), true);
    assert.equal(m.controller.canClose(), false); assert.equal(m.canvas().flushed, undefined);
    await assert.rejects(m.controller.freezeRecovery(), /already frozen/);
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'late programmatic edit' }] };
    assert.equal(lease.assertCurrent(), false);
    lease.release(); assert.equal(Boolean(m.controller.el.inert), false);
    assert.equal(lease.assertCurrent(), false); assert.throws(() => lease.release(), /ownership changed/);
  } finally { m.close(); }
});
await test('Paper preparation refuses composition before moving focus and releases a failed persistence freeze', async () => {
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => { throw Error('Disk failed'); } };
  const m = mount(); await tick(); await tick();
  try {
    const title = m.host.querySelector('#title'); title.focus();
    title.dispatchEvent(new dom.window.Event('compositionstart', { bubbles: true }));
    await assert.rejects(m.controller.freezeRecovery(), /Finish composing/);
    assert.equal(Boolean(m.controller.el.inert), false); assert.equal(document.activeElement, title);
    title.dispatchEvent(new dom.window.Event('compositionend', { bubbles: true }));
    await assert.rejects(m.controller.freezeRecovery(), /Disk failed/);
    assert.equal(Boolean(m.controller.el.inert), false);
  } finally { m.close(); }
});
await test('late freeze acknowledgement refuses a changed buffer and releases only its own lock', async () => {
  const gate = deferred();
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: () => gate.promise };
  const m = mount(); await tick(); await tick();
  try {
    const freezing = m.controller.freezeRecovery(); assert.equal(m.controller.el.inert, true);
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'newer input' }] };
    gate.resolve({ profileId: 'A', key: 'a'.repeat(64) });
    await assert.rejects(freezing, /changed during preparation/); assert.equal(Boolean(m.controller.el.inert), false);
    assert.equal(m.canvas().snapshot.blocks[0].text, 'newer input');
  } finally { gate.resolve({}); m.close(); }
});
await test('quit treats a clean preparation freeze as saved without attempting a closed write', async () => {
  let writes = 0;
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => { writes++; throw new Error('Profile is preparing'); } };
  const m = mount(); await tick(); await tick();
  try {
    const lease = await m.controller.freezeRecovery({ retain: async () => ({ profileId: 'A', key: 'a'.repeat(64) }) });
    assert.equal(m.controller.isDirty(), true, 'preparation still blocks navigation');
    assert.equal(m.controller.canClose(), false);
    assert.deepEqual(await m.controller.settle({ timeoutMs: 0 }), { saved: true });
    assert.equal(writes, 0, 'clean frozen content needs no redundant recovery write');
    assert.equal(lease.assertCurrent(), true);
    lease.release();
  } finally { m.close(); }
});
await test('quit does not call changed frozen content saved when recovery is refused', async () => {
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => { throw new Error('Profile is preparing'); } };
  const m = mount(); await tick(); await tick();
  try {
    const lease = await m.controller.freezeRecovery({ retain: async () => ({ profileId: 'A', key: 'a'.repeat(64) }) });
    m.canvas().pending = true;
    const result = await m.controller.settle({ timeoutMs: 0 });
    assert.equal(result.saved, false); assert.equal(result.kept, false); assert.match(result.error, /Profile is preparing/);
    assert.equal(m.controller.isDirty(), true);
    lease.release();
  } finally { m.close(); }
});
await test('quit refuses a frozen projection that changed without a pending flag', async () => {
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => { throw new Error('Profile is preparing'); } };
  const m = mount(); await tick(); await tick();
  try {
    const lease = await m.controller.freezeRecovery({ retain: async () => ({ profileId: 'A', key: 'a'.repeat(64) }) });
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'late programmatic change' }] };
    assert.equal(m.canvas().hasPendingChanges(), false);
    assert.equal(lease.assertCurrent(), false);
    const result = await m.controller.settle({ timeoutMs: 0 });
    assert.equal(result.saved, false, 'the frozen projection must still match before saying saved');
    assert.equal(result.kept, false);
    lease.release();
  } finally { m.close(); }
});
await test('quit rejects content changed during retention or marker acknowledgement', async () => {
  for (const at of ['retain', 'mark']) {
    const gate = deferred(); let reached = false;
    transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }),
      retain: async () => { if (at === 'retain') { reached = true; await gate.promise; } return { key: 'a'.repeat(64) }; },
      markUnsaved: async () => { if (at === 'mark') { reached = true; await gate.promise; } } };
    const m = mount(); await tick(); await tick();
    try {
      m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'earlier words' }] }; m.canvas().pending = true;
      const result = m.controller.settle({ timeoutMs: 0 }); await tick(); assert.equal(reached, true);
      m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'later words' }] }; gate.resolve();
      assert.equal((await result).kept, false);
    } finally { gate.resolve(); m.close(); }
  }
});
await test('quit requires marker acknowledgement and rechecks successful proof', async () => {
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => ({ key: 'a'.repeat(64) }), markUnsaved: async () => { throw new Error('Marker disk failure'); } };
  const m = mount(); await tick(); await tick();
  try {
    m.canvas().pending = true;
    assert.equal((await m.controller.settle({ timeoutMs: 0 })).kept, false);
    transport.markUnsaved = async () => true;
    const result = await m.controller.settle({ timeoutMs: 0 }); assert.equal(result.kept, true); assert.equal(result.assertCurrent(), true);
    m.canvas().snapshot = { mode: 'rich', blocks: [{ text: 'later' }] }; assert.equal(result.assertCurrent(), false);
  } finally { m.close(); }
});
await test('dirty preparation receipt is reused only after owned exact readback', async () => {
  const owner = 'a'.repeat(64), key = 'b'.repeat(64); let draft;
  state.profileId = 'profile-A';
  transport = { get: async id => ({ ...paper(id), recoveryToken: 'owned-A' }), retain: async () => assert.fail('closed writer must not be used'), readDraft: async () => ({ key, content: { profileId: 'profile-A', documentId: 'A', paperOwner: owner, draft } }) };
  const m = mount({ paperOwner: owner }); await tick(); await tick();
  try {
    m.canvas().pending = true;
    const lease = await m.controller.freezeRecovery({ retain: async (_, value) => { draft = structuredClone(value); return { profileId: state.profileId, key }; } });
    const unlock = m.controller.lockForQuit();
    const result = await m.controller.settle({ timeoutMs: 0 }); assert.equal(result.kept, true); assert.equal(result.assertCurrent(), true);
    unlock(); assert.equal(m.controller.el.inert, true, 'preparation freeze survives quit refusal');
    draft.title = 'different retained title'; assert.equal((await m.controller.settle({ timeoutMs: 0 })).kept, false);
    lease.release();
  } finally { m.close(); delete state.profileId; }
});
console.log(JSON.stringify(cases, null, 2));
dom.window.close();
if (cases.some(c => !c.pass)) process.exitCode = 1;
