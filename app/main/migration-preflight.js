// Offline preparation only. Callers must stop all source writers before use.
// This module cannot publish, switch navigation authority or delete legacy data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');
const { pmDocToBlocks } = require('../shared/portabledoc');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(value));
const roots = ['documents', 'attachments', 'agent-edits', 'workspace.json', 'paper-proposals.json'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function inspectContent(content) {
  const issues = [];
  const issue = (at, reason) => issues.push({ path: at, reason });
  function walk(node, at) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) { issue(at, 'Invalid node'); return; }
    const known = ['doc', 'paragraph', 'text', 'hardBreak', 'heading', 'codeBlock', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'table', 'tableRow', 'tableHeader', 'tableCell', 'horizontalRule'];
    if (!known.includes(node.type)) issue(at, 'Unsupported block or inline type: ' + node.type);
    for (const key of Object.keys(node)) if (!['type', 'content', 'text', 'marks', 'attrs'].includes(key)) issue(at + '.' + key, 'Unknown structural field');
    if (node.text !== undefined && (node.type !== 'text' || typeof node.text !== 'string')) issue(at + '.text', 'Invalid text carrier');
    if (node.type === 'text' && typeof node.text !== 'string') issue(at, 'Text must be a string');
    if (node.attrs != null && (typeof node.attrs !== 'object' || Array.isArray(node.attrs))) issue(at + '.attrs', 'Invalid attributes');
    const attrs = node.attrs || {};
    if (typeof attrs !== 'object' || Array.isArray(attrs)) issue(at + '.attrs', 'Invalid attributes');
    const allowed = { heading: ['level'], paragraph: ['textAlign'], orderedList: ['start'], taskItem: ['checked'], codeBlock: ['language'], tableCell: ['colspan', 'rowspan', 'colwidth', 'align', 'textAlign'], tableHeader: ['colspan', 'rowspan', 'colwidth', 'align', 'textAlign'] }[node.type] || [];
    for (const key of Object.keys(attrs)) if (!allowed.includes(key)) issue(at + '.attrs.' + key, 'Unmapped attribute');
    if (node.type === 'heading' && ![1, 2, 3].includes(attrs.level)) issue(at, 'Heading level is not preserved');
    if (node.type === 'paragraph' && attrs.textAlign != null && attrs.textAlign !== 'left') issue(at, 'Paragraph alignment is not preserved');
    if (node.type === 'orderedList' && attrs.start != null && attrs.start !== 1) issue(at, 'List start is not preserved');
    if (node.type === 'taskItem' && typeof attrs.checked !== 'boolean') issue(at, 'Task state must be boolean');
    if (node.type === 'codeBlock' && attrs.language != null && typeof attrs.language !== 'string') issue(at, 'Invalid code language');
    if (node.marks !== undefined && !Array.isArray(node.marks)) issue(at, 'Invalid marks');
    for (const [i, mark] of (Array.isArray(node.marks) ? node.marks : []).entries()) {
      const loc = at + '.marks[' + i + ']';
      if (!mark || !['bold', 'italic', 'underline', 'strike', 'code', 'link'].includes(mark.type)) { issue(loc, 'Unsupported mark'); continue; }
      if (node.type !== 'text') issue(loc, 'Marks on this node are not preserved');
      if (Object.keys(mark).some(k => !['type', 'attrs'].includes(k))) issue(loc, 'Unmapped mark metadata');
      if (mark.attrs != null && (typeof mark.attrs !== 'object' || Array.isArray(mark.attrs))) issue(loc, 'Invalid mark attributes');
      for (const key of Object.keys(mark.attrs || {})) if (mark.type !== 'link' || key !== 'href') issue(loc, 'Unmapped mark attribute: ' + key);
      if (mark.type === 'link') {
        if (typeof mark.attrs?.href !== 'string') issue(loc, 'Link requires href');
        else if (/^barkdown:/i.test(mark.attrs.href)) issue(loc, 'Internal link requires reference-map activation; not ready');
      }
    }
    if (node.content !== undefined && !Array.isArray(node.content)) issue(at, 'Invalid content array');
    const children = { doc: ['paragraph', 'heading', 'codeBlock', 'bulletList', 'orderedList', 'taskList', 'table', 'horizontalRule'], paragraph: ['text', 'hardBreak'], heading: ['text'], codeBlock: ['text'], bulletList: ['listItem'], orderedList: ['listItem'], taskList: ['taskItem'], listItem: ['paragraph'], taskItem: ['paragraph'], table: ['tableRow'], tableRow: ['tableHeader', 'tableCell'], tableHeader: ['paragraph'], tableCell: ['paragraph'] }[node.type] || [];
    for (const [i, child] of (Array.isArray(node.content) ? node.content : []).entries()) {
      if (!children.includes(child?.type)) issue(at + '.content[' + i + ']', 'Unsupported child structure');
      if (['heading', 'codeBlock'].includes(node.type) && (child?.marks?.length || child?.type !== 'text')) issue(at, 'Heading/code inline structure is not preserved');
      walk(child, at + '.content[' + i + ']');
    }
  }
  if (content?.type !== 'doc' || !Array.isArray(content?.content)) issue('$', 'Expected a document with content');
  walk(content, '$');
  if (!issues.length) { try { pmDocToBlocks(content); } catch (error) { issue('$', error.message); } }
  return issues;
}

