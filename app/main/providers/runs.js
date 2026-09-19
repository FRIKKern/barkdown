// Shared run registry, approval gate and activity derivation for every provider.
const path = require('path');
const crypto = require('crypto');
const documents = require('../documents');

const runs = new Map();

function createRun({ chatId, context, send, provider }) {
  const id = crypto.randomUUID();
  const run = { id, chatId, context, provider, approvals: new Map(), abort: new AbortController(), cancelled: false, text: '', onCancel: null };
  run.emit = event => send({ runId: id, chatId, provider, ...event });
  runs.set(id, run);
  return run;
}

function finish(run) { runs.delete(run.id); }

function requestApproval(run, request) {
  return new Promise(resolve => {
    const id = crypto.randomUUID();
    run.approvals.set(id, resolve);
    run.emit({ type: 'approval', approvalId: id, request });
  });
}

function respondApproval(runId, approvalId, approved) {
  const run = runs.get(runId);
  const resolve = run?.approvals.get(approvalId);
  if (!resolve) return false;
  run.approvals.delete(approvalId);
  resolve(Boolean(approved));
  return true;
}

function cancel(runId) {
  const run = runs.get(runId);
  if (!run) return false;
  run.cancelled = true;
  run.abort.abort();
  for (const resolve of run.approvals.values()) resolve(false);
  run.approvals.clear();
  try { run.onCancel?.(); } catch {}
  return true;
}

function relativeTo(folder, file) {
  if (!folder || !file) return null;
  const rel = path.relative(folder, path.resolve(folder, file)).split(path.sep).join('/');
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : null;
}

// Map a provider's tool call to a Barkdown activity (which work tab to open) and refresh caches touched by MCP tools.
function activityForTool(run, toolName, input = {}) {
  const folder = run.context.folder;
  const name = toolName.replace(/^mcp__barkdown__/, '');
  const isBarkdown = toolName.startsWith('mcp__barkdown__') || (input && input.__barkdown);
  if (isBarkdown || ['read_document', 'propose_document_edit', 'create_document', 'open_website', 'open_project_file'].includes(name)) {
    if ((name === 'read_document' || name === 'propose_document_edit') && typeof input.id === 'string' && input.id.startsWith('bp:')) {
      const slug = input.id.slice(3);
      return { type: 'activity', target: { kind: 'doc', id: slug, source: 'barkpark', title: slug }, label: name === 'read_document' ? `Opened paper ${slug}` : `Proposed a change to paper ${slug}`, detail: name === 'read_document' ? 'Reading the Barkpark paper' : input.summary || '', proposalId: name === 'propose_document_edit' ? 'pending' : undefined };
    }
    if (name === 'read_document' || name === 'propose_document_edit') {
      documents.reload(input.id);
      const doc = documents.get(input.id);
      if (!doc) return null;
      return { type: 'activity', target: { kind: 'doc', id: doc.id, title: doc.title }, label: name === 'read_document' ? `Opened ${doc.title}` : `Proposed a change to ${doc.title}`, detail: name === 'read_document' ? 'Reading the document' : input.summary || '', proposalId: name === 'propose_document_edit' ? 'pending' : undefined };
    }
    if (name === 'create_document') { documents.loadAll(); const doc = documents.list().find(d => d.title === input.title); return doc ? { type: 'activity', target: { kind: 'doc', id: doc.id, title: doc.title }, label: `Created ${doc.title}`, detail: 'New document in the library', libraryChanged: true } : null; }
    if (name === 'open_website' && input.url) { const url = /^https?:/i.test(input.url) ? input.url : 'https://' + input.url; return { type: 'activity', target: { kind: 'web', url, title: hostname(url) }, label: 'Opened the website', detail: url }; }
    if (name === 'open_project_file' && input.path) { const rel = relativeTo(folder, input.path) || input.path; return { type: 'activity', target: { kind: 'project', path: rel, title: path.basename(rel) }, label: 'Opened a project file', detail: rel }; }
    return null;
  }
  const file = input.file_path || input.path || input.notebook_path;
  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName) && file) {
    const rel = relativeTo(folder, file);
    if (!rel) return null;
    const wrote = toolName !== 'Read';
    return { type: 'activity', target: { kind: 'project', path: rel, title: path.basename(rel) }, label: wrote ? `${toolName === 'Write' ? 'Wrote' : 'Edited'} ${path.basename(rel)}` : `Opened ${path.basename(rel)}`, detail: rel, fileChanged: wrote ? rel : undefined };
  }
  if (toolName === 'WebFetch' && input.url) return { type: 'activity', target: { kind: 'web', url: input.url, title: hostname(input.url) }, label: 'Opened the website', detail: input.url };
  return null;
}

function hostname(url) { try { return new URL(url).hostname; } catch { return url; } }

function mcpServerSpec(storeDir) {
  const script = path.join(__dirname, '..', 'mcp-server.js');
  const underElectron = Boolean(process.versions.electron);
  const env = underElectron ? { ELECTRON_RUN_AS_NODE: '1' } : {};
  if (process.env.BARKDOWN_BP_TOKEN) env.BARKDOWN_BP_TOKEN = process.env.BARKDOWN_BP_TOKEN;
  return { command: process.execPath, args: [script, storeDir], env };
}

function scratchFolder(storeDir) {
  const dir = path.join(storeDir, 'scratch');
  require('fs').mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { runs, createRun, finish, requestApproval, respondApproval, cancel, activityForTool, relativeTo, mcpServerSpec, scratchFolder };
