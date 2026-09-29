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
    freezeForeground: async id => ({ profileId: id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
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
  // The selection's own checkpoints share the sink; the switch adds its four around them.
  assert.deepEqual(checkpoints.filter(c => ['after-backup', 'after-baseline', 'after-staging', 'after-selection'].includes(c)), ['after-backup', 'after-baseline', 'after-staging', 'after-selection']);
  assert.ok(checkpoints.indexOf('after-intent') > checkpoints.indexOf('after-staging') && checkpoints.indexOf('after-selected') < checkpoints.indexOf('after-selection'));
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
  // Legacy writes come back only when the preparation reopens the captured writer.
  assert.throws(() => documents.create({ title: 'Too early', markdown: 'x' }), { code: 'writer_stale' });
  await preparation.abort(profile.id);
  // Old handles stay frozen by design; a fresh host rebuilds its store handle.
  const fresh = createDocuments(createStore(sourceDir, { create: false }));
  assert.ok(fresh.create({ title: 'After rollback', markdown: 'x' }).id);
  report.checks.push({ name: 'rollback restores the legacy workspace; writes return once the preparation reopens', passed: true }); persist();
  // Interruption inside the coordinator: a crash right after the workspace is replaced,
  // before the journal says selected. The notice's Resume runs the same switch again.
  const second = registry.createProfile({ name: 'Interrupted switch' }), sourceDir2 = registry.storeFor(second.id).storeDir;
  require('../main/paper-evidence-owner').createPaperEvidenceOwner(createStore(sourceDir2, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { create: true });
  const docs2 = createDocuments(createStore(sourceDir2, { create: false }));
  const note = docs2.create({ title: 'Lone note', markdown: 'A single note that survives an interrupted switch.' });
  fs.writeFileSync(path.join(sourceDir2, 'workspace.json'), JSON.stringify({ version: 1, profileId: second.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: [note.id], children: {}, expanded: {} }, favorites: [] }));
  await preparation.prepare(second.id);
  let armed = true;
  const interrupted = createMigrationSwitch({ registry, preparation, runtimePool, userData, checkpoint: phase => { if (armed && phase === 'after-workspace-replaced') { armed = false; throw Object.assign(new Error('simulated crash after replacement'), { code: 'crash' }); } } });
  await assert.rejects(interrupted.switchToPaper(second.id), { code: 'crash' });
  const mid = interrupted.status(second.id);
  assert.equal(mid.selection.status, 'replacing'); assert.ok(mid.selection.actions.includes('resume'));
  assert.equal(leases.at(-1)[0], 'released', 'the runtime lease is released after the crash');
  const resumed = await interrupted.switchToPaper(second.id);
  assert.equal(resumed.selection.status, 'selected'); assert.equal(resumed.selection.operationId, mid.selection.operationId);
  assert.equal(JSON.parse(fs.readFileSync(path.join(sourceDir2, 'workspace.json'), 'utf8')).pages.roots.length, 1);
  report.checks.push({ name: 'a crash after replacement leaves replacing; resume completes the same operation without a second comparison', passed: true }); persist();
  await preparation.abort(second.id);
  // Every earlier phase too: a crash right after the backup, after the baseline and in the middle
  // of staging. Resume completes each as the same switch without a second backup or duplicate Papers.
  for (const point of ['after-backup', 'after-baseline', 'staging:receipt:orchard-fieldbook', 'after-staging']) {
    const p = registry.createProfile({ name: 'Crash at ' + point }), dir = registry.storeFor(p.id).storeDir;
    require('../main/paper-evidence-owner').createPaperEvidenceOwner(createStore(dir, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { create: true });
    const d = createDocuments(createStore(dir, { create: false }));
    const one = d.create({ title: 'Orchard fieldbook', markdown: 'A fieldbook that survives a crash at ' + point + '.' });
    const two = d.create({ title: 'Soil moisture protocol', markdown: 'Measure soil moisture at dawn; crash point ' + point + '.' });
    fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, profileId: p.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: [one.id, two.id], children: {}, expanded: {} }, favorites: [] }));
    await preparation.prepare(p.id);
    const countTitled = async () => { const raw = await (await fetch(server + '/v1/data/query/production/paper?limit=200&count=true&perspective=published&fields=title', { headers: { authorization: 'Bearer ' + token } })).json(); const docs = (raw.result ?? raw).documents || []; return docs.filter(x => x.title === 'Orchard fieldbook' || x.title === 'Soil moisture protocol').length; };
    const before = await countTitled();
    let armedHere = true;
    const crashing = createMigrationSwitch({ registry, preparation, runtimePool, userData, checkpoint: phase => { if (armedHere && phase === point) { armedHere = false; throw Object.assign(new Error('simulated crash at ' + point), { code: 'crash' }); } } });
    await assert.rejects(crashing.switchToPaper(p.id), { code: 'crash' });
    const midway = crashing.status(p.id);
    assert.equal(midway.selection.status, 'none', 'nothing is selected after a crash before the intent');
    const resumed = await crashing.switchToPaper(p.id);
    assert.equal(resumed.selection.status, 'selected');
    const after = await countTitled();
    assert.equal(after - before, 2, 'resume stages each note exactly once: no duplicate Papers');
    report.checks.push({ name: `crash at ${point}: nothing selected, resume completes the same switch, exactly two Papers added`, staged: resumed.staged, papersAdded: after - before }); persist();
    await preparation.abort(p.id);
  }
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals.close(); }
