// Comparison under the upstream hold against a real disposable managed runtime (C083).
// Run through the isolated harness with BARKDOWN_SHOTS_WRITE_ADMISSION=1. Proves that the
// traversal happens while the runtime refuses writers (a probe write inside the
// traversal answers 503), that the report carries the seal, and that the runtime is open
// again afterwards. Headless foreground hooks, as in migration-comparison.live.mjs.
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
const { prepareMigration } = require('../main/migration-preflight');
const { stageMigration } = require('../main/migration-staging');
const { createMigrationComparison } = require('../main/migration-comparison');
const { createSealedComparison } = require('../main/sealed-comparison');
const { createUpstreamAdmission } = require('../main/upstream-admission');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-sealed-live-'));
const out = path.resolve('../docs/cycles/evidence/C083/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['Headless coordinator with controlled foreground hooks; no selection, rollback or media in flight; the runtime was idle so the hold was held at once.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
async function request(method, route, body, status = 200) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value.result || value;
}
const registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Sealed comparison rehearsal' });
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const sourceDir = registry.storeFor(profile.id).storeDir, destinationDir = path.join(root, 'backup');
require('../main/paper-evidence-owner').createPaperEvidenceOwner(require('../main/store').createStore(sourceDir, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { runtimeId: 'owned-isolated-' + profile.id });
const connection = { server, token };
const admission = createUpstreamAdmission();
try {
  const labels = { description: 'Sealed comparison rehearsal: a fixture note held by the managed runtime while it is compared.', tags: [{ tag: 'sealed', strength: 90, rationale: 'Owned rehearsal fixture for the sealed comparison' }] };
  await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: 'sealed', _type: 'tag', title: 'Sealed' } }, { publish: { id: 'sealed', type: 'tag' } }] });
  await request('POST', '/v1/plugins/bulldocs/papers/prior/create', { slug: 'prior', title: 'Prior observations', style: 'article', ...labels,
    blocks: [{ id: 'prior-text', type: 'paragraph', content: [{ type: 'text', value: 'Existed before the rehearsal; must remain unchanged.' }] }] }, 201);
  const initial = new Set();
  for (const perspective of ['published', 'drafts']) (await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=' + perspective)).documents.forEach(row => initial.add(row._id));
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true }); fs.mkdirSync(path.join(sourceDir, 'attachments'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'documents/orchard.json'), JSON.stringify({ id: 'orchard', title: 'Orchard fieldbook', rev: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complete fieldbook.' }] }] } }));
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: ['orchard'], children: {}, expanded: {} }, favorites: [] }));
  const prep = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async () => ({ profileId: profile.id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  await prep.prepare(profile.id);
  const options = { profileId: profile.id, sourceDir, destinationDir, quiesced: true, metadata: { orchard: labels } };
  options.expectedSourceHash = prepareMigration(options).sourceHash;
  const adapter = createMigrationComparison({ preparation: prep });
  const probes = [];
  // The ownership assertion runs before every comparison read; the first one inside the
  // sealed traversal also tries an admin write and records the runtime's answer.
  let sealedTraversal = false;
  const target = { profileId: profile.id, runtimeId: 'owned-isolated-' + profile.id, server, dataset: 'production', token, assertOwned: async () => {
    if (sealedTraversal && !probes.length) {
      const response = await fetch(server + '/v1/schemas/production', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'sealed_probe', title: 'Probe', visibility: 'public', fields: [] }) });
      probes.push({ status: response.status, body: await response.json() });
    }
    return true;
  } };
  const baseline = await adapter.captureBaseline(options, target); options.expectedBaselineHash = baseline.baselineHash;
  const staging = await stageMigration(options, target); assert.equal(staging.documents.length, 1);
  const open = await admission.instance(connection); assert.equal(open.phase, 'open');
  const sealed = createSealedComparison({ comparison: adapter, admission });
  sealedTraversal = true;
  const result = await sealed.compare(options, target);
  sealedTraversal = false;
  assert.equal(result.status, 'compared'); assert.equal(result.documents, initial.size + 1); assert.equal(result.activationAllowed, false); assert.equal(result.authority, 'legacy');
  assert.equal(result.seal.operation, 'compare-' + profile.id); assert.equal(result.seal.generation, open.generation); assert.equal(result.seal.reopenedGeneration, open.generation + 1);
  assert.equal(probes.length, 1); assert.equal(probes[0].status, 503); assert.equal(probes[0].body?.error?.code, 'storage_unavailable'); assert.equal(probes[0].body?.error?.reason, 'write_admission_admission_closed');
  const after = await admission.instance(connection); assert.equal(after.phase, 'open'); assert.equal(after.generation, open.generation + 1);
  await assert.rejects(request('GET', '/v1/schemas/production/sealed_probe'), /404/);
  report.checks.push({ name: 'traversal ran while held; a probe write inside it was refused; reopened afterwards', seal: result.seal, probe: probes[0].body.error, documents: result.documents, limits: result.limits }); persist();
  const plain = await adapter.compare(options, target);
  const { seal: _seal, limits: _sealedLimits, ...rest } = result;
  const { limits: _plainLimits, ...plainRest } = plain;
  assert.deepEqual(rest, plainRest);
  report.checks.push({ name: 'sealed and unsealed reports agree on every field but the seal and its limit', passed: true });
  // A comparison that fails still reopens the runtime.
  const wrong = { ...options, expectedBaselineHash: 'f'.repeat(64) };
  await assert.rejects(sealed.compare(wrong, target), /baseline/);
  assert.equal((await admission.instance(connection)).phase, 'open');
  report.checks.push({ name: 'a refused comparison reopens the runtime', passed: true });
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals.close(); }
