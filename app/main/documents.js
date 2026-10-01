// Local document store: the "content adapter" Barkdown talks to when no Barkpark server is connected.
// Documents keep identity, revisions, references and backlinks, mirroring the Barkpark Paper model.
const path = require('path');
const crypto = require('crypto');
const { markdownToDoc, docToMarkdown, docToText } = require('../shared/markdown');

// `seed` is the legacy launch's welcome notes for an empty library; an assistant run or the MCP server
// must never write them (C087: nothing but the legacy launch writes the legacy store).
function createDocuments(store, { writer = null, lazyWriter = false, seed: seedByDefault = true } = {}) {
writer ||= require('./writer-admission').writerForStore(store, { lazy: lazyWriter });
const paperOwnership = require('./paper-evidence-owner').createPaperEvidenceOwner(store);
const MAX_REVISIONS = 60;
const cache = new Map();

function validId(id) { if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) throw new Error('Invalid local document ID'); return id; }
function fileFor(id) { return path.join('documents', validId(id) + '.json'); }

function slugify(title) {
  const base = String(title || 'untitled').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 48) || 'untitled';
  let id = base;
  let n = 2;
  while (cache.has(id) || store.readJson(fileFor(id), null)) id = `${base}-${n++}`;
  return id;
}

function reload(id) {
  if (!id) return loadAll();
  const doc = store.readJson(fileFor(id), null);
  if (doc && doc.id) cache.set(doc.id, doc); else cache.delete(id);
  return doc;
}

function loadAll({ seed: seedEmpty = seedByDefault } = {}) {
  void writer.token;
  cache.clear();
  for (const file of store.list('documents', '.json')) {
    const doc = store.readJson(file, null);
    if (doc && doc.id) cache.set(doc.id, doc);
  }
  if (!cache.size && seedEmpty) writer.run('documents.seed', seed);
  return cache;
}

function persist(doc) {
  cache.set(doc.id, doc);
  store.writeJson(fileFor(doc.id), doc);
  try { require('fs').writeFileSync(store.filePath(path.join('documents', doc.id + '.md')), `# ${doc.title}\n\n${doc.markdown}`); } catch {}
}

function extractReferences(content) {
  const refs = new Set();
  const walk = node => {
    for (const mark of node?.marks || []) {
      const href = mark.attrs?.href || '';
      const m = /^barkdown:\/\/doc\/([\w-]+)/.exec(href);
      if (m) refs.add(m[1]);
    }
    (node?.content || []).forEach(walk);
  };
  walk(content);
  return [...refs];
}

function summary(doc) {
  return { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, createdAt: doc.createdAt, rev: doc.rev, source: doc.source || 'local', ...(retainedNow() ? { retained: true } : {}), excerpt: (doc.text || '').slice(0, 160), references: doc.references || [], proposals: (doc.proposals || []).length, tags: doc.tags || [] };
}

