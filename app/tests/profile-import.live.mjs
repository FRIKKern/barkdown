// Export and import between two real runtimes (P3): a library on profile A's managed runtime is
// exported under the hold and imported into a new profile B with its own fresh database. B boots,
// serves the same Papers and the same image, answers only to its own token, and its navigation
// is owned by B's library. A is unchanged. One machine: a second machine is not claimed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createProfilePreparation } = require('../main/profile-preparation');
const { createProfileRuntimePool } = require('../main/profile-runtime');
const { createProfileExport } = require('../main/profile-export');
const { createProfileImport } = require('../main/profile-import');
const { createPaperEvidenceOwner } = require('../main/paper-evidence-owner');
const { createStore } = require('../main/store');
const { request, uploadMedia, listAllPapers, getPaper } = require('../main/barkpark');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || '../../barkpark');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-import-live-')));
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-import');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['One machine, one run, a small library. Both profiles live in one registry; a second machine, another OS and another Postgres major version are not exercised. Headless profile with controlled foreground hooks. Conversations and retained originals travel as files and are not opened in the app here.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const secretsBy = new Map();
const readSecrets = async store => { if (!secretsBy.has(store.storeDir)) secretsBy.set(store.storeDir, { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') }); return secretsBy.get(store.storeDir); };
const userData = path.join(root, 'user-data'); fs.mkdirSync(userData);
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const pool = createProfileRuntimePool({ registry, readSecrets });
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const direct = c => ({ server: c.server, token: c.token, dataset: 'production', viaCli: false, enabled: true });
let leaseA, leaseB;
try {
  const a = registry.createProfile({ name: 'Writing desk' }), storeA = createStore(registry.storeFor(a.id).storeDir, { create: false });
  leaseA = await pool.acquire(a.id, { source, ownerId: 'rehearsal-a', writes: true });
  const A = direct(leaseA.connection);
  await request(A, 'POST', '/v1/data/mutate/production', { mutations: [{ createOrReplace: { _id: 'travelled', _type: 'tag', title: 'Travelled' } }, { publish: { id: 'travelled', type: 'tag' } }] });
  const subjects = ['Harbour ledger of the spring tides', 'Orchard census with every tree named', 'Kiln schedule for the winter firings'];
  const png = path.join(root, 'pixel.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  const image = await uploadMedia(A, { filePath: png, name: 'pixel.png', mime: 'image/png' });
  const imagePath = new URL(image.src || image.url).pathname;
  for (const [i, title] of subjects.entries()) await request(A, 'POST', `/v1/plugins/bulldocs/papers/travel-${i}/create`, { slug: `travel-${i}`, title, style: 'article', dedup_bypass: true,
    description: `A disposable Paper number ${i} for the profile import rehearsal between two managed runtimes`, tags: [{ tag: 'travelled', strength: 95, rationale: 'Profile import rehearsal library' }],
    blocks: [{ id: 'p', type: 'paragraph', content: [{ type: 'text', value: `${title}: the words that must arrive.` }] }, ...(i === 0 ? [{ id: 'img', type: 'image', src: imagePath, alt: 'One pixel' }] : [])] });
  const ownerA = createPaperEvidenceOwner(storeA).identify(A, { create: true });
  storeA.writeJson('workspace.json', { version: 1, profileId: a.id, chats: { main: { id: 'main', title: 'Writing room', messages: [{ id: 'm1', role: 'assistant', text: 'A conversation that travels.', at: '2026-09-29T12:00:00Z' }], events: [], apiHistory: [], tabs: [{ id: 't1', type: 'doc', source: 'barkpark', path: ['travel-1'], paperOwner: ownerA, title: 'Orchard census' }], active: 't1', draft: 'An unsent thought.' } }, order: ['main'], current: 'main',
    pages: { layoutVersion: 2, seeded: true, roots: [`bp:v1:${ownerA}:travel-0`], children: { [`bp:v1:${ownerA}:travel-0`]: [`bp:v1:${ownerA}:travel-1`] }, expanded: {} }, favorites: [{ id: 'fav', target: { kind: 'doc', id: 'travel-2', source: 'barkpark', paperOwner: ownerA } }] });
  storeA.writeJson('settings.json', { theme: 'dark', apiKeyEncrypted: 'enc:machine-bound', barkpark: { enabled: true, writes: true, tokenEncrypted: 'enc:machine-bound', local: { enabled: true, source } } });
  const preparation = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async id => ({ profileId: id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  await preparation.prepare(a.id);
  const exporter = createProfileExport({ registry, preparation, runtimePool: pool, upstreamRef: () => upstream });
  const destination = path.join(root, 'export');
  const { manifest } = await exporter.exportProfile(a.id, destination);
  await preparation.abort(a.id);
  assert.equal(manifest.counts.papers, 3); assert.equal(manifest.navigation.owner, ownerA); assert.ok(manifest.media.length >= 1);
  report.checks.push({ name: 'profile A exported under the hold through the real runtime pool', papers: manifest.counts.papers, media: manifest.media.length, store: manifest.store.length }); persist();
  const before = (await listAllPapers(A)).map(p => p.id).sort();
  const importer = createProfileImport({ registry, runtimePool: pool, source, upstreamRef: () => upstream });
  const imported = await importer.importProfile(destination);
  assert.notEqual(imported.profileId, a.id); assert.equal(imported.record.phase, 'imported');
  leaseB = await pool.acquire(imported.profileId, { source, ownerId: 'rehearsal-b', writes: true });
  const B = direct(leaseB.connection);
  assert.notEqual(B.server, A.server); assert.notEqual(B.token, A.token);
  const arrived = await listAllPapers(B);
  assert.deepEqual(arrived.map(p => p.id).sort(), before);
  for (const id of before) { const one = await getPaper(A, id), other = await getPaper(B, id); assert.equal(other.title, one.title); assert.deepEqual(other.blocks, one.blocks); assert.equal(other.rev, one.rev); }
  const pictureA = await fetch(A.server + imagePath), pictureB = await fetch(B.server + imagePath);
  assert.equal(pictureB.status, 200); assert.deepEqual(Buffer.from(await pictureB.arrayBuffer()), Buffer.from(await pictureA.arrayBuffer()));
  report.checks.push({ name: 'profile B boots from the restored database: the same Papers, revisions, blocks and the same image bytes on its own runtime', papers: arrived.length }); persist();
  // B answers only to its own token; A's token did not travel as a usable credential.
  const foreign = await fetch(B.server + '/v1/data/mutate/production', { method: 'POST', headers: { authorization: 'Bearer ' + A.token, 'content-type': 'application/json' }, body: JSON.stringify({ mutations: [] }) });
  assert.ok([401, 403].includes(foreign.status), 'the exporting runtime\'s token is refused by the imported one: ' + foreign.status);
  await request(B, 'POST', '/v1/plugins/bulldocs/papers/travel-0/ops', { ops: [{ op: 'append-block', block: { id: 'after-import', type: 'paragraph', content: [{ type: 'text', value: 'Written on the imported library.' }] } }] });
  assert.match((await getPaper(B, 'travel-0')).markdown, /Written on the imported library/);
  assert.doesNotMatch((await getPaper(A, 'travel-0')).markdown, /Written on the imported library/, 'the exporting library is unchanged');
  report.checks.push({ name: 'the imported library refuses the exporting runtime\'s token, accepts its own, and editing it leaves the exported library unchanged', passed: true }); persist();
  const storeB = createStore(imported.storeDir, { create: false }), ownerB = createPaperEvidenceOwner(storeB).identify(B);
  const workspace = storeB.readJson('workspace.json', null);
  assert.notEqual(ownerB, ownerA); assert.equal(workspace.profileId, imported.profileId);
  assert.deepEqual(workspace.pages.roots, [`bp:v1:${ownerB}:travel-0`]); assert.equal(workspace.favorites[0].target.paperOwner, ownerB); assert.equal(workspace.chats.main.tabs[0].paperOwner, ownerB);
  assert.equal(workspace.chats.main.messages[0].text, 'A conversation that travels.'); assert.equal(workspace.chats.main.draft, 'An unsent thought.');
  const settings = storeB.readJson('settings.json', null);
  assert.equal(settings.apiKeyEncrypted, undefined); assert.equal(settings.barkpark.tokenEncrypted, undefined); assert.equal(settings.barkpark.local.source, source);
  assert.equal(JSON.stringify(storeA.readJson('workspace.json', null)).includes(ownerB), false, 'profile A keeps its own navigation');
  report.checks.push({ name: 'navigation, the conversation and the draft arrive owned by the importing library; credentials did not travel', navigation: imported.record.navigation }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals.close(); try { await leaseA?.release(); } catch {} try { await leaseB?.release(); } catch {} await pool.shutdown().catch(() => {}); }
