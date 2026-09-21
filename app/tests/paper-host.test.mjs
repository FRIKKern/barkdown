// Real Paper host with controlled transport/canvas seams: async ownership, not editor fidelity.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="bw-toasts"></div><div id="bw-dialog" hidden></div></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window','document','HTMLElement','customElements','CustomEvent','Node','NodeFilter']) globalThis[name] = dom.window[name];
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.matchMedia = () => ({ matches: false });
let transport;
window.barkdown = {
  barkpark: { get: id => transport.get(id), applyOps: (...args) => transport.applyOps(...args), patchTitle: (...args) => transport.patchTitle(...args), backlinks: async () => [], history: async () => [], bundle: () => transport.bundle?.() || Promise.resolve({}), onLocalStatus: () => () => {} },
  docs: { paperProposals: id => transport.proposals?.(id) || Promise.resolve([]), agentEdit: async () => null },
};
class Canvas extends HTMLElement {
  pending = false; acknowledgements = []; echoes = [];
  connectedCallback() { this.innerHTML = '<div class="ProseMirror" tabindex="0"></div>'; }
  hasPendingChanges() { return this.pending; }
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
const paper = (id, rev = 1) => ({ id, slug: id, title: id, rev, blocks: [{ id: id + '-p', type: 'paragraph', content: [{ type: 'text', value: id }] }] });
const mount = () => {
  const host = document.createElement('div'); document.body.append(host);
  const tab = { id: 'test', source: 'barkpark', path: ['A'] };
  const changes = [];
  const controller = mountPaper(tab, host, { tabChanged() {}, libraryChanged() {}, userIsEditing() {}, documentChanged: d => changes.push(d.id) });
  return { host, tab, changes, controller, canvas: () => host.querySelector('bp-paper-canvas'), close() { controller.destroy(); host.remove(); } };
};
const cases = [];
async function test(name, fn) { try { await fn(); cases.push({ name, pass: true }); } catch(error) { cases.push({name, pass:false, error:error.message}); } }

await test('a cold bundle resolves before committing destination identity or mounting either canvas', async () => {
  const bundle=deferred();transport={get:async id=>paper(id),bundle:()=>bundle.promise};
  const m=mount();await tick();assert.equal(m.canvas(),null);assert.equal(m.tab.title,undefined);
  m.tab.path=['B'];m.controller.navigate();await tick();assert.equal(m.canvas(),null);assert.equal(m.tab.title,undefined);
  bundle.resolve({});await tick();
  try {assert.equal(m.canvas().blocks[0].id,'B-p');assert.equal(m.tab.title,'B');} finally {m.close();}
});
await test('late initial load cannot replace a newer destination', async () => {
  const a = deferred(); transport = { get: id => id === 'A' ? a.promise : Promise.resolve(paper(id)) };
  const m = mount(); m.tab.path = ['B']; m.controller.navigate(); await tick();
  a.resolve(paper('A')); await tick();
  try { assert.equal(m.canvas().blocks[0].id, 'B-p'); assert.equal(m.tab.title, 'B'); } finally { m.close(); }
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
await test('pending title save prevents navigation and remains owned by its paper', async () => {
  const save = deferred(); const writes=[];
  transport = { get: async id => paper(id), patchTitle: (...args) => { writes.push(args); return save.promise; } };
  const m=mount(); await tick(); const title=m.host.querySelector('#title');title.value='Renamed A';title.onchange();
  m.tab.path=['B'];m.controller.navigate();await tick();
  try { assert.deepEqual(m.tab.path,['A']); assert.deepEqual(writes,[['A','Renamed A']]); save.resolve();await tick();assert.equal(m.tab.title,'Renamed A'); }
  finally {save.resolve();m.close();}
});
await test('failed title remains editable until retry or explicit discard', async () => {
  transport={get:async id=>paper(id),patchTitle:async()=>{throw new Error('offline');}};
  const m=mount();await tick();const title=m.host.querySelector('#title');title.value='Unsent title';await title.onchange();
  try {assert.equal(title.value,'Unsent title');assert.equal(m.controller.canClose(),false);m.host.querySelector('[data-act="discard-title"]').click();assert.equal(title.value,'A');assert.equal(m.controller.canClose(),true);}
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
  transport={get:async id=>paper(id),patchTitle:(id,title)=>{writes.push([id,title]);return writes.length===1?first.promise:second.promise;}};
  const m=mount();await tick();const title=m.host.querySelector('#title');title.value='First title';title.onchange();title.value='Latest title';title.oninput();title.onchange();
  try {assert.equal(writes.length,1);first.resolve();await tick();assert.deepEqual(writes,[['A','First title'],['A','Latest title']]);assert.equal(title.value,'Latest title');second.resolve();await tick();assert.equal(m.tab.title,'Latest title');assert.equal(m.controller.isDirty(),false);}finally{first.resolve();second.resolve();m.close();}
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
console.log(JSON.stringify(cases, null, 2));
dom.window.close();
if (cases.some(c => !c.pass)) process.exitCode = 1;