let retainedCache = { at: 0, value: false };
function retainedNow() {
  const now = Date.now();
  if (now - retainedCache.at > 1000) retainedCache = { at: now, value: require('./migration-selection').selectionStatus(store).status === 'selected' };
  return retainedCache.value;
}
function list() {
  return [...cache.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map(summary);
}

function get(id) {
  reload(id);
  const doc = cache.get(id);
  if (!doc) return null;
  return { ...doc, ...(retainedNow() ? { retained: true } : {}), backlinks: backlinks(id) };
}

function create({ title, markdown, content, actor = 'you', tags = [] }) {
  const now = new Date().toISOString();
  const body = content || markdownToDoc(markdown || '');
  const doc = {
    id: slugify(title), title: title || 'Untitled', content: body, markdown: docToMarkdown(body), text: docToText(body),
    createdAt: now, updatedAt: now, rev: 1, references: extractReferences(body), tags, proposals: [], source: 'local',
    revisions: [{ rev: 1, at: now, actor, summary: 'Created', content: body }],
  };
  persist(doc);
  return get(doc.id);
}

function save(input) {
  validId(input.id);
  // Main process and provider MCP processes share this store. Check revisions while
  // holding the same per-document lock, rather than trusting a process-local cache.
  const fs = require('fs');
  const lock = store.filePath(path.join('documents', crypto.createHash('sha256').update(input.id).digest('hex') + '.lock'));
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let abandoned = false;
    try {
      const owner = Number(fs.readFileSync(lock, 'utf8'));
      if (Number.isSafeInteger(owner) && owner > 0) {
        try { process.kill(owner, 0); } catch (probe) { abandoned = probe.code === 'ESRCH'; }
      } else abandoned = Date.now() - fs.statSync(lock).mtimeMs > 30000;
      if (abandoned) { fs.unlinkSync(lock); fd = fs.openSync(lock, 'wx'); }
    } catch {}
    if (fd == null) throw new Error('Document is being saved elsewhere. Try again.');
  }
  fs.writeFileSync(fd, String(process.pid));
  try { reload(input.id); return saveCurrent(input); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function saveCurrent({ id, baseRev, content, title, proposals, actor = 'you', summary: note = 'Edited' }) {
  const doc = cache.get(id);
  if (!doc) throw new Error(`Unknown document ${id}`);
  if (baseRev != null && doc.rev !== baseRev) return { conflict: true, doc: get(id) };
  const now = new Date().toISOString();
  const body = content || doc.content;
  if (proposals) doc.proposals = proposals;
  Object.assign(doc, { content: body, title: title ?? doc.title, markdown: docToMarkdown(body), text: docToText(body), updatedAt: now, rev: doc.rev + 1, references: extractReferences(body) });
  doc.revisions = [{ rev: doc.rev, at: now, actor, summary: note, content: body }, ...(doc.revisions || [])].slice(0, MAX_REVISIONS);
  persist(doc);
  return { ok: true, doc: get(id) };
}

function remove(id) {
  validId(id);
  cache.delete(id);
  store.remove(fileFor(id));
  store.remove(path.join('documents', id + '.md'));
  return { ok: true };
}

function backlinks(id) {
  return [...cache.values()].filter(d => d.id !== id && (d.references || []).includes(id)).map(summary);
}

function related(id, limit = 6) {
  const doc = cache.get(id);
  if (!doc) return [];
  const words = new Set((doc.text || '').toLowerCase().split(/\W+/).filter(w => w.length > 4));
  const tags = new Set(doc.tags || []);
  return [...cache.values()].filter(d => d.id !== id).map(d => {
    const reasons = [];
    if ((d.references || []).includes(id)) reasons.push('links here');
    if ((doc.references || []).includes(d.id)) reasons.push('linked from here');
    const sharedTags = (d.tags || []).filter(t => tags.has(t));
    if (sharedTags.length) reasons.push('tags: ' + sharedTags.join(', '));
    const overlap = (d.text || '').toLowerCase().split(/\W+/).filter(w => words.has(w)).length;
    if (overlap > 8) reasons.push('shared vocabulary');
    return { ...summary(d), score: reasons.length * 10 + overlap, reasons };
  }).filter(d => d.reasons.length).sort((a, b) => b.score - a.score).slice(0, limit);
}

function history(id, limit = 30) {
  const doc = cache.get(id);
  return doc ? (doc.revisions || []).slice(0, limit).map(r => ({ rev: r.rev, at: r.at, actor: r.actor, summary: r.summary })) : [];
}

function restore(id, rev, actor = 'you') {
  const doc = cache.get(id);
  const revision = (doc?.revisions || []).find(r => r.rev === rev);
  if (!revision) throw new Error(`Revision ${rev} not found`);
  return save({ id, baseRev: doc.rev, content: revision.content, actor, summary: `Restored revision ${rev}` });
}

function search(query, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list().slice(0, limit).map(d => ({ ...d, score: 0, snippet: d.excerpt }));
  const terms = q.split(/\s+/);
  return [...cache.values()].map(doc => {
    const title = doc.title.toLowerCase();
    const text = (doc.text || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      const count = text.split(term).length - 1;
      score += Math.min(count, 5);
    }
    const at = text.indexOf(terms[0]);
    const snippet = at >= 0 ? (doc.text || '').slice(Math.max(0, at - 60), at + 100).replace(/\s+/g, ' ') : (doc.text || '').slice(0, 160);
    return { ...summary(doc), score, snippet };
  }).filter(d => d.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

function addProposal(id, proposal) {
  const doc = cache.get(id);
  if (!doc) throw new Error(`Unknown document ${id}`);
  const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'pending', ...proposal };
  doc.proposals = [...(doc.proposals || []), entry];
  persist(doc);
  return entry;
}

function resolveProposal(id, proposalId, accept, actor = 'you') {
  const doc = cache.get(id);
  const proposal = (doc?.proposals || []).find(p => p.id === proposalId);
  if (!proposal) throw new Error('Proposal not found');
  doc.proposals = doc.proposals.filter(p => p.id !== proposalId);
  if (!accept) { persist(doc); return { ok: true, doc: get(id) }; }
  let content;
  if (proposal.mode === 'replace') content = markdownToDoc(proposal.markdown);
  else if (proposal.mode === 'append') content = { type: 'doc', content: [...doc.content.content, ...markdownToDoc(proposal.markdown).content] };
  else if (proposal.mode === 'replace_block') {
    const blocks = [...doc.content.content];
    const index = Math.min(Math.max(proposal.blockIndex ?? 0, 0), blocks.length - 1);
    blocks.splice(index, 1, ...markdownToDoc(proposal.markdown).content);
    content = { type: 'doc', content: blocks };
  } else content = markdownToDoc(proposal.markdown);
  return save({ id, baseRev: doc.rev, content, proposals: doc.proposals, actor: proposal.actor || 'agent', summary: proposal.summary || 'Accepted agent proposal' });
}

function seed() {
  const overview = create({ title: 'Overview', actor: 'seed', tags: ['barkdown'], markdown: [
    'A place for your documents, conversations, and the work happening between them.',
    '## Keep the work in view',
    'Keep the conversation beside the work. Open a document, explore a website, or review a change without leaving the chat.',
    '## Connected through Barkpark',
    'Everything you make remains connected to its sources. Documents keep their identity, references, and revision history wherever they are opened.',
  ].join('\n\n') });
  create({ title: 'Interaction notes', actor: 'seed', tags: ['barkdown', 'design'], markdown: [
    'Different kinds of work. One familiar place to follow them.',
    '## Work tabs',
    'Each chat owns a workspace of tabs. A tab can hold a document, a website, a code review, a project editor, or another conversation.',
    '## Following the agent',
    'When you choose a tab yourself, keep it in view. The assistant can continue working without moving you away.',
    `See the [Overview](barkdown://doc/${overview.id}) for the product framing.`,
    '- [ ] Try Ctrl+K to jump anywhere',
    '- [ ] Give a chat a working folder and open the project editor',
  ].join('\n\n') });
}

// Proposals for Barkpark papers live beside the local library (papers themselves stay on the server).
function paperProposalsAll() { return store.readJson('paper-proposals.json', {}); }
function paperProposals(slug, config) {
  const entries = paperProposalsAll()[slug] || [];
  if (!config) return entries;
  const owner = paperOwnership.identify(config);
  return entries.filter(p => !p.paperOwner || p.paperOwner === owner).map(p => p.paperOwner ? p : { ...p, ownershipUnavailable: require('./paper-evidence-owner').unavailable });
}
function addPaperProposal(slug, proposal, config) {
  const all = paperProposalsAll();
  const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'pending', ...proposal };
  if (config) entry.paperOwner = paperOwnership.identify(config, { create: true });
  all[slug] = [...(all[slug] || []), entry];
  store.writeJson('paper-proposals.json', all);
  return entry;
}
function takePaperProposal(slug, proposalId, config) {
  const all = paperProposalsAll();
  const proposal = (all[slug] || []).find(p => p.id === proposalId);
  if (!proposal) throw new Error('Proposal not found');
  paperOwnership.assert(proposal, config);
  all[slug] = all[slug].filter(p => p.id !== proposalId);
  store.writeJson('paper-proposals.json', all);
  return proposal;
}

// After the library switch (migration-selection.js) this profile's notes live on
// Paper: the legacy store is retained read-only, and a switch that is mid-flight
// blocks legacy edits until it is resumed or rolled back. Paper proposals are not
// legacy notes and stay writable.
const legacyMutations = new Set(['create', 'save', 'remove', 'restore', 'addProposal', 'resolveProposal']);
function assertLegacyWritable(name) {
  if (!legacyMutations.has(name)) return;
  const selection = require('./migration-selection').selectionStatus(store);
  if (selection.status === 'selected') throw Object.assign(new Error('This profile\u2019s notes moved to Paper when the library was switched; the legacy note is retained read-only.'), { code: 'BARKDOWN_NOTES_ON_PAPER' });
  if (!['none', 'rolled-back'].includes(selection.status)) throw Object.assign(new Error('A library switch is in progress; resume or roll it back before editing legacy notes.'), { code: 'BARKDOWN_SELECTION_PENDING', selection: selection.status });
}
const mutations = { addPaperProposal, takePaperProposal, create, save, remove, restore, addProposal, resolveProposal };
return { writer, paperProposals, loadAll, reload, list, get, backlinks, related, history, search, summary,
  retained: () => require('./migration-selection').selectionStatus(store).status === 'selected',
  ...Object.fromEntries(Object.entries(mutations).map(([name, action]) => [name, (...args) => { assertLegacyWritable(name); return writer.run('documents.' + name, () => action(...args)); }])) };
}
module.exports = { ...createDocuments(require('./store'), { lazyWriter: true }), createDocuments };
