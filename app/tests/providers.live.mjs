import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// Explicitly spends the selected installed provider's quota. No authentication
// configuration is changed. The owned worker requires Windows containment.
const args = process.argv.slice(2);
const names = args.filter(arg => !arg.startsWith('--'));
const providers = names.length ? names : ['claude', 'codex'];
const supported = new Set(['claude', 'codex']);
function milliseconds(name, fallback) {
  const values = args.filter(arg => arg.startsWith(`--${name}=`));
  if (values.length > 1) throw Error(`Duplicate ${name}`);
  const value = values.length ? Number(values[0].split('=')[1]) : fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 900000) throw Error(`Invalid ${name}`);
  return value;
}
function bounded(promise, ms, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
}
let timeoutMs, cleanupMs;
try {
  if (providers.some(provider => !supported.has(provider)) || new Set(providers).size !== providers.length) throw Error('Choose claude and/or codex once each.');
  if (args.some(arg => arg.startsWith('--') && !/^--(timeout-ms|cleanup-ms)=/.test(arg))) throw Error('Unknown option');
  timeoutMs = milliseconds('timeout-ms', 180000);
  cleanupMs = milliseconds('cleanup-ms', 30000);
} catch (error) { console.error(error.message); process.exit(2); }

const require = createRequire(import.meta.url);
const { createStore } = require('../main/store.js');
const { createDocuments } = require('../main/documents.js');
const { captureScope } = require('../main/providers/run-scope.js');
const { createOwnedWorkerAgent } = require('../main/goal-worker-agent.js');
const { markdownToDoc } = require('../shared/markdown.js');
// Since the legacy retirement (C087 R4) an assistant edit lands only on a Paper. Under the isolated
// runtime (BARKDOWN_SHOTS_SERVER + BARKPARK_API_TOKEN) the fixture document is a Paper on it; without
// one the legacy fixture stays, and only the scenarios in which the edit is refused can pass.
const paperServer = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.BARKDOWN_SHOTS_SERVER || '') && process.env.BARKPARK_API_TOKEN ? process.env.BARKDOWN_SHOTS_SERVER : null;
async function paperHttp(method, route, body) {
  const response = await fetch(paperServer + route, { method, redirect: 'error', headers: { authorization: 'Bearer ' + process.env.BARKPARK_API_TOKEN, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  let data = null; try { data = await response.json(); } catch {}
  if (!response.ok) throw Error(`${method} ${route} answered ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data && typeof data === 'object' && data.result && typeof data.result === 'object' ? data.result : data;
}
const readPaper = async slug => { const r = await paperHttp('GET', `/v1/data/doc/production/paper/${slug}?perspective=raw`); return r.document || r; };
const blockText = block => (block?.content || []).map(node => node.value ?? node.text ?? '').join('');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-provider-proof-'));
const report = { version: 1, root, fixture: paperServer ? 'a Paper on the isolated runtime' : 'a legacy document (edits are refused since C087 R4)', authentication: 'Existing device provider login; no profile-authentication-isolation claim', results: [] };
const reportPath = path.join(root, 'report.json');
const persist = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Retained provider evidence: ${reportPath}`);
let uncertainCleanup = false;
for (const provider of providers) {
  const storeDir = path.join(root, provider), folder = path.join(storeDir, 'working-folder');
  fs.mkdirSync(folder, { recursive: true });
  const store = createStore(storeDir), documents = createDocuments(store);
  const identity = crypto.randomUUID();
  const marker = `Barkdown verified append ${identity}`;
  const seed = `Original fixture ${identity}`;
  const sentinel = path.join(folder, 'fixture-sentinel.txt');
  fs.writeFileSync(sentinel, seed, { flag: 'wx' });
  let original, connection = { enabled: false, viaCli: false, writes: false };
  if (paperServer) {
    const slug = `provider-proof-${identity.slice(0, 8)}`;
    await paperHttp('POST', '/v1/data/mutate/production', { mutations: [{ createOrReplace: { _id: 'proof', _type: 'tag', title: 'Proof' } }, { publish: { id: 'proof', type: 'tag' } }] });
    await paperHttp('POST', `/v1/plugins/bulldocs/papers/${slug}/create`, { slug, title: `Provider proof ${identity}`, style: 'article', dedup_bypass: true, description: 'A disposable Paper for the provider truth runner', tags: [{ tag: 'proof', strength: 95, rationale: 'Provider truth runner fixture' }], blocks: [{ id: 'seed', type: 'paragraph', content: [{ type: 'text', value: seed }] }] });
    const paper = await readPaper(slug);
    original = { id: 'bp:' + slug, slug, rev: paper.rev, title: paper.title, blocks: paper.blocks };
    connection = { enabled: true, server: paperServer, token: process.env.BARKPARK_API_TOKEN, dataset: 'production', viaCli: false, writes: true };
  } else original = documents.create({ title: `Provider proof ${identity}`, markdown: seed });
  const profileId = crypto.randomUUID(), attemptId = crypto.randomUUID();
  const scope = captureScope({ profileId, storeDir, context: { folder }, connection });
  const agent = createOwnedWorkerAgent();
  const result = { provider, profileId, attemptId, documentId: original.id, marker, beforeRev: original.rev, events: [], pass: false, driverFinished: false, terminationVerified: false };
  report.results.push(result); persist();
  let runId, finishPromise, rejectFailure, observedFailure;
  const failure = new Promise((_, reject) => { rejectFailure = error => { observedFailure ||= error; reject(error); }; }); failure.catch(() => {});
  try {
    const started = await bounded(Promise.resolve(agent.start({ provider, scope, storeDir, profileId, attemptId, chatId: `proof-${identity}`, context: scope.context, settings: {}, images: [], session: null,
      prompt: `Use only Barkdown document MCP tools. Read document ${original.id}. Append exactly one paragraph containing exactly ${JSON.stringify(marker)} with edit_document mode append, preserving the existing paragraph. Then read the same document again to verify the saved change. Do not create another document, use shell commands, change files or request permissions. Finally reply done.`,
      send(event) {
        result.events.push(event); if (event.runId) runId ||= event.runId;
        if (event.type === 'tool_start') {
          const tool = String(event.tool || '').replace(/^mcp__barkdown__/, '');
          // Claude Code 2.1+ defers MCP tool schemas and loads the Barkdown ones through its own
          // ToolSearch before calling them: a meta-step of the CLI, not a document target.
          if (tool === 'ToolSearch' && /^select:(mcp__barkdown__[a-z_]+,?)+$/.test(String(event.input?.query || ''))) return;
          if (!['read_document', 'edit_document'].includes(tool) || event.input?.id !== original.id || (tool === 'edit_document' && (event.input.mode !== 'append' || event.input.markdown !== marker))) rejectFailure(Error('Unexpected tool or target outside the fixture contract'));
        }
        if (event.type === 'approval') { agent.respondApproval(event.runId, event.approvalId, false); rejectFailure(Error('Unexpected approval request denied')); }
        if (event.type === 'error' || event.type === 'error_note') rejectFailure(Error(event.message || 'Provider error'));
        if (event.type === 'tool_result' && event.ok !== true) rejectFailure(Error('Provider tool failed'));
        if (event.type === 'done' && event.cancelled) rejectFailure(Error('Provider cancelled'));
      },
    })), timeoutMs, 'Provider dispatch');
    runId = started.runId; result.runId = runId;
    finishPromise = agent.waitForRunFinish(runId);
    result.completion = await bounded(Promise.race([finishPromise, failure]), timeoutMs, 'Provider driver');
    result.driverFinished = true;
    if (observedFailure) throw observedFailure;
    if (result.completion.status !== 'completed' || result.completion.cancelled || result.completion.cleanupFailed) throw Error(`Provider completion: ${result.completion.status}`);
    if (!result.events.some(event => event.type === 'done' && !event.cancelled)) throw Error('No successful terminal event');
    const completedTools = [];
    const starts = new Map();
    for (const event of result.events) {
      if (event.type === 'tool_start') starts.set(event.toolUseId, event);
      if (event.type === 'tool_result' && event.ok === true) {
        const start = starts.get(event.toolUseId);
        if (start?.input?.id === original.id) completedTools.push(start.tool.replace(/^mcp__barkdown__/, ''));
      }
    }
    if (completedTools.join(',') !== 'read_document,edit_document,read_document') throw Error('Expected acknowledged read/edit/read of the fixture');
    // MCP/worker writes occur through a separate document adapter/cache.
    // Reload without seeding and also inspect filenames so malformed extras
    // cannot disappear from the parsed inventory and make it look exclusive.
    documents.loadAll({ seed: false });
    const folderEntries = fs.readdirSync(folder);
    const sentinelStat = fs.lstatSync(sentinel);
    if (folderEntries.length !== 1 || folderEntries[0] !== 'fixture-sentinel.txt' || !sentinelStat.isFile() || sentinelStat.isSymbolicLink() || fs.readFileSync(sentinel, 'utf8') !== seed) throw Error('Working-folder inventory/content changed outside the fixture contract');
    const inventory = documents.list();
    const documentFiles = store.list('documents', '.json');
    let saved, receipt;
    if (paperServer) {
      // The legacy store must hold nothing; the Paper must hold the seed and exactly the one appended paragraph.
      if (inventory.length !== 0 || documentFiles.length !== 0) throw Error('The legacy store gained documents; nothing may be written there');
      const paper = await readPaper(original.slug);
      const texts = (paper.blocks || []).map(blockText);
      if (paper.rev !== original.rev + 1 || paper.title !== original.title || JSON.stringify(texts) !== JSON.stringify([seed, marker])) throw Error('Paper revision/content did not match the unique edit: rev ' + paper.rev + ' ' + JSON.stringify(texts));
      saved = { rev: paper.rev }; receipt = scope.edits.latest(original.id, scope.connection);
    } else {
      if (inventory.length !== 1 || inventory[0].id !== original.id || documentFiles.length !== 1 || path.basename(documentFiles[0]) !== `${original.id}.json`) throw Error('Persisted document inventory differs from the fixture');
      saved = documents.get(original.id); receipt = scope.edits.latest(original.id);
      const expected = markdownToDoc(`${seed}\n\n${marker}`);
      if (!saved || saved.rev !== original.rev + 1 || saved.title !== original.title || JSON.stringify(saved.content) !== JSON.stringify(expected) || documents.list().length !== 1) throw Error('Persisted document revision/content did not match the unique edit');
    }
    if (!receipt || receipt.documentId !== original.id || receipt.beforeRev !== original.rev || receipt.afterRev !== saved.rev || receipt.mode !== 'append') throw Error('No matching direct-edit receipt');
    result.afterRev = saved.rev; result.receiptId = receipt.id;
    result.terminationVerified = await bounded(agent.verifyTermination({ request: { storeDir, profileId, attemptId }, runId }), cleanupMs, 'Owned termination verification');
    if (!result.terminationVerified) throw Error('Owned termination not verified');
    result.pass = true;
  } catch (error) {
    result.error = String(error.message || error);
    if (runId) {
      try {
        agent.cancel(runId);
        result.completion = await bounded(finishPromise || agent.waitForRunFinish(runId), cleanupMs, 'Cancelled driver cleanup');
        result.driverFinished = true;
        result.terminationVerified = await bounded(agent.verifyTermination({ request: { storeDir, profileId, attemptId }, runId }), cleanupMs, 'Cancelled owned termination');
      } catch (cleanupError) { result.cleanupError = String(cleanupError.message || cleanupError); }
    }
    if (!result.terminationVerified) uncertainCleanup = true;
  } finally {
    if (runId) result.runId = runId;
    // The Paper is retained beside the report the way a legacy fixture already is, after the store was checked.
    if (paperServer) { try { fs.mkdirSync(path.join(storeDir, 'documents'), { recursive: true }); fs.writeFileSync(path.join(storeDir, 'documents', encodeURIComponent(original.id) + '.json'), JSON.stringify(await readPaper(original.slug), null, 2) + '\n'); } catch (error) { result.retainedPaper = String(error.message); } }
    persist();
  }
  console.log(`${provider}: ${result.pass ? 'PASS' : 'FAIL'}; driverFinished=${result.driverFinished}; terminationVerified=${result.terminationVerified}`);
  if (!result.pass) break; // Never spend a second provider's quota after a failure.
}
process.exitCode = report.results.length === providers.length && report.results.every(result => result.pass) ? 0 : 1;
// On an unresponsive owned driver the parent exits nonzero; the existing native
// job helper owns parent-death teardown. This report never calls that verified.
if (uncertainCleanup) process.exit(1);
