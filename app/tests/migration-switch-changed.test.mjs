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
  const migration = createMigrationSwitch({ registry, preparation, runtimePool, userData: root, readPaper: async (target, id) => { reads.push([target.server, id]); return { title: 'Orchard', markdown: 'Staged sentence.\n\nA later sentence.', rev: 3 }; } });
  return { migration, leases, reads, profileId };
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
