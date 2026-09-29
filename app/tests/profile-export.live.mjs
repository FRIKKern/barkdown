// Profile export against a real disposable runtime (P3 groundwork): Papers and an image on a
// managed runtime, the profile prepared, the export taken under the hold with a write refused
// in the middle, the manifest verified, and the dump restored into a scratch database whose
// Papers are counted against the live one. Private ports and data; nothing shared is touched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createProfilePreparation } = require('../main/profile-preparation');
const { createProfileExport } = require('../main/profile-export');
const { createStore } = require('../main/store');
const { request, uploadMedia } = require('../main/barkpark');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || '../../barkpark');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-export-live-')));
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-export');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['One host, one run, a small library. Headless profile with controlled foreground hooks; the runtime lease is built over this test\'s own driver. The export is verified and restored into a scratch database on the same cluster; importing into another profile or machine is not part of this rehearsal.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const data = path.join(root, 'runtime'); fs.mkdirSync(data);
const driver = new SourceDriver({ source, port: 4561, pgPort: 5561, writeAdmission: { instanceId: 'export-' + crypto.randomBytes(4).toString('hex') } }, data, secrets);
const runtime = new LocalBarkpark(driver, { interval: 1000, retries: 1 });
runtime.on('status', s => console.log(s.phase, s.error || ''));
const connection = { server: driver.server, token: secrets.token, dataset: 'production', viaCli: false, enabled: true };
const psql = (database, sql) => execFileSync(path.join(driver.pgBin, 'psql'), ['-h', '127.0.0.1', '-p', '5561', '-U', 'postgres', '-d', database, '-tAc', sql], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: secrets.password } }).trim();
const pg = (tool, args) => execFileSync(path.join(driver.pgBin, tool), ['-h', '127.0.0.1', '-p', '5561', '-U', 'postgres', ...args], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: secrets.password }, maxBuffer: 64 * 1024 * 1024 });
const probe = async () => { try { await request(connection, 'POST', '/v1/schemas/production', { name: 'export_probe', title: 'Export probe', visibility: 'public', fields: [] }); return null; } catch (error) { return error; } };
let goals;
try {
  await runtime.start();
  assert.equal(runtime.status().phase, 'ready');
  // A small library: a tag, three Papers and one owned image.
  await request(connection, 'POST', '/v1/data/mutate/production', { mutations: [{ createOrReplace: { _id: 'exported', _type: 'tag', title: 'Exported' } }, { publish: { id: 'exported', type: 'tag' } }] });
  const subjects = ['Harbour ledger of the spring tides', 'Orchard census with every tree named', 'Kiln schedule for the winter firings'];
  for (const [i, title] of subjects.entries()) await request(connection, 'POST', `/v1/plugins/bulldocs/papers/export-${i}/create`, { slug: `export-${i}`, title, style: 'article', dedup_bypass: true,
    description: `A disposable Paper number ${i} for the profile export rehearsal under the managed hold`, tags: [{ tag: 'exported', strength: 95, rationale: 'Profile export rehearsal library' }],
    blocks: [{ id: 'p', type: 'paragraph', content: [{ type: 'text', value: `${title}: the words that must travel.` }] }] });
  const png = path.join(root, 'pixel.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  const uploaded = await uploadMedia(connection, { filePath: png, name: 'pixel.png', mime: 'image/png' });
  assert.ok(uploaded.src || uploaded.url, 'the image is owned media');
  // The profile: its store with a workspace, settings carrying machine-bound secrets, and credentials.
  const userData = path.join(root, 'user-data'); fs.mkdirSync(userData);
  const registry = createProfileRegistry(path.join(userData, 'profile-data')), profile = registry.createProfile({ name: 'Export rehearsal' });
  const profiles = createProfileService({ registry }); goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
  const storeDir = registry.storeFor(profile.id).storeDir, store = createStore(storeDir, { create: false });
  store.writeJson('workspace.json', { version: 1, profileId: profile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: ['bp:export-0'], children: {}, expanded: {} }, favorites: [] });
  store.writeJson('settings.json', { theme: 'dark', apiKeyEncrypted: 'enc:machine-bound', barkpark: { enabled: true, writes: true, tokenEncrypted: 'enc:machine-bound', local: { enabled: true, source, port: 4561, pgPort: 5561 } } });
  store.writeJson('local-credentials.json', { note: 'machine-bound' });
  const preparation = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async id => ({ profileId: id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  const leases = [];
  const runtimePool = { acquire: async (profileId, { ownerId, writes }) => { leases.push([ownerId, writes]); return { connection, data: { dump: file => driver.dump(file), mediaDir: driver.mediaDir }, release: async () => leases.push(['released']) }; } };
  let refusedDuring = null;
  const exporter = createProfileExport({ registry, preparation, runtimePool, upstreamRef: () => upstream,
    checkpoint: phase => { if (phase === 'after-dump') refusedDuring = probe(); } });
  await assert.rejects(exporter.exportProfile(profile.id, path.join(root, 'too-early')), /prepar/i, 'an unprepared profile is not exported');
  await preparation.prepare(profile.id);
  const destination = path.join(root, 'export');
  const livePapers = Number(psql('barkdown', "SELECT count(*) FROM documents WHERE type = 'paper'"));
  const { manifest } = await exporter.exportProfile(profile.id, destination);
  const during = await refusedDuring;
  assert.equal(during?.status, 503, 'a write in the middle of the export is refused'); assert.equal(during?.code, 'storage_unavailable');
  assert.equal(await probe(), null, 'writes are admitted again after the export');
  assert.deepEqual(leases, [['profile-export', false], ['released']]);
  report.checks.push({ name: 'export under the hold: a write in the middle is refused, the runtime reopens, one read-only lease', seal: manifest.seal, database: manifest.database, media: manifest.media.length, store: manifest.store.map(s => s.path) }); persist();
  const verified = exporter.verifyExport(destination);
  assert.ok(manifest.media.length >= 1, 'the owned image travels'); assert.ok(manifest.store.some(s => s.path === 'profile/workspace.json'));
  assert.ok(!fs.existsSync(path.join(destination, 'profile', 'local-credentials.json')));
  const settings = JSON.parse(fs.readFileSync(path.join(destination, 'profile', 'settings.json'), 'utf8'));
  assert.equal(settings.apiKeyEncrypted, undefined); assert.equal(settings.barkpark.tokenEncrypted, undefined); assert.deepEqual(settings.barkpark.local, { enabled: true });
  assert.ok(!JSON.stringify(manifest).includes(secrets.password) && !JSON.stringify(manifest).includes(secrets.token), 'no runtime secret in the manifest');
  report.checks.push({ name: 'the export verifies against its manifest; credentials, the owner key and machine-bound settings stayed behind', files: verified.files }); persist();
  // The dump is a real logical export: it lists, and it restores into a scratch database with the same Papers.
  const toc = execFileSync(path.join(driver.pgBin, 'pg_restore'), ['--list', path.join(destination, 'database.dump')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.match(toc, /TABLE DATA public documents/);
  pg('createdb', ['export_check']);
  execFileSync(path.join(driver.pgBin, 'pg_restore'), ['-h', '127.0.0.1', '-p', '5561', '-U', 'postgres', '-d', 'export_check', '--no-owner', '--no-privileges', path.join(destination, 'database.dump')], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: secrets.password }, maxBuffer: 64 * 1024 * 1024 });
  const restoredPapers = Number(psql('export_check', "SELECT count(*) FROM documents WHERE type = 'paper'"));
  assert.equal(restoredPapers, livePapers); assert.ok(restoredPapers >= 3);
  const restoredTitles = psql('export_check', "SELECT string_agg(title, '|' ORDER BY title) FROM documents WHERE type = 'paper' AND doc_id LIKE 'export-%'");
  assert.equal(restoredTitles, [...subjects].sort().join('|'));
  report.checks.push({ name: 'the dump restores into a scratch database with the same Papers', papers: restoredPapers, titles: restoredTitles.split('|') }); persist();
  await preparation.abort(profile.id);
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals?.close(); await runtime.stop(); }
