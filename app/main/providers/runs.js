// Shared run registry, approval gate and activity derivation for every provider.
const path = require('path');
const crypto = require('crypto');
const { captureScope } = require('./run-scope');

const runs = new Map();
// Short in-process history handles runs that finish before start() returns. This
// is a driver-finalization acknowledgement, not proof of OS descendant death.
const completed = new Map();

function createRun({ chatId, context, send, provider, scope, storeDir, profileId, connection, onFinish, batchText = false }) {
  scope ||= captureScope({ context, storeDir, profileId, connection });
  const id = crypto.randomUUID();
  const run = { id, chatId, context: scope.context, scope, provider, approvals: new Map(), abort: new AbortController(), cancelled: false, text: '', onCancel: null, onFinish };
  run.completion = new Promise(resolve => { run.resolveCompletion = resolve; });
  let sequence = 0;
  const deliver = event => {
    if (event.target?.kind === 'doc' && event.target.source === 'barkpark') {
      let paperOwner = run.paperOwner || null;
      if (!paperOwner && !run.scope.connection.viaCli && run.scope.connection.enabled) paperOwner = require('../paper-navigation').createPaperNavigation(run.scope.store).identify(run.scope.connection);
      event = { ...event, target: { ...event.target, paperOwner } };
    }
    if (event.type === 'done') run.outcome = { status: event.cancelled ? 'cancelled' : 'completed' };
    if (event.type === 'error') run.outcome = { status: 'failed', message: event.message };
    send({ ...event, runId: id, chatId, provider, profileId: scope.profileId, sequence: ++sequence });
  };
  // Only provider drivers opt in. An owned-worker bridge forwards its child's
  // already batched events without introducing another delay or losing metadata.
  const stream = batchText ? require('./stream-emitter').createStreamEmitter(deliver, { onError(error) {
    run.streamError ||= error;
    run.outcome = { status: 'failed', message: error.message };
    cancel(run.id);
  } }) : null;
  run.emit = stream ? stream.emit : deliver;
  run.flushEvents = () => stream?.flush();
  run.closeEvents = () => stream?.close();
  runs.set(id, run);
  return run;
}

async function finish(run) {
  if (!run.finishing) run.finishing = Promise.resolve().then(async () => {
    try {
      try { run.flushEvents?.(); } catch (error) { run.streamError ||= error; }
      await run.onFinish?.({ runId: run.id, profileId: run.scope.profileId, chatId: run.chatId, cancelled: run.cancelled });
      return { ok: true };
    } catch (error) {
      run.finishError = error;
      try { run.emit({ type: 'error_note', message: 'Run cleanup failed; its owned runtime may still need recovery.', cleanupFailed: true }); } catch {}
      return { ok: false, error };
    } finally {
      try { run.closeEvents?.(); } catch (error) { run.streamError ||= error; }
      runs.delete(run.id);
      const result = Object.freeze({ runId: run.id, profileId: run.scope.profileId, chatId: run.chatId, provider: run.provider,
        ...(run.outcome || { status: run.cancelled ? 'cancelled' : 'finished' }), cancelled: run.cancelled,
        ...(run.streamError ? { status: 'failed', message: run.streamError.message } : {}),
        ...(run.finishError ? { status: 'cleanup-failed', cleanupFailed: true } : {}) });
      completed.set(run.id, result);
      while (completed.size > 200) completed.delete(completed.keys().next().value);
      run.resolveCompletion(result);
    }
  });
  return run.finishing;
}

