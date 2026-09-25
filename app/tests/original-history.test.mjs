import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { createDocuments } = require('../main/documents');
const { createAgentEdits } = require('../main/agent-edits');
const { prepareMigration } = require('../main/migration-preflight');
const { createOriginalHistory } = require('../main/original-history');

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-original-history-'));
  const profileId = crypto.randomUUID(), sourceDir = path.join(root, profileId), backupDir = path.join(root, 'backup');
  const store = createStore(sourceDir), docs = createDocuments(store); docs.loadAll({ seed: false });
  const doc = docs.create({ title: 'Retained original', markdown: 'Before the agent.' });
  const edits = createAgentEdits({ store, documents: docs });
  await edits.apply({ id: doc.id, baseRev: 1, mode: 'append', markdown: 'Agent wording.', summary: 'Agent addition' });
  docs.addProposal(doc.id, { mode: 'replace', baseRev: 2, markdown: 'Pending proposal.' });
  store.writeJson('workspace.json', { version: 1, chats: {}, order: [] });
  prepareMigration({ profileId, sourceDir, destinationDir: backupDir, quiesced: true });
  const viewerStore = createStore(path.join(root, 'viewer'));
  const service = createOriginalHistory({ store: viewerStore, profileId });
  return { root, profileId, backupDir, store, viewerStore, service, doc };
}
const bytes = root => {
  const result = {};
  function visit(dir) { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name); if (fs.statSync(p).isDirectory()) visit(p); else result[path.relative(root, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } }
  visit(root); return result;
};

test('registration is idempotent, survives restart, and never writes backup or original records', async () => {
  const f = await fixture(), original = bytes(f.store.dir()), backup = bytes(f.backupDir);
  assert.deepEqual(f.service.list(), []);
  const source = f.service.add(f.backupDir);
  assert.equal(f.service.add(f.backupDir).id, source.id);
  const restarted = createOriginalHistory({ store: createStore(f.viewerStore.dir()), profileId: f.profileId });
  assert.equal(restarted.list().length, 1);
  const record = restarted.read({ sourceId: source.id, documentId: f.doc.id });
  assert.equal(record.readOnly, true); assert.deepEqual(record.actions, []);
  assert.equal(record.document.revisions.length, 2); assert.equal(record.document.proposals.length, 1);
  assert.equal(record.latestAgentEdit.afterRev, 2);
  assert.deepEqual(bytes(f.store.dir()), original); assert.deepEqual(bytes(f.backupDir), backup);
});

test('foreign profile backup and registry substitution refuse without writing references', async () => {
  const f = await fixture();
  const foreign = createOriginalHistory({ store: f.viewerStore, profileId: crypto.randomUUID() });
  assert.throws(() => foreign.add(f.backupDir), e => e.code === 'backup_identity');
  assert.equal(fs.existsSync(f.viewerStore.filePath('original-history.json')), false);
  const source = f.service.add(f.backupDir);
  assert.throws(() => foreign.list(), e => e.code === 'history_registry');
  const another = createOriginalHistory({ store: createStore(path.join(f.root, 'other-view')), profileId: crypto.randomUUID() });
  assert.throws(() => another.read({ sourceId: source.id, documentId: f.doc.id }), e => e.code === 'history_owner');
});

test('changed or missing backup keeps its reference, exposes refusal and never substitutes live content', async () => {
  const f = await fixture(), source = f.service.add(f.backupDir);
  const originalReference = fs.readFileSync(f.viewerStore.filePath('original-history.json'));
  const document = path.join(f.backupDir, 'source/documents', f.doc.id + '.json');
  fs.appendFileSync(document, ' ');
  assert.match(f.service.list()[0].unavailable, /size|hash/);
  assert.throws(() => f.service.read({ sourceId: source.id, documentId: f.doc.id }), e => e.code === 'backup_bytes');
  fs.renameSync(f.backupDir, f.backupDir + '-retained');
  assert.ok(f.service.list()[0].unavailable);
  assert.deepEqual(fs.readFileSync(f.viewerStore.filePath('original-history.json')), originalReference);
});

test('manifest replacement with the same source files is rejected by its separately pinned hash', async () => {
  const f = await fixture(), source = f.service.add(f.backupDir);
  for (const name of ['manifest.json', 'intent.json']) { const p = path.join(f.backupDir, name); const v = JSON.parse(fs.readFileSync(p)); v.changedMetadata = true; fs.writeFileSync(p, JSON.stringify(v)); }
  assert.throws(() => f.service.read({ sourceId: source.id, documentId: f.doc.id }), e => e.code === 'history_changed');
  assert.match(f.service.list()[0].unavailable, /changed/);
});

test('corrupt reference registry is never interpreted as empty or overwritten', async () => {
  const f = await fixture(), p = f.viewerStore.filePath('original-history.json');
  fs.writeFileSync(p, '{partial');
  assert.throws(() => f.service.list(), e => e.code === 'history_registry');
  assert.throws(() => f.service.add(f.backupDir), e => e.code === 'history_registry');
  assert.equal(fs.readFileSync(p, 'utf8'), '{partial');
});

test('unrecognized source and document paths never become filesystem paths', async () => {
  const f = await fixture(), source = f.service.add(f.backupDir);
  assert.throws(() => f.service.read({ sourceId: '../backup', documentId: f.doc.id }), e => e.code === 'history_owner');
  assert.throws(() => f.service.read({ sourceId: source.id, documentId: '../other' }), e => e.code === 'evidence_identity');
  assert.throws(() => f.service.add('../backup'), e => e.code === 'history_path');
});
