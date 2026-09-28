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
const { canonical } = require('../main/migration-journal');
const { selectionStatus } = require('../main/migration-selection');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-docs-selection-'));
  const store = createStore(dir), documents = createDocuments(store);
  const note = documents.create({ title: 'Legacy note', markdown: 'Kept.' });
  const journal = phase => {
    const value = { version: 1, profileId: 'p', operationId: crypto.randomUUID(), phase, seal: { generation: 1 }, reportHash: 'r', workspaceBefore: 'b', workspaceAfter: 'a' };
    fs.writeFileSync(store.filePath('selection.json'), canonical(value) + '\n');
  };
  return { store, documents, note, journal, clear: () => fs.rmSync(store.filePath('selection.json'), { force: true }) };
}

test('a selected profile keeps its legacy notes read-only and marks them retained', () => {
  const f = fixture();
  f.journal('selected');
  assert.equal(selectionStatus(f.store).authority, 'paper');
  for (const [name, call] of [['create', () => f.documents.create({ title: 'New', markdown: 'x' })], ['save', () => f.documents.save({ id: f.note.id, baseRev: f.note.rev, content: f.note.content, title: 'Renamed' })],
    ['remove', () => f.documents.remove(f.note.id)], ['restore', () => f.documents.restore(f.note.id, 1)], ['resolveProposal', () => f.documents.resolveProposal(f.note.id, 'x', true)]]) {
    assert.throws(call, { code: 'BARKDOWN_NOTES_ON_PAPER' }, name);
  }
  assert.equal(f.documents.get(f.note.id).title, 'Legacy note', 'reads still work');
  assert.equal(f.documents.retained(), true);
  // Paper proposals are not legacy notes.
  assert.doesNotThrow(() => f.documents.addPaperProposal('slug', { id: 'pp', mode: 'append', markdown: 'x' }));
});

test('a switch in flight blocks legacy edits; a rolled-back switch reopens them', () => {
  const f = fixture();
  for (const phase of ['intent', 'replacing', 'rolling-back']) {
    f.journal(phase);
    assert.throws(() => f.documents.create({ title: 'New', markdown: 'x' }), { code: 'BARKDOWN_SELECTION_PENDING', selection: phase });
  }
  f.journal('rolled-back');
  assert.equal(selectionStatus(f.store).authority, 'legacy');
  assert.ok(f.documents.create({ title: 'After rollback', markdown: 'x' }).id);
  f.clear();
  assert.ok(f.documents.create({ title: 'Never switched', markdown: 'x' }).id);
  fs.writeFileSync(f.store.filePath('selection.json'), '{not json');
  assert.throws(() => f.documents.create({ title: 'Corrupt', markdown: 'x' }), { code: 'BARKDOWN_SELECTION_PENDING', selection: 'blocked' });
});
