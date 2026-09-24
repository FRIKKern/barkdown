// Direct, revision-checked document edits shared by the API and signed-in providers.
const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const barkpark = require('./barkpark');
const { markdownToDoc } = require('../shared/markdown');
const { markdownToBlocks } = require('../shared/portabledoc');

function createAgentEdits({ store, documents }) {
const ownership = require('./paper-evidence-owner').createPaperEvidenceOwner(store);
const receiptPath = id => 'agent-edits/' + crypto.createHash('sha256').update(id).digest('hex') + '.json';
const ownedPath = (id, owner) => 'agent-edits/remote-' + crypto.createHash('sha256').update(JSON.stringify([id, owner])).digest('hex') + '.json';
async function withReceipt(id, config, operation) {
  const owner = id.startsWith('bp:') ? ownership.identify(config, { create: true }) : null;
  const name = owner ? ownedPath(id, owner) : receiptPath(id), file = store.filePath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lease = require('./file-lease').acquireFileLease(store.filePath(name + '.lock'), { completeOwner: true, busy: 'Another agent edit is running for this document. Read it again before retrying.' });
  try {
    let previous = null;
    try { previous = fs.readFileSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return await operation(receipt => require('./atomic-write').atomicWrite(file, Buffer.from(JSON.stringify(receipt, null, 2) + '\n'), {
      expectedBytes: previous, assertOwned: () => { store.filePath(name); lease.assertOwned(); },
    }));
  } finally { lease.release(); }
}
function latest(id, config) {
  if (!id.startsWith('bp:')) return store.readJson(receiptPath(id), null);
  const owner = config ? ownership.identify(config) : null;
  const owned = owner && store.readJson(ownedPath(id, owner), null);
  if (owned) { ownership.assert(owned, config); if (owned.documentId !== id) throw require('./paper-evidence-owner').ownerError(); return owned; }
  const legacy = store.readJson(receiptPath(id), null);
  return legacy ? { ...legacy, undoUnavailable: require('./paper-evidence-owner').unavailable } : null;
}
function remote(config) {
  if (!config?.enabled || !config.writes) throw new Error('Live editing is off. Enable Barkpark live editing before changing this paper.');
  const notes = require('./draft-notes').ownedDraftNotes(store, config);
  return {
    get: slug => notes && slug.startsWith('drafts.') ? notes.read(slug) : config.viaCli ? barkpark.cliGetPaper(slug, config.cliRouting) : barkpark.getPaper(config, slug),
    apply: (slug, ops, rev) => notes && slug.startsWith('drafts.') ? notes.apply(slug, ops, rev) : config.viaCli ? barkpark.cliApplyOps(slug, ops, rev, config.cliRouting) : barkpark.applyOps(config, slug, ops, rev),
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
async function apply(input, config, persist) {
  const { id, baseRev } = input;
  config = config && structuredClone(config);
  const paperOwner = id.startsWith('bp:') ? ownership.identify(config, { create: true }) : undefined;
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
    else if (input.mode === 'replace') ops = require('./paper-edit-ops').replaceBody(blocks, added);
    else {
      if (blocks[input.blockIndex].locked) throw new Error('This block is locked. Agent body edits preserve the title and locked slots.');
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
  const receipt = { id: crypto.randomUUID(), documentId: id, ...(paperOwner ? { paperOwner } : {}), beforeRev: before.rev, afterRev, mode: input.mode, blockIndex: input.blockIndex, summary: input.summary, at: new Date().toISOString(), before: id.startsWith('bp:') ? { blocks: before.blocks } : { content: before.content, title: before.title } };
  persist(receipt);
  return receipt;
}
async function applyTable(input, config, persist) {
  if (typeof input.id !== 'string' || !input.id.startsWith('bp:')) throw new Error('Structured table edits require a Barkpark paper.');
  config = structuredClone(config);
  const paperOwner = ownership.identify(config, { create: true });
  const api = remote(config), slug = input.id.slice(3), before = await api.get(slug);
  guard(before.rev, input.baseRev);
  const matches = (before.blocks || []).map((block, index) => ({ block, index })).filter(item => item.block.id === input.blockId);
  if (typeof input.blockId !== 'string' || !input.blockId || matches.length !== 1) throw new Error('Table identity no longer resolves uniquely. Read it again.');
  const { block, index } = matches[0];
  const patch = require('../shared/table-edits').tablePatch(block, input.cells);
  const result = await api.apply(slug, [{ op: 'patch-block', id: block.id, patch }], input.baseRev);
  if (!Number.isFinite(result.rev)) throw new Error('Server did not acknowledge a revision; read the paper before retrying.');
  const receipt = { id: crypto.randomUUID(), documentId: input.id, beforeRev: before.rev, afterRev: result.rev, mode: 'replace_block', blockIndex: index, blockId: block.id, summary: input.summary || 'Edited table cells', at: new Date().toISOString(), before: { blocks: before.blocks } };
  receipt.paperOwner = paperOwner;
  persist(receipt);
  return receipt;
}
async function undo(id, editId, config, persist) {
  config = config && structuredClone(config);
  const edit = latest(id, config);
  if (id.startsWith('bp:')) ownership.assert(edit, config);
  if (!edit || edit.id !== editId || edit.undone) throw new Error('This edit is no longer available to undo.');
  let result;
  if (id.startsWith('bp:')) {
    const api = remote(config), slug = id.slice(3), current = await api.get(slug);
    guard(current.rev, edit.afterRev);
    const ops = require('./paper-edit-ops').restoreBlocks(current.blocks, edit.before.blocks);
    result = await api.apply(slug, ops, current.rev);
    if (!Number.isSafeInteger(result.rev) || result.rev < current.rev) throw new Error('Undo was not acknowledged. Read the paper before retrying.');
  } else {
    documents.reload(id);
    guard(documents.get(id)?.rev, edit.afterRev);
    result = documents.save({ id, baseRev: edit.afterRev, ...edit.before, actor: 'you', summary: 'Undid assistant edit' });
    if (result.conflict) throw new Error('Document changed; Undo was not applied.');
  }
  persist({ ...edit, undone: true });
  return result;
}
return {
  apply: (input, config) => withReceipt(input.id, config, persist => apply(input, config, persist)),
  applyTable: (input, config) => withReceipt(input.id, config, persist => applyTable(input, config, persist)),
  undo: (id, editId, config) => withReceipt(id, config, persist => undo(id, editId, config, persist)), latest,
};
}
module.exports = { ...createAgentEdits({ store: require('./store'), documents: require('./documents') }), createAgentEdits };
