// The canvas emits patch/insert/remove/move ops; older servers reject move-block. These checks emulate
// the server's op semantics and assert the rewritten batches land in the order the canvas intended.
import { normaliseOps, reinsertMoves } from '../shared/ops.js';

const assert = (ok, message) => { if (!ok) throw new Error(message); };

// Server emulation (patch.ex semantics): sequential, ids must be unique, insert-after needs an existing anchor.
function applyOnServer(blocks, ops) {
  let list = blocks.map(b => ({ ...b }));
  let minted = 0;
  const has = id => list.some(b => b.id === id);
  for (const op of ops) {
    if (op.op === 'move-block') throw new Error('every op must name a known DocPatchOp');
    if (op.op === 'append-block') { const id = op.block.id || `srv-${minted++}`; if (has(id)) throw new Error('duplicate_id'); list.push({ ...op.block, id }); }
    else if (op.op === 'insert-after') { const id = op.block.id || `srv-${minted++}`; if (has(id)) throw new Error('duplicate_id'); const i = list.findIndex(b => b.id === op.afterId); if (i === -1) throw new Error('block_not_found ' + op.afterId); list.splice(i + 1, 0, { ...op.block, id }); }
    else if (op.op === 'remove-block') { const i = list.findIndex(b => b.id === op.id); if (i === -1) throw new Error('block_not_found ' + op.id); list.splice(i, 1); }
    else if (op.op === 'replace-block') { const i = list.findIndex(b => b.id === op.id); if (i === -1) throw new Error('block_not_found'); list[i] = { ...op.block, id: op.id }; }
    else if (op.op === 'patch-block') { const b = list.find(b => b.id === op.id); if (!b) throw new Error('block_not_found ' + op.id); Object.assign(b, op.patch); }
    else throw new Error('unknown op ' + op.op);
  }
  return list;
}

// What the canvas intended: apply the raw ops with move-block support.
function intended(blocks, ops) {
  let list = blocks.map(b => ({ ...b }));
  let n = 0;
  for (const op of ops) {
    if (op.op === 'append-block') list.push({ ...op.block, id: op.block.id || `new-${n++}` });
    else if (op.op === 'insert-after') { const i = list.findIndex(b => b.id === op.afterId); list.splice(i + 1, 0, { ...op.block, id: op.block.id || `new-${n++}` }); }
    else if (op.op === 'remove-block') list = list.filter(b => b.id !== op.id);
    else if (op.op === 'move-block') { const i = list.findIndex(b => b.id === op.id); const [b] = list.splice(i, 1); const j = op.after == null ? -1 : list.findIndex(x => x.id === op.after); list.splice(j + 1, 0, b); }
    else if (op.op === 'replace-block') { const i = list.findIndex(b => b.id === op.id); list[i] = { ...op.block, id: op.id }; }
    else if (op.op === 'patch-block') Object.assign(list.find(b => b.id === op.id), op.patch);
  }
  return list;
}

const text = value => ({ type: 'paragraph', content: [{ type: 'text', value }] });
const base = () => [{ id: 'b0', ...text('zero') }, { id: 'b1', ...text('one') }, { id: 'b2', ...text('two') }, { id: 'b3', ...text('three') }];
const textsOf = list => list.map(b => b.content?.[0]?.value ?? b.type);

function check(name, ops, blocks = base()) {
  const want = textsOf(intended(blocks, ops));
  const shaped = normaliseOps(ops, blocks);
  let got;
  try { got = textsOf(applyOnServer(blocks, shaped.ops)); }
  catch (error) {
    assert(/known DocPatchOp/.test(error.message), `${name}: unexpected server error ${error.message}`);
    const alt = reinsertMoves(shaped.ops, blocks);
    assert(alt, `${name}: no fallback for a reorder`);
    got = textsOf(applyOnServer(blocks, alt));
  }
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: server order ${JSON.stringify(got)} != intended ${JSON.stringify(want)}`);
  console.log('ok', name, '->', got.join(','));
}

// 1. Enter-split as the canvas emits it: insert-after + move-block that only re-establishes order.
check('enter split at end', [{ op: 'insert-after', afterId: 'b0', block: { id: 'c-1', ...text('') } }, { op: 'move-block', id: 'b1', after: 'b0' }, { op: 'patch-block', id: 'b1', patch: text('one typed') }]);
// 2. Move up one.
check('move up one', [{ op: 'move-block', id: 'b3', after: 'b1' }]);
// 3. Move down one.
check('move down one', [{ op: 'move-block', id: 'b1', after: 'b2' }]);
// 4. Move to the very top.
check('move to top', [{ op: 'move-block', id: 'b3', after: null }]);
// 5. Move to the bottom.
check('move to bottom', [{ op: 'move-block', id: 'b0', after: 'b3' }]);
// 6. Move with an edit in the same batch.
check('move and patch', [{ op: 'patch-block', id: 'b2', patch: text('two edited') }, { op: 'move-block', id: 'b2', after: 'b0' }]);
// 7. Duplicate (insert-after with a fresh block) plus a real move.
check('insert and move', [{ op: 'insert-after', afterId: 'b1', block: { id: 'c-9', ...text('dup') } }, { op: 'move-block', id: 'b0', after: 'b3' }]);
// 8. Removal plus move.
check('remove and move', [{ op: 'remove-block', id: 'b1' }, { op: 'move-block', id: 'b3', after: 'b0' }]);
// 9. Plain patches pass through untouched.
{ const ops = [{ op: 'patch-block', id: 'b1', patch: text('x') }]; const shaped = normaliseOps(ops, base()); assert(shaped.ops === ops, 'patch-only batch must pass through unchanged'); console.log('ok patch passthrough'); }
console.log('Ops rewrite checks passed.');
