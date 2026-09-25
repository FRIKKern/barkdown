// Real disposable Barkpark, real preparation/journals; headless foreground hooks.
// Native renderer freeze is covered separately by profile-preparation.live.mjs.
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
const { PNG } = require('pngjs');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-comparison-live-'));
const out = path.resolve('../docs/cycles/evidence/C078/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, status: 'running', checks: [], limits: ['Headless coordinator with controlled foreground hooks; native GUI freeze is separate evidence.', 'Read-only internal rehearsal; no authority switch, server snapshot or direct-client fence.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
async function request(method, route, body, status = 200) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value.result || value;
}
const registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Comparison rehearsal' });
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const sourceDir = registry.storeFor(profile.id).storeDir, destinationDir = path.join(root, 'backup');
let valid = true;
function coordinator() {
  return createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async () => ({ profileId: profile.id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => valid, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
}
const snapshots = dir => Object.fromEntries(fs.readdirSync(dir, { recursive: true }).filter(n => fs.statSync(path.join(dir, n)).isFile()).map(n => [n, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, n))).digest('hex')]));
try {
  const initialIds = new Set();
  for (const perspective of ['published', 'drafts']) {
    const page = await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=' + perspective);
    assert.equal(page.hasMore, false, 'Disposable startup inventory must be complete');
    assert.equal(page.total, page.documents.length);
    page.documents.forEach(row => initialIds.add(row._id));
  }
  report.initialPaperIds = [...initialIds].sort(); persist();
  await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: 'comparisonproof', _type: 'tag', title: 'Comparison proof' } }, { publish: { id: 'comparisonproof', type: 'tag' } }] });
  const labels = { description: 'Private migration comparison preserves complete structured notes, variants and exact media without changing the source.', tags: [{ tag: 'comparisonproof', strength: 95, rationale: 'Disposable migration comparison evidence' }] };
  await request('POST', '/v1/plugins/bulldocs/papers/prior/create', { slug: 'prior', title: 'Published astronomy observations', style: 'article', ...labels,
    blocks: [{ id: 'prior-text', type: 'paragraph', content: [{ type: 'text', value: 'These astronomy observations existed before migration and must remain exactly unchanged.' }] }] }, 201);
  for (let start = 0; start < 201; start += 25) {
    const mutations = Array.from({ length: Math.min(25, 201 - start) }, (_, j) => ({ create: { _id: 'existing-' + (start + j), _type: 'paper', title: 'Private draft ' + (start + j), blocks: [], rev: 0 } }));
    await request('POST', '/v1/data/mutate/production', { mutations });
  }
  await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: 'prior', _type: 'paper', title: 'Divergent unpublished astronomy', blocks: [], rev: 0 } }] });
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true }); fs.mkdirSync(path.join(sourceDir, 'attachments'), { recursive: true });
  const png = new PNG({ width: 8, height: 8 }); png.data.fill(128); fs.writeFileSync(path.join(sourceDir, 'attachments/plot.png'), PNG.sync.write(png));
  for (const [id, title, content] of [
    ['orchard', 'Orchard migration fieldbook', [{ type: 'paragraph', content: [{ type: 'text', text: 'The complete fieldbook links to its soil measurements.', marks: [{ type: 'link', attrs: { href: 'barkdown://doc/soil' } }] }] }, { type: 'image', attrs: { src: 'attachments/plot.png', alt: 'Retained plot', width: 64 } }]],
    ['soil', 'Soil moisture sampling protocol', [{ type: 'paragraph', content: [{ type: 'text', text: 'Measure soil moisture at dawn and preserve every observation in its original order.' }] }]],
  ]) fs.writeFileSync(path.join(sourceDir, 'documents', id + '.json'), JSON.stringify({ id, title, rev: 1, content: { type: 'doc', content } }));
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: profile.id, chats: {}, order: [], current: null,
    pages: { layoutVersion: 2, seeded: true, roots: ['orchard'], children: { orchard: ['soil'] }, expanded: { orchard: true } }, favorites: [{ id: 'fav', target: { kind: 'doc', id: 'soil', source: 'local' } }] }));
  let prep = coordinator(); await prep.prepare(profile.id);
  const options = { profileId: profile.id, sourceDir, destinationDir, quiesced: true, metadata: { orchard: labels, soil: labels } };
  options.expectedSourceHash = prepareMigration(options).sourceHash;
  let adapter = createMigrationComparison({ preparation: prep });
  let reads = 0;
  const target = { profileId: profile.id, runtimeId: 'owned-isolated-' + profile.id, server, dataset: 'production', token, assertOwned: () => { reads++; return valid; } };
  const baseline = await adapter.captureBaseline(options, target); options.expectedBaselineHash = baseline.baselineHash;
  assert.equal(baseline.documents, initialIds.size + 203);
  const staging = await stageMigration(options, target); assert.equal(staging.documents.length, 2);
  const before = snapshots(destinationDir), original = snapshots(sourceDir);
  const result = await adapter.compare(options, target);
  assert.equal(result.documents, initialIds.size + 205); assert.equal(result.preserved, initialIds.size + 203); assert.equal(result.media, 1); assert.equal(result.activationAllowed, false);
  assert.deepEqual(snapshots(destinationDir), before); assert.deepEqual(snapshots(sourceDir), original);
  report.checks.push({ name: 'mixed library, links, media and organization', result }); persist();
  // A new coordinator must reacquire and verify preparation rather than trust its report.
  prep = coordinator(); adapter = createMigrationComparison({ preparation: prep });
  assert.deepEqual(await adapter.compare(options, target), result);
  report.checks.push({ name: 'new coordinator revalidates existing preparation', passed: true });
  const interrupted = { ...target, assertOwned: () => { if (++reads % 3 === 0) throw Error('Interrupted comparison read'); return true; } };
  await assert.rejects(adapter.compare(options, interrupted), /Interrupted/);
  assert.deepEqual(snapshots(destinationDir), before); assert.deepEqual(await adapter.compare(options, target), result);
  report.checks.push({ name: 'interrupted read has no repair writes; retry rechecks', passed: true });
  const priorDraft = await request('GET', '/v1/data/doc/production/paper/drafts.existing-0?perspective=raw');
  await request('POST', '/v1/plugins/bulldocs/papers/drafts.existing-0/ops', { ifRev: priorDraft.rev ?? 0, ops: [{ op: 'append-block', block: { id: 'later-human', type: 'paragraph', content: [{ type: 'text', value: 'A later human change' }] } }] });
  await assert.rejects(adapter.compare(options, target), /pre-existing/);
  assert.ok((await request('GET', '/v1/data/doc/production/paper/drafts.existing-0?perspective=raw')).blocks.some(block => block.id === 'later-human'));
  report.checks.push({ name: 'later draft change refuses without overwriting', passed: true });
  await prep.abort(profile.id); await assert.rejects(adapter.compare(options, target), /Prepare/);
  report.checks.push({ name: 'cancellation invalidates comparison admission', passed: true });
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error); persist(); throw error; }
finally { goals.close(); }
