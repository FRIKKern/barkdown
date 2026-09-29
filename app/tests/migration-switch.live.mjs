// The operator's library switch end to end against a real disposable managed runtime:
// prepare → backup → baseline → stage → select under the hold, then roll back. Run through
// the isolated harness with BARKDOWN_SHOTS_WRITE_ADMISSION=1. Headless foreground hooks;
// the runtime pool is a fake lease over the harness's server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createProfilePreparation } = require('../main/profile-preparation');
const { createMigrationSwitch } = require('../main/migration-switch');
const { createDocuments } = require('../main/documents');
const { createStore } = require('../main/store');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-switch-live-'));
const out = path.resolve('../docs/cycles/evidence/C083/live', new Date().toISOString().replace(/[:.]/g, '-') + '-switch');
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['Headless profile with controlled foreground hooks; fake runtime lease over the harness server; labels generated, not reviewed; one run, one host.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const userData = path.join(root, 'user-data'); fs.mkdirSync(userData);
const registry = createProfileRegistry(path.join(userData, 'profile-data')), profile = registry.createProfile({ name: 'Switch rehearsal' });
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const store = registry.storeFor(profile.id), sourceDir = store.storeDir;
require('../main/paper-evidence-owner').createPaperEvidenceOwner(createStore(sourceDir, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { create: true });
try {
  // Two legacy notes written through the real store, one linking the other.
  const documents = createDocuments(createStore(sourceDir, { create: false }));
  const soil = documents.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn and keep every observation in its original order.' });
  const orchard = documents.create({ title: 'Orchard fieldbook', markdown: `The complete fieldbook links to its [soil measurements](barkdown://doc/${soil.id}).` });
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: [orchard.id], children: { [orchard.id]: [soil.id] }, expanded: {} }, favorites: [{ id: 'fav', target: { kind: 'doc', id: soil.id, source: 'local' } }] }));
  const legacyBytes = fs.readFileSync(path.join(sourceDir, 'workspace.json'));
  const preparation = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async () => ({ profileId: profile.id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  const leases = [];
  const runtimePool = { acquire: async (profileId, { ownerId, writes }) => { leases.push([profileId, ownerId, writes]); return { connection: { server, token, dataset: 'production' }, release: async () => { leases.push(['released']); } }; } };
  const checkpoints = [];
  const migration = createMigrationSwitch({ registry, preparation, runtimePool, userData, checkpoint: phase => checkpoints.push(phase) });
  await assert.rejects(migration.switchToPaper(profile.id), { code: 'switch_preparation' });
  await preparation.prepare(profile.id);
  assert.equal(migration.status(profile.id).preparation, 'prepared');
  const labels = migration.generatedLabels(profile.id);
  assert.ok(labels[soil.id].description.length > 20 && labels[orchard.id].tags[0].rationale.length >= 20);
  const switched = await migration.switchToPaper(profile.id);
  assert.equal(switched.selection.status, 'selected'); assert.equal(switched.selection.authority, 'paper'); assert.equal(switched.staged, true);
  assert.deepEqual(checkpoints.filter(c => !c.startsWith('staging:')), ['after-backup', 'after-baseline', 'after-staging', 'after-selection']);
  assert.deepEqual(leases, [[profile.id, 'migration-switch', true], ['released']]);
  const replaced = JSON.parse(fs.readFileSync(path.join(sourceDir, 'workspace.json'), 'utf8'));
  assert.equal(replaced.favorites[0].target.source, 'barkpark');
  assert.ok(fs.existsSync(path.join(sourceDir, 'documents', soil.id + '.json')), 'legacy notes stay');
  assert.throws(() => documents.create({ title: 'After', markdown: 'x' }), { code: 'BARKDOWN_NOTES_ON_PAPER' });
  report.checks.push({ name: 'prepare → backup → baseline → stage → select under the hold, one lease, legacy store read-only', seal: switched.selection.seal, checkpoints }); persist();
  const again = await migration.switchToPaper(profile.id);
  assert.equal(again.selection.operationId, switched.selection.operationId);
  report.checks.push({ name: 'switch again is idempotent', passed: true }); persist();
  const back = await migration.rollback(profile.id);
  assert.equal(back.selection.status, 'rolled-back'); assert.equal(back.selection.reconciliationRequired, false);
  assert.ok(fs.readFileSync(path.join(sourceDir, 'workspace.json')).equals(legacyBytes));
  assert.ok(documents.create({ title: 'After rollback', markdown: 'x' }).id);
  report.checks.push({ name: 'rollback restores the legacy workspace and writes', passed: true }); persist();
  await preparation.abort(profile.id);
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals.close(); }
