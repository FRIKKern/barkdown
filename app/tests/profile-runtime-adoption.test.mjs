import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createRuntimeAdoption } = require('../main/profile-runtime-adoption');
const { createProfileRuntimePool } = require('../main/profile-runtime');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-cold-adoption-'));
function fixture(name) {
  const base = path.join(root, name), source = path.join(base, 'legacy'), data = path.join(source, 'local-barkpark/default');
  fs.mkdirSync(path.join(data, 'pgdata/pg_tblspc'), { recursive: true });
  fs.mkdirSync(path.join(data, 'media'), { recursive: true });
  fs.mkdirSync(path.join(data, 'runtime-build'), { recursive: true });
  fs.writeFileSync(path.join(data, 'pgdata/PG_VERSION'), '18');
  fs.writeFileSync(path.join(data, 'pgdata/content'), 'fixture DB');
  fs.writeFileSync(path.join(data, 'media/same.png'), 'fixture media');
  fs.writeFileSync(path.join(data, 'seeded'), 'clean\n');
  fs.writeFileSync(path.join(data, 'boot-ready'), 'old-boot');
  fs.writeFileSync(path.join(data, 'runtime-build/regenerable'), 'cache');
  fs.writeFileSync(path.join(source, 'settings.json'), JSON.stringify({ barkpark: { local: { source: path.join(base, 'built'), port: 4540, pgPort: 5540 } } }));
  const credentials = { password: 'enc:fixture-password', token: 'enc:fixture-token' };
  fs.writeFileSync(path.join(source, 'local-credentials.json'), JSON.stringify(credentials));
  const registry = createProfileRegistry(path.join(base, 'registry')), profile = registry.createProfile({ name });
  const store = registry.storeFor(profile.id);
  fs.copyFileSync(path.join(source, 'local-credentials.json'), path.join(store.storeDir, 'local-credentials.json'));
  const readSecrets = () => ({ password: 'unlocked fixture', token: 'unlocked token' });
  const checkCold = async dir => { if (fs.existsSync(path.join(dir, 'pgdata/postmaster.pid'))) throw new Error('not cold'); };
  return { registry, store, source, data, profileId: profile.id, readSecrets, checkCold };
}
const run = (f, checkpoint) => createRuntimeAdoption({ ...f, checkpoint });
const a = fixture('basic');
const adopted = await run(a).adopt({ profileId: a.profileId, legacyDir: a.source });
assert.equal(adopted.phase, 'committed');
assert.equal(fs.readFileSync(path.join(adopted.dataDir, 'media/same.png'), 'utf8'), 'fixture media');
assert.equal(fs.readFileSync(path.join(adopted.backupDir, 'pgdata/content'), 'utf8'), 'fixture DB');
assert.equal(fs.existsSync(path.join(adopted.dataDir, 'runtime-build')), false);
assert.equal(fs.existsSync(path.join(adopted.dataDir, 'boot-ready')), false);
assert.equal(a.store.readJson('runtime.json').port, 4540);
assert.deepEqual(await run(a).adopt({ profileId: a.profileId, legacyDir: a.source }), adopted);
fs.writeFileSync(path.join(adopted.dataDir, 'pgdata/content'), 'destination later edit');
assert.deepEqual(await run(a).adopt({ profileId: a.profileId, legacyDir: a.source }), adopted);
assert.equal(fs.readFileSync(path.join(a.data, 'pgdata/content'), 'utf8'), 'fixture DB');
await run(a).rollback({ profileId: a.profileId });
await run(a).rollback({ profileId: a.profileId });
assert.equal(a.store.readJson('runtime.json', null), null);
assert.equal(fs.readFileSync(path.join(adopted.dataDir, 'pgdata/content'), 'utf8'), 'destination later edit');
await assert.rejects(run(a).adopt({ profileId: a.profileId, legacyDir: a.source }), /rolled back/);
console.log('PASS cold payload/credential backup, origin retention, cache exclusion, idempotence and non-destructive rollback');
for (const phase of ['adoption-prepared', 'file-copied', 'adoption-backed-up', 'adoption-copied', 'descriptor-committed', 'adoption-committed']) {
  const f = fixture(phase); let fired = false;
  await assert.rejects(run(f, at => { if (at === phase && !fired) { fired = true; throw new Error('interrupted'); } }).adopt({ profileId: f.profileId, legacyDir: f.source }), /interrupted/);
  if (phase !== 'adoption-committed') {
    const pool = createProfileRuntimePool({ registry: f.registry, readSecrets: f.readSecrets });
    await assert.rejects(pool.acquire(f.profileId, { ownerId: 'blocked' }), /adoption is incomplete/);
  }
  const result = await run(f).adopt({ profileId: f.profileId, legacyDir: f.source });
  assert.equal(result.phase, 'committed');
  assert.equal(f.registry.load().profiles.length, 1);
}
console.log('PASS six named publication interruptions resume without duplicate profiles; incomplete starts blocked');
for (const kind of ['credentials', 'unlock', 'live', 'unknown', 'modified', 'linked']) {
  const f = fixture(kind);
  if (kind === 'credentials') f.store.writeJson('local-credentials.json', { password: 'new', token: 'new' });
  if (kind === 'unlock') f.readSecrets = () => null;
  if (kind === 'live') fs.writeFileSync(path.join(f.data, 'pgdata/postmaster.pid'), '123');
  if (kind === 'unknown') fs.writeFileSync(path.join(f.data, 'unclassified'), 'x');
  if (kind === 'linked') fs.symlinkSync(path.join(f.data, 'media'), path.join(f.data, 'indx'), 'junction');
  if (kind === 'modified') {
    await assert.rejects(run(f, at => { if (at === 'adoption-prepared') throw new Error('pause'); }).adopt({ profileId: f.profileId, legacyDir: f.source }), /pause/);
    fs.writeFileSync(path.join(f.data, 'media/same.png'), 'new source bytes');
  }
  await assert.rejects(run(f).adopt({ profileId: f.profileId, legacyDir: f.source }));
  assert.equal(f.store.readJson('runtime.json', null), null);
}
console.log('PASS changed/locked credentials, active source, unknown entry, changed source and junction refused');
const b = fixture('rollback-interrupt');
await run(b).adopt({ profileId: b.profileId, legacyDir: b.source });
await assert.rejects(run(b, at => { if (at === 'rollback-descriptor-retired') throw new Error('interrupted rollback'); }).rollback({ profileId: b.profileId }), /interrupted rollback/);
await assert.rejects(createProfileRuntimePool({ registry: b.registry, readSecrets: b.readSecrets }).acquire(b.profileId, { ownerId: 'blocked' }), /descriptor is missing/);
await run(b).rollback({ profileId: b.profileId });
assert.equal(b.store.readJson('runtime-adoption.json').phase, 'rolled-back');
console.log('PASS rollback publication interruption resumes without restoring authority');
const partial = fixture('partial-rollback');
await assert.rejects(run(partial, at => { if (at === 'adoption-backed-up') throw new Error('pause'); }).adopt({ profileId: partial.profileId, legacyDir: partial.source }), /pause/);
const partialData = path.join(partial.store.storeDir, 'local-barkpark/runtime/pgdata'); fs.mkdirSync(partialData, { recursive: true }); fs.writeFileSync(path.join(partialData, 'PG_VERSION'), '18');
await createRuntimeAdoption({ ...partial, checkCold: async () => { throw new Error('partial cluster has no pg_control'); } }).rollback({ profileId: partial.profileId });
await createRuntimeAdoption({ ...partial, checkCold: async () => { throw new Error('partial cluster has no pg_control'); } }).rollback({ profileId: partial.profileId });
assert.equal(partial.store.readJson('runtime-adoption.json').phase, 'rolled-back');
assert.equal(fs.existsSync(path.join(partialData, 'PG_VERSION')), true);
console.log('PASS partial unpublished copy can roll back without pretending it is a complete database');
for (const marker of ['pgdata/PG_VERSION', 'seeded']) {
  const f = fixture('missing-' + marker.replaceAll('/', '-'));
  const adopted = await run(f).adopt({ profileId: f.profileId, legacyDir: f.source });
  const file = path.join(adopted.dataDir, marker); fs.renameSync(file, file + '.retained');
  await assert.rejects(run(f).adopt({ profileId: f.profileId, legacyDir: f.source }), /data is missing/);
  await assert.rejects(createProfileRuntimePool({ registry: f.registry, readSecrets: f.readSecrets }).acquire(f.profileId, { ownerId: 'missing' }), /data is missing/);
  assert.equal(fs.existsSync(file), false);
}
console.log('PASS missing adopted database or seed marker refuses retry/start rather than initializing replacement');
for (const phase of ['adoption-prepared', 'adoption-backed-up', 'adoption-copied', 'descriptor-committed', 'adoption-committed']) {
  const f = fixture('exit-' + phase);
  const script = `const {createProfileRegistry}=require(${JSON.stringify(require.resolve('../main/profile-registry'))});const {createRuntimeAdoption}=require(${JSON.stringify(require.resolve('../main/profile-runtime-adoption'))});const registry=createProfileRegistry(${JSON.stringify(path.dirname(path.dirname(f.store.storeDir)))});createRuntimeAdoption({registry,readSecrets:()=>({password:'fixture',token:'fixture'}),checkCold:async()=>{},checkpoint:phase=>{if(phase===${JSON.stringify(phase)})process.exit(73)}}).adopt(${JSON.stringify({profileId:f.profileId,legacyDir:f.source})}).catch(e=>{console.error(e);process.exit(1)});`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 73, result.stderr);
  assert.equal((await run(f).adopt({ profileId: f.profileId, legacyDir: f.source })).phase, 'committed');
  assert.equal(f.registry.load().profiles.length, 1);
}
console.log('PASS five actual process exits recover stale leases and committed publication');
console.log('Retained fixture:', root);