function waitForRunFinish(runId) {
  if (runs.has(runId)) return runs.get(runId).completion;
  if (completed.has(runId)) return Promise.resolve(completed.get(runId));
  return Promise.reject(new Error('Unknown or expired run completion'));
}

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
  try { run.flushEvents?.(); } catch { /* The failed sink is retained on the run. */ }
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
function activityForTool(run, toolName, input = {}, resultText = '') {
  const documents = run.scope?.documents || require('../documents');
  const folder = run.context.folder;
  const name = toolName.replace(/^mcp__barkdown__/, '');
  const isBarkdown = toolName.startsWith('mcp__barkdown__') || (input && input.__barkdown);
  if (isBarkdown || ['read_document', 'edit_document', 'propose_document_edit', 'edit_table', 'create_document', 'open_website', 'open_project_file'].includes(name)) {
    if ((name === 'read_document' || ['edit_document', 'propose_document_edit', 'edit_table'].includes(name)) && typeof input.id === 'string' && input.id.startsWith('bp:')) {
      const slug = input.id.slice(3);
      return { type: 'activity', target: { kind: 'doc', id: slug, source: 'barkpark', title: slug }, label: name === 'read_document' ? `Opened paper ${slug}` : `Edited paper ${slug}`, detail: name === 'read_document' ? 'Reading the Barkpark paper' : input.summary || '', agentEdit: name !== 'read_document', libraryChanged: name !== 'read_document' };
    }
    if (name === 'read_document' || ['edit_document', 'propose_document_edit', 'edit_table'].includes(name)) {
      documents.reload(input.id);
      const doc = documents.get(input.id);
      if (!doc) return null;
      return { type: 'activity', target: { kind: 'doc', id: doc.id, title: doc.title }, label: name === 'read_document' ? `Opened ${doc.title}` : `Edited ${doc.title}`, detail: name === 'read_document' ? 'Reading the document' : input.summary || '', agentEdit: name !== 'read_document', libraryChanged: name !== 'read_document' };
    }
    if (name === 'create_document') {
      // The MCP acknowledgement identifies the created record. Titles are not identities.
      const paperId = /^Created document bp:(drafts\.[\w-]+) \(/.exec(String(resultText))?.[1];
      if (paperId && run.scope?.connection.managedProfileId === run.scope?.profileId) {
        return { type: 'activity', target: { kind: 'doc', id: paperId, source: 'barkpark', title: input.title || 'Untitled' }, label: 'Created ' + (input.title || 'Untitled'), detail: 'New Paper note in the library', libraryChanged: true };
      }
      const id = /^Created document ([\w-]+) \(/.exec(String(resultText))?.[1];
      if (!id) return null;
      documents.reload(id);
      const doc = documents.get(id);
      return doc ? { type: 'activity', target: { kind: 'doc', id: doc.id, title: doc.title }, label: `Created ${doc.title}`, detail: 'New document in the library', libraryChanged: true } : null;
    }
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

async function preparePaperNavigation(run) {
  if (!run.scope.connection.enabled) return;
  const connection = await require('../paper-tool-connection').paperToolConnection(run.scope.connection)();
  run.paperOwner = require('../paper-navigation').createPaperNavigation(run.scope.store).identify(connection);
  run.scope = Object.freeze({ ...run.scope, connection: require('./run-scope').frozenCopy(connection) });
}

function mcpServerSpec(storeDir, scope) {
  const script = path.join(__dirname, '..', 'mcp-server.js');
  const underElectron = Boolean(process.versions.electron);
  const env = underElectron ? { ELECTRON_RUN_AS_NODE: '1' } : {};
  if (scope) {
    if (!scope.writerToken) throw new Error('MCP child requires its captured writer generation');
    env.BARKDOWN_RUN_CONNECTION = JSON.stringify(scope.connection);
    env.BARKDOWN_WRITER_TOKEN = JSON.stringify(scope.writerToken);
    env.BARKDOWN_BP_TOKEN = scope.connection.token || '';
    if (scope.profileId) env.BARKDOWN_PROFILE_ID = scope.profileId;
  } else if (process.env.BARKDOWN_BP_TOKEN) env.BARKDOWN_BP_TOKEN = process.env.BARKDOWN_BP_TOKEN;
  return { command: process.execPath, args: [script, storeDir], env };
}

function scratchFolder(storeDir) {
  const dir = path.join(storeDir, 'scratch');
  require('fs').mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { runs, captureScope, createRun, finish, waitForRunFinish, requestApproval, respondApproval, cancel, activityForTool, relativeTo, mcpServerSpec, scratchFolder, preparePaperNavigation };
