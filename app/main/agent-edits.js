// Direct, revision-checked document edits shared by the API and signed-in providers.
const crypto = require('crypto');
const store = require('./store');
const documents = require('./documents');
const barkpark = require('./barkpark');
const { markdownToDoc } = require('../shared/markdown');
const { markdownToBlocks } = require('../shared/portabledoc');

const receiptPath = id => 'agent-edits/' + crypto.createHash('sha256').update(id).digest('hex') + '.json';
function latest(id) { return store.readJson(receiptPath(id), null); }
function remote(config) {
  if (!config?.enabled || !config.writes) throw new Error('Live editing is off. Enable Barkpark live editing before changing this paper.');
  return {
    get: slug => config.viaCli ? barkpark.cliGetPaper(slug) : barkpark.getPaper(config, slug),
    apply: (slug, ops, rev) => config.viaCli ? barkpark.cliApplyOps(slug, ops, rev) : barkpark.applyOps(config, slug, ops, rev),
  };
}
function validate(input, blocks) {
  if (!['append', 'replace', 'replace_block'].includes(input.mode) || typeof input.markdown !== 'string') throw new Error('Invalid document edit.');
  if (input.mode === 'replace_block' && (!Number.isInteger(input.blockIndex) || !blocks[input.blockIndex])) throw new Error('Block no longer exists. Read the document again.');
}
function guard(actual, expected) {
  if (expected == null) throw new Error('Read the document before editing it.');
  if (actual !== expected) throw new Error('Document changed since it was read. Read it again before editing.');
}
async function apply(input, config) {
  const { id, baseRev } = input;
  let before, afterRev;
  if (id.startsWith('bp:')) {
    const api = remote(config), slug = id.slice(3);
    before = await api.get(slug);
    guard(before.rev, baseRev);
    const blocks = before.blocks;
    if (!Array.isArray(blocks)) throw new Error('This paper has no editable blocks.');
    validate(input, blocks);
    const added = markdownToBlocks(input.markdown).map(block => ({ ...block, id: 'agent-' + crypto.randomUUID() }));
    let ops;
    if (input.mode === 'append') ops = added.map(block => ({ op: 'append-block', block }));
    else if (input.mode === 'replace') ops = [...blocks.map(b => ({ op: 'remove-block', id: b.id })), ...added.map(block => ({ op: 'append-block', block }))];
    else {
      const target = blocks[input.blockIndex].id;
      if (!added.length) ops = [{ op: 'remove-block', id: target }];
      else {
        ops = [{ op: 'replace-block', id: target, block: { ...added[0], id: target } }];
        let afterId = target;
        for (const block of added.slice(1)) { ops.push({ op: 'insert-after', afterId, block }); afterId = block.id; }
      }
    }
    const result = await api.apply(slug, ops, baseRev);
    if (!Number.isFinite(result.rev)) throw new Error('Server did not acknowledge a revision; read the paper before retrying.');
    afterRev = result.rev;
  } else {
    documents.reload(id);
    before = structuredClone(documents.get(id));
    if (!before) throw new Error('Document not found.');
    guard(before.rev, baseRev);
    const blocks = before.content.content || [];
    validate(input, blocks);
    const added = markdownToDoc(input.markdown).content;
    const content = input.mode === 'replace' ? added : input.mode === 'append' ? [...blocks, ...added] : [...blocks.slice(0, input.blockIndex), ...added, ...blocks.slice(input.blockIndex + 1)];
    const result = documents.save({ id, baseRev, content: { type: 'doc', content }, actor: 'agent', summary: input.summary || 'Assistant edit' });
    if (result.conflict) throw new Error('Document changed. Read it again before editing.');
    afterRev = result.doc.rev;
  }
  const receipt = { id: crypto.randomUUID(), documentId: id, beforeRev: before.rev, afterRev, mode: input.mode, blockIndex: input.blockIndex, summary: input.summary, at: new Date().toISOString(), before: id.startsWith('bp:') ? { blocks: before.blocks } : { content: before.content, title: before.title } };
  store.writeJson(receiptPath(id), receipt);
  return receipt;
}
async function applyTable(input, config) {
  if (typeof input.id !== 'string' || !input.id.startsWith('bp:')) throw new Error('Structured table edits require a Barkpark paper.');
  const api = remote(config), slug = input.id.slice(3), before = await api.get(slug);
  guard(before.rev, input.baseRev);
  const matches = (before.blocks || []).map((block, index) => ({ block, index })).filter(item => item.block.id === input.blockId);
  if (typeof input.blockId !== 'string' || !input.blockId || matches.length !== 1) throw new Error('Table identity no longer resolves uniquely. Read it again.');
  const { block, index } = matches[0];
  const patch = require('../shared/table-edits').tablePatch(block, input.cells);
  const result = await api.apply(slug, [{ op: 'patch-block', id: block.id, patch }], input.baseRev);
  if (!Number.isFinite(result.rev)) throw new Error('Server did not acknowledge a revision; read the paper before retrying.');
  const receipt = { id: crypto.randomUUID(), documentId: input.id, beforeRev: before.rev, afterRev: result.rev, mode: 'replace_block', blockIndex: index, blockId: block.id, summary: input.summary || 'Edited table cells', at: new Date().toISOString(), before: { blocks: before.blocks } };
  store.writeJson(receiptPath(input.id), receipt);
  return receipt;
}
async function undo(id, editId, config) {
  const edit = latest(id);
  if (!edit || edit.id !== editId || edit.undone) throw new Error('This edit is no longer available to undo.');
  let result;
  if (id.startsWith('bp:')) {
    const api = remote(config), slug = id.slice(3), current = await api.get(slug);
    guard(current.rev, edit.afterRev);
    const ops = [...current.blocks.map(b => ({ op: 'remove-block', id: b.id })), ...edit.before.blocks.map(block => ({ op: 'append-block', block }))];
    result = await api.apply(slug, ops, current.rev);
  } else {
    documents.reload(id);
    guard(documents.get(id)?.rev, edit.afterRev);
    result = documents.save({ id, baseRev: edit.afterRev, ...edit.before, actor: 'you', summary: 'Undid assistant edit' });
    if (result.conflict) throw new Error('Document changed; Undo was not applied.');
  }
  store.writeJson(receiptPath(id), { ...edit, undone: true });
  return result;
}
module.exports = { apply, applyTable, latest, undo };
