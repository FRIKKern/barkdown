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
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-provider-proof-'));
const report = { version: 1, root, authentication: 'Existing device provider login; no profile-authentication-isolation claim', results: [] };
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
  const original = documents.create({ title: `Provider proof ${identity}`, markdown: seed });
  const profileId = crypto.randomUUID(), attemptId = crypto.randomUUID();
  const scope = captureScope({ profileId, storeDir, context: { folder }, connection: { enabled: false, viaCli: false, writes: false } });
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
    if (inventory.length !== 1 || inventory[0].id !== original.id || documentFiles.length !== 1 || path.basename(documentFiles[0]) !== `${original.id}.json`) throw Error('Persisted document inventory differs from the fixture');
    const saved = documents.get(original.id), receipt = scope.edits.latest(original.id);
    const expected = markdownToDoc(`${seed}\n\n${marker}`);
    if (!saved || saved.rev !== original.rev + 1 || saved.title !== original.title || JSON.stringify(saved.content) !== JSON.stringify(expected) || documents.list().length !== 1) throw Error('Persisted document revision/content did not match the unique edit');
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
  } finally { if (runId) result.runId = runId; persist(); }
  console.log(`${provider}: ${result.pass ? 'PASS' : 'FAIL'}; driverFinished=${result.driverFinished}; terminationVerified=${result.terminationVerified}`);
  if (!result.pass) break; // Never spend a second provider's quota after a failure.
}
process.exitCode = report.results.length === providers.length && report.results.every(result => result.pass) ? 0 : 1;
// On an unresponsive owned driver the parent exits nonzero; the existing native
// job helper owns parent-death teardown. This report never calls that verified.
if (uncertainCleanup) process.exit(1);
