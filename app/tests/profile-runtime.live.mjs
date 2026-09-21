// Disposable real two-profile proof; never reads a person's library or changes bp CLI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tinyPng } from './png.mjs';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileRuntimePool } = require('../main/profile-runtime');
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const barkpark = require('../main/barkpark');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || '../../barkpark-editor');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-dual-profile-'));
const registry = createProfileRegistry(path.join(data, 'registry'));
const a = registry.createProfile({ name: 'Fixture A' }), b = registry.createProfile({ name: 'Fixture B' });
const drivers = [], runtimes = [], leases = [];
const checks = [];
const record = name => { checks.push(name); console.log('PASS ' + name); };
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const evidence = { startedAt: new Date().toISOString(), barkdownCommit: git(['rev-parse', 'HEAD']), barkdownDirty: git(['status', '--porcelain', '--', 'app/main', 'app/tests/profile-runtime.live.mjs']) !== '', barkparkCommit: git(['rev-parse', 'HEAD'], source), barkparkDirty: git(['status', '--porcelain'], source) !== '', checks, profiles: [], stopped: false };
const options = {
  registry,
  // Plain generated secrets exist only inside this retained disposable fixture.
  // Production callers provide safeStorage-backed readSecrets; no secrets in report.
  readSecrets: async store => {
    let value = store.readJson('fixture-secrets.json', null);
    if (!value) { value = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') }; store.writeJson('fixture-secrets.json', value); }
    return value;
  },
  createRuntime: ({ descriptor, dataDir, secrets }) => {
    const driver = new SourceDriver(descriptor, dataDir, secrets); drivers.push(driver);
    const runtime = new LocalBarkpark(driver, { retries: 0 }); runtimes.push(runtime);
    runtime.on('status', status => console.log(descriptor.profileId === a.id ? 'A:' : 'B:', status.phase, status.error || ''));
    return runtime;
  },
};
let pool = createProfileRuntimePool(options);
console.log('Disposable dual-profile fixture:', data);
try {
  const acquisitions = await Promise.allSettled([
    pool.acquire(a.id, { source, ownerId: 'background-A', writes: true }),
    pool.acquire(b.id, { source, ownerId: 'fixture-B', writes: true }),
  ]);
  for (const result of acquisitions) if (result.status === 'fulfilled') leases.push(result.value);
  const failure = acquisitions.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  const [runA, runB] = acquisitions.map(result => result.value);
  assert.equal(runtimes.filter(r => r.status().phase === 'ready').length, 2);
  assert.notEqual(runA.connection.server, runB.connection.server);
  assert.notEqual(runA.connection.token, runB.connection.token);
  for (const profile of [a, b]) { const descriptor = registry.storeFor(profile.id).readJson('runtime.json'); evidence.profiles.push({ id: profile.id, port: descriptor.port, pgPort: descriptor.pgPort }); }
  assert.equal(new Set(evidence.profiles.flatMap(p => [p.port, p.pgPort])).size, 4);
  record('two real private runtimes concurrently ready with distinct ports, roots and credentials');

  const slug = 'same-slug';
  for (const [lease, label, color] of [[runA, 'A', [220, 20, 20]], [runB, 'B', [20, 20, 220]]]) {
    // A clean server has no tag vocabulary. Register the fixture label through
    // the actual mutate/publish endpoint before the Paper publish wall checks it.
    const tagResponse = await fetch(lease.connection.server + '/v1/data/mutate/production', { method: 'POST', headers: { authorization: 'Bearer ' + lease.connection.token, 'content-type': 'application/json' }, body: JSON.stringify({ mutations: [
      { createOrReplace: { _id: 'profile-fixture', _type: 'tag', title: 'Profile fixture' } },
      { publish: { id: 'profile-fixture', type: 'tag' } },
    ] }) });
    assert.equal(tagResponse.status, 200, await tagResponse.text());
    const mediaFile = path.join(data, `${label}.png`); fs.writeFileSync(mediaFile, tinyPng(32, 32, color));
    const media = await barkpark.uploadMedia(lease.connection, { name: 'same.png', mime: 'image/png', filePath: mediaFile });
    assert.equal(new URL(media.src).origin, lease.connection.server, 'media URL must belong to captured profile');
    await barkpark.publish(lease.connection, { slug, title: `Owned by ${label}`, description: `Disposable isolation fixture for profile ${label}; content and media must stay with their owner.`, tags: [{ tag: 'profile-fixture', strength: 95, rationale: 'Disposable profile isolation test fixture' }], blocks: [
      { type: 'paragraph', content: [{ type: 'text', value: `Private note ${label}` }] },
      { type: 'image', src: media.src, alt: `Private image ${label}`, width: 32, height: 32 },
    ] });
    const fetched = await fetch(media.src, { headers: { authorization: 'Bearer ' + lease.connection.token } });
    assert.equal(fetched.status, 200); assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), fs.readFileSync(mediaFile));
    evidence.profiles.find(p => p.id === lease.profileId).mediaPath = new URL(media.src).pathname;
  }
  const paperA = await barkpark.getPaper(runA.connection, slug), paperB = await barkpark.getPaper(runB.connection, slug);
  assert.equal(paperA.title, 'Owned by A'); assert.equal(paperB.title, 'Owned by B');
  assert.match(paperA.markdown, /Private note A/); assert.match(paperB.markdown, /Private note B/);
  await assert.rejects(barkpark.getPaper({ ...runB.connection, token: runA.connection.token }, slug));
  const aMediaAtB = runB.connection.server + evidence.profiles.find(p => p.id === a.id).mediaPath;
  assert.notEqual((await fetch(aMediaAtB, { headers: { authorization: 'Bearer ' + runB.connection.token } })).status, 200);
  record('same-slug notes and uploaded media remain isolated; A credentials cannot access B');

  await pool.select(a.id, { writes: true });
  await pool.select(b.id, { writes: true });
  assert.equal(registry.load().selectedProfileId, b.id);
  assert.equal(runtimes[0].status().phase, 'ready');
  const updated = await barkpark.applyOps(runA.connection, slug, [{ op: 'append-block', block: { type: 'paragraph', content: [{ type: 'text', value: 'A background completion' }] } }], paperA.rev);
  assert.equal(updated.ok, true);
  assert.match((await barkpark.getPaper(runA.connection, slug)).markdown, /A background completion/);
  assert.doesNotMatch((await barkpark.getPaper(runB.connection, slug)).markdown, /A background completion/);
  record('switch to B retains A background lease; real revision-checked A write changes only A');

  await runA.release();
  assert.equal(runtimes[0].status().phase, 'stopped');
  assert.equal((await barkpark.getPaper(runB.connection, slug)).title, 'Owned by B');
  const restartedA = await pool.acquire(a.id, { ownerId: 'restart-A', writes: true }); leases.push(restartedA);
  assert.equal(restartedA.connection.server, runA.connection.server);
  assert.match((await barkpark.getPaper(restartedA.connection, slug)).markdown, /A background completion/);
  assert.equal((await barkpark.getPaper(runB.connection, slug)).title, 'Owned by B');
  record('stopping and restarting A preserves content/ports while B remains available');
  await restartedA.release(); await runB.release(); await pool.shutdown();
  assert.equal(drivers.every(driver => !fs.existsSync(path.join(driver.pgData, 'postmaster.pid'))), true);
  record('normal shutdown stops only owned private clusters and retains profile data');

  pool = createProfileRuntimePool({ ...options, registry: createProfileRegistry(path.join(data, 'registry')) });
  const selected = registry.load().selectedProfileId;
  const afterRestart = await pool.select(selected, { writes: true });
  assert.equal(selected, b.id); assert.equal(afterRestart.connection.server, runB.connection.server);
  assert.equal((await barkpark.getPaper(afterRestart.connection, slug)).title, 'Owned by B');
  record('new pool restores selected B with its original data, endpoint and credentials');
} catch (error) {
  evidence.error = error.message;
  throw error;
} finally {
  const cleanup = await Promise.allSettled(leases.map(lease => lease.release()));
  const poolCleanup = await pool.shutdown().then(() => null, error => error);
  // Last-resort cleanup remains scoped to drivers this fixture itself created.
  const finalStops = await Promise.allSettled(runtimes.map(runtime => runtime.stop()));
  evidence.stopped = drivers.every(driver => !fs.existsSync(path.join(driver.pgData, 'postmaster.pid')));
  evidence.cleanupErrors = [...cleanup, ...finalStops].filter(r => r.status === 'rejected').map(r => r.reason.message);
  if (poolCleanup) evidence.cleanupErrors.push(poolCleanup.message);
  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(data, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log('Evidence retained:', path.join(data, 'evidence.json'));
  if (!evidence.stopped) throw new Error('Owned cluster did not stop; inspect retained fixture');
}
