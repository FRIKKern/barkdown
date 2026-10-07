// Bounded characterization of the actual importer; database restore is explicitly
// stubbed. Every byte belongs to a new disposable fixture, never a real library.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const root = process.cwd(), require = createRequire(path.join(root, 'app/package.json'));
const { createProfileImport } = require('./main/profile-import');
const { createProfileRegistry } = require('./main/profile-registry');
const { createStore } = require('./main/store');
const { createPaperEvidenceOwner } = require('./main/paper-evidence-owner');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const profile = '11111111-1111-4111-8111-111111111111', owner = 'a'.repeat(64);
const report = { at: new Date().toISOString(), source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  implementationSha256: sha(fs.readFileSync('app/main/profile-import.js')),
  scope: 'Disposable verified archive, actual import and registry, stubbed database restore; no native database, UI, Mac export or real content.', cases: [] };
for (const [name, manifestIdentity] of [['valid', profile], ['empty', ''], ['missing', undefined], ['short', 'note']]) {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-import-identity-'))), dir = path.join(temp, 'export');
  fs.mkdirSync(dir);
  const marker = `Keep profile ${profile} and owner ${owner} exactly.`;
  const workspace = { version: 1, profileId: profile, chats: { chat: { id: 'chat', title: marker, draft: marker, folder: `C:/notes/${profile}`, messages: [{ role: 'user', text: marker }, { role: 'assistant', text: marker, tools: [{ tool: 'read_document', output: marker }] }], tabs: [{ id: 'tab', type: 'doc', source: 'barkpark', paperOwner: owner, path: ['note-1'], title: marker }] } }, order: ['chat'], current: 'chat', pages: { roots: [`bp:v1:${owner}:note-1`] }, favorites: [] };
  const receipt = { id: 'receipt', paperOwner: owner, documentId: 'bp:note-1', beforeRev: 1, afterRev: 2, summary: marker, before: { blocks: [{ id: 'paragraph', type: 'paragraph', content: [{ type: 'text', value: marker }] }] } };
  const files = { 'database.dump': 'stub dump', 'profile/workspace.json': JSON.stringify(workspace), 'profile/agent-edits/receipt.json': JSON.stringify(receipt), 'profile/documents/original.json': JSON.stringify({ text: marker }) };
  for (const [name, text] of Object.entries(files)) { const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
  const entry = name => ({ path: name, bytes: Buffer.byteLength(files[name]), sha256: sha(files[name]) });
  const manifest = { version: 1, kind: 'barkdown-profile-export', profile: { ...(manifestIdentity === undefined ? {} : { id: manifestIdentity }), name: 'Disposable' }, upstream: 'pin', navigation: { owner }, database: entry('database.dump'), media: [], store: Object.keys(files).filter(n => n.startsWith('profile/')).map(entry) };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  const archiveBefore = sha(fs.readFileSync(path.join(dir, 'manifest.json')));
  const registry = createProfileRegistry(path.join(temp, 'destination'));
  const connection = { enabled: true, server: 'http://127.0.0.1:4999', token: 'disposable-stub-token', dataset: 'production', viaCli: false };
  let restores = 0;
  const importer = createProfileImport({ registry, source: '/stub/runtime', upstreamRef: () => 'pin', runtimePool: { restore: async () => { restores++; return { connection }; } } });
  const result = { name, temp, manifestIdentity: manifestIdentity ?? '(missing)', restores: 0 };
  try {
    const made = await importer.importProfile(dir), store = createStore(made.storeDir, { create: false });
    result.accepted = true; result.journal = made.record.phase;
    const newOwner = createPaperEvidenceOwner(store).identify(connection);
    try {
      const after = store.readJson('workspace.json', null), edit = store.readJson('agent-edits/receipt.json', null), chat = after.chats.chat;
      result.navigationRemapped = after.profileId === made.profileId && chat.tabs[0].paperOwner === newOwner && after.pages.roots[0] === `bp:v1:${newOwner}:note-1`;
      result.preserved = { draft: chat.draft === marker, title: chat.title === marker, message: chat.messages[0].text === marker, toolOutput: chat.messages[1].tools[0].output === marker, folder: chat.folder === workspace.chats.chat.folder, tabTitle: chat.tabs[0].title === marker, undoBefore: edit.before.blocks[0].content[0].value === marker, receiptSummary: edit.summary === marker };
      result.workspaceReadable = true;
    } catch (error) { result.workspaceReadable = false; result.readError = error.message; }
    result.originalPreserved = fs.readFileSync(path.join(made.storeDir, 'documents/original.json'), 'utf8') === files['profile/documents/original.json'];
  } catch (error) { result.accepted = false; result.error = { code: error.code, message: error.message }; }
  result.restores = restores;
  result.destinationCreated = Boolean(registry.load());
  result.sourceUnchanged = sha(fs.readFileSync(path.join(dir, 'manifest.json'))) === archiveBefore && Object.entries(files).every(([name, bytes]) => fs.readFileSync(path.join(dir, name), 'utf8') === bytes);
  assert.equal(result.sourceUnchanged, true);
  report.cases.push(result);
}
fs.writeFileSync('docs/cycles/evidence/C097/import-identity-characterization.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--assert-preserved')) {
  const valid = report.cases[0];
  assert.equal(valid.navigationRemapped, true, 'structured navigation is re-owned');
  assert.ok(Object.values(valid.preserved).every(Boolean), 'human text, paths and Undo before-content must survive import unchanged');
  assert.ok(report.cases.slice(1).every(c => !c.accepted && !c.destinationCreated && c.restores === 0), 'invalid profile identities must refuse before destination creation');
}