function inventoryProfile({ profileId, sourceDir, quiesced }) {
  if (quiesced !== true) throw new Error('Preparation requires an offline, quiesced source');
  if (!UUID.test(profileId) || path.basename(path.resolve(sourceDir)) !== profileId) throw new Error('Profile identity does not match source directory');
  const store = createStore(sourceDir, { create: false });
  const files = [];
  let bytes = 0;
  function visit(relative) {
    const target = store.filePath(relative);
    let stat;
    try { stat = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isDirectory()) { for (const name of fs.readdirSync(target).sort()) visit(relative + '/' + name); return; }
    if (!stat.isFile()) throw new Error('Unsupported source entry: ' + relative);
    if (/\.(lock|tmp)$/.test(relative)) throw new Error('Source has an unfinished write: ' + relative);
    if (stat.size > 32 * 1024 * 1024 || bytes + stat.size > 256 * 1024 * 1024) throw new Error('Preparation size limit exceeded');
    const data = fs.readFileSync(store.filePath(relative));
    if (data.length > 32 * 1024 * 1024 || bytes + data.length > 256 * 1024 * 1024) throw new Error('Preparation size limit exceeded');
    bytes += data.length;
    files.push({ path: relative, bytes: data.length, sha256: hash(data), data });
  }
  roots.forEach(visit);
  if (!files.some(f => f.path === 'workspace.json')) throw new Error('Missing workspace; do not invent navigation');
  const issues = [], documents = [], ids = new Set();
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    let value;
    try { value = JSON.parse(file.data.toString('utf8')); } catch { issues.push({ file: file.path, reason: 'Invalid JSON' }); continue; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { issues.push({ file: file.path, reason: 'Expected JSON object' }); continue; }
    if (!/^documents\/[^/]+\.json$/.test(file.path)) continue;
    if (typeof value.id !== 'string' || !/^[\w-]+$/.test(value.id) || file.path !== `documents/${value.id}.json` || ids.has(value.id)) { issues.push({ file: file.path, reason: 'Invalid or duplicate document identity' }); continue; }
    ids.add(value.id);
    if (typeof value.title !== 'string' || !Number.isSafeInteger(value.rev) || value.rev < 1) issues.push({ file: file.path, reason: 'Invalid title or revision' });
    issues.push(...inspectContent(value.content).map(i => ({ file: file.path, ...i })));
    documents.push({ id: value.id, targetId: 'local-' + digest([profileId, value.id]).slice(0, 32), sourceHash: file.sha256 });
  }
  const entries = files.map(({ data, ...metadata }) => metadata);
  return { profileId, sourceDir: store.dir(), sourceHash: digest({ profileId, files: entries }), files, entries, documents, issues };
}

function safeDestination(dir) {
  for (let current = path.resolve(dir); ; current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Backup path traverses a symbolic link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(current) === current) break;
  }
}
function publish(file, data) {
  safeDestination(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  const fd = fs.openSync(temp, 'wx');
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  // Never overwrite an existing backup or committed manifest, even in a race.
  fs.linkSync(temp, file);
  fs.unlinkSync(temp);
}
function prepareMigration(options, { checkpoint = () => {} } = {}) {
  const snapshot = inventoryProfile(options);
  const destination = path.resolve(options.destinationDir);
  const inside = (a, b) => { const rel = path.relative(a, b); return !rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
  if (inside(snapshot.sourceDir, destination) || inside(destination, snapshot.sourceDir)) throw new Error('Backup and source must be disjoint');
  safeDestination(destination);
  const manifest = { version: 1, profileId: snapshot.profileId, sourceHash: snapshot.sourceHash, files: snapshot.entries, documents: snapshot.documents, issues: snapshot.issues, status: snapshot.issues.length ? 'blocked' : 'prepared', authority: 'legacy', serverWrites: false };
  const text = JSON.stringify(manifest, null, 2) + '\n';
  fs.mkdirSync(destination, { recursive: true });
  const intent = path.join(destination, 'intent.json');
  if (fs.existsSync(intent)) { safeDestination(intent); if (fs.readFileSync(intent, 'utf8') !== text) throw new Error('Source or preparation contract changed; retain this backup and prepare a new one'); }
  else {
    if (fs.readdirSync(destination).length) throw new Error('Unowned backup directory');
    publish(intent, text);
  }
  checkpoint('intent');
  for (const file of snapshot.files) {
    const target = path.join(destination, 'source', file.path);
    safeDestination(target);
    if (!fs.existsSync(target)) publish(target, file.data);
    if (hash(fs.readFileSync(target)) !== file.sha256) throw new Error('Backup readback mismatch: ' + file.path);
    checkpoint(file.path);
  }
  checkpoint('before-manifest');
  if (inventoryProfile(options).sourceHash !== snapshot.sourceHash) throw new Error('Source changed during preparation');
  const committed = path.join(destination, 'manifest.json');
  safeDestination(committed);
  if (!fs.existsSync(committed)) publish(committed, text);
  else if (fs.readFileSync(committed, 'utf8') !== text) throw new Error('Corrupt committed manifest');
  return manifest;
}

module.exports = { inspectContent, inventoryProfile, prepareMigration };
