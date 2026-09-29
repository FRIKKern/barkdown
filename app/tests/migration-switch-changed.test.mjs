// A changed Paper's reconciliation read: before from the staged plan or the baseline, after from the runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createMigrationSwitch } = require('../main/migration-switch');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-changed-')), profileId = 'p1';
  const backup = path.join(root, 'migration-backups', profileId); fs.mkdirSync(path.join(backup, 'staging'), { recursive: true });
  fs.writeFileSync(path.join(backup, 'staging', 'plan.json'), JSON.stringify({ version: 1, documents: [{ id: 'note', targetId: 'local-abc', payload: { title: 'Orchard', blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'Staged sentence.' }] }] } }] }));
  fs.writeFileSync(path.join(backup, 'comparison-baseline.json'), JSON.stringify({ version: 1, rows: [{ _id: 'existing-1', title: 'Existing', blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'Baseline sentence.' }] }] }] }));
  const leases = [];
  const runtimePool = { acquire: async (id, { ownerId, writes }) => { leases.push([id, ownerId, writes]); return { connection: { server: 'http://127.0.0.1:1', token: 't', dataset: 'production' }, release: async () => leases.push(['released']) }; } };
  const registry = { storeFor: id => ({ storeDir: path.join(root, 'profiles', id) }) };
  const preparation = { withPrepared: async () => {}, inspect: () => null };
  const reads = [];
  const applied = [];
  const migration = createMigrationSwitch({ registry, preparation, runtimePool, userData: root, now: () => '2026-09-29T00:00:00.000Z',
    readPaper: async (target, id) => { reads.push([target.server, id]); return { title: 'Orchard', markdown: 'Staged sentence.\n\nA later sentence.', rev: 3, blocks: [{ id: 'b1', type: 'paragraph' }, { id: 'b2', type: 'paragraph' }] }; },
    applyPaperOps: async (target, id, ops, ifRev) => { applied.push({ id, ops, ifRev }); return { ok: true, rev: 4 }; } });
  // A rolled-back journal with a recorded divergence for the staged Paper.
  fs.mkdirSync(registry.storeFor(profileId).storeDir, { recursive: true });
  const { canonical } = require('../main/migration-journal');
  fs.writeFileSync(path.join(registry.storeFor(profileId).storeDir, 'selection.json'), canonical({ version: 1, phase: 'rolled-back', operationId: '11111111-1111-4111-8111-111111111111', profileId, seal: { boot: 'b', generation: 1, operation: 'o' }, reportHash: 'r', workspaceBefore: 'w', divergence: { code: 'comparison_changed', message: '1 staged Paper changed', at: 't', details: [{ id: 'local-abc', title: 'Orchard', kind: 'staged', what: 'content' }] } }) + '\n');
  return { migration, leases, reads, applied, profileId };
}
test('a staged Paper compares its staged markdown with the current Paper under a read-only lease', async () => {
  const f = fixture();
  const view = await f.migration.changedPaper(f.profileId, 'local-abc');
  assert.equal(view.kind, 'staged'); assert.equal(view.before.markdown.trim(), 'Staged sentence.'); assert.match(view.after.markdown, /later sentence/); assert.equal(view.after.rev, 3);
  assert.deepEqual(f.leases, [[f.profileId, 'migration-reconcile', false], ['released']]); assert.deepEqual(f.reads, [['http://127.0.0.1:1', 'local-abc']]);
});
test('a pre-existing Paper compares its baseline; an unknown id is refused before any lease', async () => {
  const f = fixture();
  const view = await f.migration.changedPaper(f.profileId, 'existing-1');
  assert.equal(view.kind, 'pre-existing'); assert.equal(view.before.markdown.trim(), 'Baseline sentence.');
  await assert.rejects(f.migration.changedPaper(f.profileId, 'nope'), { code: 'changed_unknown' });
  await assert.rejects(f.migration.changedPaper(f.profileId, '../x'), { code: 'changed_id' });
  assert.equal(f.leases.filter(l => l[0] !== 'released').length, 1);
});
test('restore replaces the current blocks with the staged ones under the current revision and records it; keep only records', async () => {
  const f = fixture();
  await assert.rejects(f.migration.reconcilePaper(f.profileId, 'local-abc', 'merge'), { code: 'reconcile_action' });
  const restored = await f.migration.reconcilePaper(f.profileId, 'local-abc', 'restore');
  assert.deepEqual(f.applied, [{ id: 'local-abc', ifRev: 3, ops: [{ op: 'remove-block', id: 'b1' }, { op: 'remove-block', id: 'b2' }, { op: 'append-block', block: { type: 'paragraph', content: [{ type: 'text', value: 'Staged sentence.' }], id: 'restored-0' } }] }]);
  assert.deepEqual(restored.divergence.details[0].reconciled, { action: 'restore', at: '2026-09-29T00:00:00.000Z', fromRev: 3, rev: 4 });
  assert.equal(restored.divergence.reconciled, true); assert.equal(restored.reconciliationRequired, true, 'the divergence stays on record');
  assert.deepEqual(f.leases.filter(l => l[0] !== 'released')[0], [f.profileId, 'migration-reconcile', true]);
  const g = fixture();
  const kept = await g.migration.reconcilePaper(g.profileId, 'local-abc', 'keep');
  assert.deepEqual(kept.divergence.details[0].reconciled, { action: 'keep', at: '2026-09-29T00:00:00.000Z' }); assert.equal(g.applied.length, 0); assert.equal(g.leases.length, 0);
});

