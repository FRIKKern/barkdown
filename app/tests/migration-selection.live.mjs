// Selection rehearsal against a real disposable managed runtime (C083, A2 step 4/5).
// Run through the isolated harness with BARKDOWN_SHOTS_WRITE_ADMISSION=1. Proves that
// under the live preparation and the upstream hold the sealed comparison, the real owned
// navigation projection and the atomic workspace replacement land as one durable
// selection; that the runtime is reopened afterwards; and that rollback restores the
// retained legacy workspace. No boot policy or UI: the profile is headless.
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
const { createMigrationSelection } = require('../main/migration-selection');
const { createUpstreamAdmission } = require('../main/upstream-admission');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-selection-live-'));
const out = path.resolve('../docs/cycles/evidence/C083/live', new Date().toISOString().replace(/[:.]/g, '-') + '-selection');
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['Headless profile with controlled foreground hooks; the renderer does not yet show the selection; one Paper edit between selection and rollback; the runtime was idle so the hold was held at once.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
async function request(method, route, body, status = 200) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value.result || value;
}
const registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Selection rehearsal' });
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const sourceDir = registry.storeFor(profile.id).storeDir, destinationDir = path.join(root, 'backup');
require('../main/paper-evidence-owner').createPaperEvidenceOwner(require('../main/store').createStore(sourceDir, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { create: true });
const connection = { server, token };
const admission = createUpstreamAdmission();
const workspaceFile = path.join(sourceDir, 'workspace.json');
try {
  const labels = { description: 'Selection rehearsal: a fixture note selected onto the Paper engine while the runtime is held.', tags: [{ tag: 'selected', strength: 90, rationale: 'Owned rehearsal fixture for the selection' }] };
  await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: 'selected', _type: 'tag', title: 'Selected' } }, { publish: { id: 'selected', type: 'tag' } }] });
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true }); fs.mkdirSync(path.join(sourceDir, 'attachments'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'documents/orchard.json'), JSON.stringify({ id: 'orchard', title: 'Orchard fieldbook', rev: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complete fieldbook.' }] }] } }));
  const legacy = { version: 1, profileId: profile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: ['orchard'], children: {}, expanded: {} }, favorites: [{ id: 'fav', target: { kind: 'doc', id: 'orchard', source: 'local' } }] };
  fs.writeFileSync(workspaceFile, JSON.stringify(legacy));
  const legacyBytes = fs.readFileSync(workspaceFile);
  const prep = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async () => ({ profileId: profile.id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  await prep.prepare(profile.id);
  const options = { profileId: profile.id, sourceDir, destinationDir, quiesced: true, metadata: { orchard: labels } };
  options.expectedSourceHash = prepareMigration(options).sourceHash;
  const adapter = createMigrationComparison({ preparation: prep });
  const target = { profileId: profile.id, runtimeId: 'owned-isolated-' + profile.id, server, dataset: 'production', token, assertOwned: async () => true };
  const baseline = await adapter.captureBaseline(options, target); options.expectedBaselineHash = baseline.baselineHash;
  const staging = await stageMigration(options, target); assert.equal(staging.documents.length, 1);
  const checkpoints = [];
  const selection = createMigrationSelection({ preparation: prep, comparison: adapter, admission, checkpoint: phase => checkpoints.push(phase) });
  assert.equal(selection.inspect(profile.id, sourceDir).status, 'none');
  const open = await admission.instance(connection); assert.equal(open.phase, 'open');
  const selected = await selection.select(options, target);
  assert.equal(selected.status, 'selected'); assert.equal(selected.authority, 'paper');
  assert.equal(selected.seal.generation, open.generation); assert.equal(selected.reopenedGeneration, open.generation + 1);
  const replaced = JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
  assert.equal(replaced.favorites[0].target.source, 'barkpark');
  assert.equal(replaced.favorites[0].target.id, staging.documents[0].targetId);
  assert.ok(replaced.favorites[0].target.paperOwner);
  // Human Pages keep their order and placement; keys are re-keyed to the owner-qualified Paper (C080).
  assert.equal(replaced.pages.roots.length, 1);
  assert.ok(replaced.pages.roots[0].endsWith(':' + staging.documents[0].targetId), replaced.pages.roots[0]);
  assert.equal((await admission.instance(connection)).phase, 'open');
  const retained = JSON.parse(fs.readFileSync(path.join(sourceDir, 'selection/workspace-legacy.json'), 'utf8'));
  assert.ok(Buffer.from(retained.bytes).equals(legacyBytes));
  assert.ok(fs.existsSync(path.join(sourceDir, 'documents/orchard.json')), 'legacy source notes are never removed by selection');
  report.checks.push({ name: 'selection under both fences replaced the workspace with the owned projection', seal: selected.seal, reopenedGeneration: selected.reopenedGeneration, checkpoints, favorite: replaced.favorites[0].target }); persist();
  const again = await selection.select(options, target);
  assert.equal(again.operationId, selected.operationId);
  report.checks.push({ name: 'reselect is idempotent', passed: true }); persist();
  // A human edits the migrated Paper after the switch. Rollback must return the legacy
  // navigation, keep that edit on Paper, and record the divergence for reconciliation.
  const targetId = staging.documents[0].targetId;
  const published = (await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=published')).documents.find(row => row._id === targetId);
  assert.ok(published, 'the migrated Paper is published');
  await request('POST', `/v1/plugins/bulldocs/papers/${targetId}/ops`, { ifRev: published.rev ?? 0, ops: [{ op: 'append-block', block: { id: 'later-human', type: 'paragraph', content: [{ type: 'text', value: 'A later human change on Paper' }] } }] });
  const back = await selection.rollback(options, target);
  assert.equal(back.status, 'rolled-back');
  assert.equal(back.reconciliationRequired, true, 'the Paper edit after the switch is recorded as divergence');
  assert.match(String(back.divergence?.code), /^comparison_/);
  assert.ok(fs.readFileSync(workspaceFile).equals(legacyBytes), 'rollback restores the retained bytes exactly');
  assert.equal((await admission.instance(connection)).phase, 'open');
  const rows = await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=published');
  assert.ok(rows.documents.some(row => row._id === targetId), 'staged Papers survive rollback');
  const twins = (await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=drafts')).documents;
  const after = twins.find(row => row._id === 'drafts.' + targetId) || twins.find(row => row._id === targetId);
  assert.ok(after?.blocks?.some(block => block.id === 'later-human'), 'the later Paper edit is kept, never converted back');
  assert.equal(fs.readFileSync(path.join(sourceDir, 'documents/orchard.json'), 'utf8').includes('later human'), false, 'the legacy note is untouched');
  report.checks.push({ name: 'rollback after a Paper edit restores the legacy workspace, keeps the edit on Paper and records the divergence', divergence: back.divergence, passed: true }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals.close(); }
