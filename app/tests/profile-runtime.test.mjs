import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileRuntimePool } = require('../main/profile-runtime');
let checks = 0;
const test = async (name, fn) => { await fn(); checks++; console.log('PASS ' + name); };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-profile-runtime-'));
function fixture(name, hooks = {}) {
  const registry = createProfileRegistry(path.join(root, name));
  const a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
  const runtimes = [], secrets = new Map(); let port = 12000;
  const options = { registry,
    allocate: async used => { while (used.has(port) || used.has(port + 1)) port += 2; const value = { port, pgPort: port + 1 }; port += 2; return value; },
    readSecrets: async store => { if (!secrets.has(store.profileId)) secrets.set(store.profileId, { password: crypto.randomBytes(32).toString('hex'), token: crypto.randomUUID() }); return secrets.get(store.profileId); },
    createRuntime: input => {
      let phase = 'stopped';
      const runtime = { ...input, starts: 0, stops: 0,
        async start() { this.starts++; phase = 'starting'; await hooks.start?.(this); phase = 'ready'; },
        async stop() { this.stops++; await hooks.stop?.(this); phase = 'stopped'; },
        async ready() { await hooks.ready?.(this); },
        status() { return { phase }; },
      }; runtimes.push(runtime); return runtime;
    },
  };
  return { registry, a, b, pool: createProfileRuntimePool(options), options, runtimes, source: path.resolve('fixture-built-source') };
}

await test('A run retains A while B selected, with independent descriptors, stores and credentials', async () => {
  const f = fixture('leases');
  const selected = await f.pool.select(f.a.id, { source: f.source });
  const run = await f.pool.acquire(f.a.id, { ownerId: 'run:A', writes: true });
  const b = await f.pool.select(f.b.id, { source: f.source });
  assert.equal(selected.connection.writes, false); assert.equal(run.connection.writes, true);
  assert.notEqual(run.connection.server, b.connection.server); assert.notEqual(run.connection.token, b.connection.token);
  assert.notEqual(run.storeDir, b.storeDir); assert.equal(run.connection.viaCli, false);
  assert.ok(Object.isFrozen(run) && Object.isFrozen(run.connection));
  assert.equal(f.runtimes[0].stops, 0); assert.equal(f.runtimes[0].status().phase, 'ready');
  assert.equal(f.registry.load().selectedProfileId, f.b.id);
  assert.equal(f.runtimes[0].dataDir, path.join(run.storeDir, 'local-barkpark', 'runtime'));
  const aDesc = f.registry.storeFor(f.a.id).readJson('runtime.json'), bDesc = f.registry.storeFor(f.b.id).readJson('runtime.json');
  assert.equal(new Set([aDesc.port, aDesc.pgPort, bDesc.port, bDesc.pgPort]).size, 4);
  await run.release(); await run.release();
  assert.equal(f.runtimes[0].stops, 1); assert.equal(f.runtimes[1].stops, 0);
  await f.pool.shutdown(); assert.equal(f.runtimes[1].stops, 1);
});

await test('parallel acquire starts each profile only once and allocator sees prior reservations', async () => {
  const f = fixture('parallel');
  const leases = await Promise.all([f.pool.acquire(f.a.id, { source: f.source, ownerId: 'A1' }), f.pool.acquire(f.a.id, { source: f.source, ownerId: 'A2' }), f.pool.acquire(f.b.id, { source: f.source, ownerId: 'B1' })]);
  assert.equal(f.runtimes.length, 2); assert.deepEqual(f.runtimes.map(r => r.starts), [1, 1]);
  await assert.rejects(f.pool.acquire(f.a.id, { ownerId: 'A1' }), /already acquired/);
  await leases[0].release(); assert.equal(f.runtimes[0].stops, 0);
  await Promise.all(leases.map(l => l.release())); await f.pool.shutdown();
});

await test('restart reuses descriptor and selection without rebinding source or ports', async () => {
  const f = fixture('restart'); await f.pool.select(f.b.id, { source: f.source });
  const before = f.registry.storeFor(f.b.id).readJson('runtime.json'); await f.pool.shutdown();
  const pool = createProfileRuntimePool({ ...f.options, registry: createProfileRegistry(path.join(root, 'restart')) });
  const lease = await pool.acquire(f.b.id, { ownerId: 'restart' });
  assert.equal(lease.connection.server, `http://127.0.0.1:${before.port}`);
  assert.equal(f.registry.load().selectedProfileId, f.b.id);
  await assert.rejects(pool.acquire(f.b.id, { ownerId: 'bad-source', source: path.resolve('different') }), /rebind/);
  await lease.release(); await pool.shutdown();
});

await test('failed B startup preserves selected A and cleans only B', async () => {
  const f = fixture('start-fails', { start: r => { if (r.descriptor.profileId === f.b.id) throw new Error('B fails'); } });
  await f.pool.select(f.a.id, { source: f.source });
  await assert.rejects(f.pool.select(f.b.id, { source: f.source }), /B fails/);
  assert.equal(f.registry.load().selectedProfileId, f.a.id);
  assert.equal(f.runtimes[0].stops, 0); assert.equal(f.runtimes[1].stops, 1);
  await f.pool.shutdown();
});

await test('failed selection persistence releases new lease and leaves old foreground running', async () => {
  const f = fixture('select-fails'); let refuse = false;
  const registry = { ...f.registry, selectProfile: id => { if (refuse) throw new Error('pointer unavailable'); return f.registry.selectProfile(id); } };
  const pool = createProfileRuntimePool({ ...f.options, registry });
  await pool.select(f.a.id, { source: f.source }); refuse = true;
  await assert.rejects(pool.select(f.b.id, { source: f.source }), /pointer unavailable/);
  assert.equal(f.runtimes[0].stops, 0); assert.equal(f.runtimes[1].stops, 1);
  await pool.shutdown();
});

await test('shutdown waits for run cleanup and refuses new work instead of stopping another run', async () => {
  const f = fixture('shutdown'); const run = await f.pool.acquire(f.a.id, { source: f.source, ownerId: 'run' });
  await assert.rejects(f.pool.shutdown(), /active run leases/);
  assert.equal(f.runtimes[0].stops, 0);
  await assert.rejects(f.pool.acquire(f.b.id, { source: f.source, ownerId: 'late' }), /shutting down/);
  await run.release(); await f.pool.shutdown(); assert.equal(f.runtimes[0].stops, 1);
});

await test('stop failure retains entry, reports failure and release retry stops owned runtime', async () => {
  let fail = true;
  const f = fixture('stop-fails', { stop: () => { if (fail) { fail = false; throw new Error('stop failed'); } } });
  const lease = await f.pool.acquire(f.a.id, { source: f.source, ownerId: 'run' });
  await assert.rejects(lease.release(), /stop failed/);
  assert.equal(f.pool.status().length, 1); assert.match(f.pool.status()[0].error, /stop failed/);
  await lease.release(); assert.equal(f.runtimes[0].stops, 2); assert.equal(f.pool.status().length, 0);
  await f.pool.shutdown();
});

await test('old runtime cleanup failure returns committed B with warning, never an ambiguous rejected switch', async () => {
  let refuse = true;
  const f = fixture('switch-stop-fails', { stop: runtime => { if (runtime.descriptor.profileId === f.a.id && refuse) { refuse = false; throw new Error('A cleanup failed'); } } });
  await f.pool.select(f.a.id, { source: f.source });
  const b = await f.pool.select(f.b.id, { source: f.source });
  assert.equal(b.profileId, f.b.id); assert.match(b.cleanupWarning, /A cleanup failed/);
  assert.equal(f.registry.load().selectedProfileId, f.b.id);
  assert.equal(f.runtimes[1].status().phase, 'ready');
  await f.pool.shutdown();
  assert.equal(f.runtimes[0].stops, 2); assert.equal(f.runtimes[1].stops, 1);
});

await test('writes remain explicit when selecting the same profile again', async () => {
  const f = fixture('writes'); const readOnly = await f.pool.select(f.a.id, { source: f.source });
  const writable = await f.pool.select(f.a.id, { source: f.source, writes: true });
  assert.equal(readOnly.connection.writes, false); assert.equal(writable.connection.writes, true);
  const revoked = await f.pool.select(f.a.id); assert.equal(revoked.connection.writes, false);
  assert.equal(f.runtimes.length, 1); await f.pool.shutdown();
});

await test('new leases check current runtime readiness after initial startup', async () => {
  let healthy = true;
  const f = fixture('recovery-ready', { ready: () => { if (!healthy) throw new Error('runtime recovering'); } });
  const first = await f.pool.acquire(f.a.id, { source: f.source, ownerId: 'existing-run' });
  healthy = false;
  await assert.rejects(f.pool.acquire(f.a.id, { ownerId: 'new-run' }), /recovering/);
  assert.equal(f.runtimes[0].stops, 0, 'failed new acquisition cannot stop existing lease');
  healthy = true;
  const recovered = await f.pool.acquire(f.a.id, { ownerId: 'new-run' });
  await recovered.release(); await first.release(); await f.pool.shutdown();
});

await test('selecting a profile without local runtime releases foreground only and preserves A run', async () => {
  const f = fixture('without-runtime');
  await f.pool.select(f.a.id, { source: f.source });
  const run = await f.pool.acquire(f.a.id, { ownerId: 'A-run', writes: true });
  const b = await f.pool.selectWithoutRuntime(f.b.id);
  assert.equal(b.profileId, f.b.id); assert.equal(b.connection, null);
  assert.equal(f.registry.load().selectedProfileId, f.b.id);
  assert.equal(f.runtimes.length, 1); assert.equal(f.runtimes[0].stops, 0);
  await run.release(); assert.equal(f.runtimes[0].stops, 1); await f.pool.shutdown();
});

await test('invalid/foreign/colliding descriptors fail before runtime creation', async () => {
  for (const kind of ['version', 'owner', 'port', 'collision']) {
    const f = fixture('invalid-' + kind);
    const descriptor = { version: 1, profileId: f.a.id, source: f.source, port: 18000, pgPort: 18001 };
    if (kind === 'version') descriptor.version = 99;
    if (kind === 'owner') descriptor.profileId = f.b.id;
    if (kind === 'port') descriptor.port = descriptor.pgPort;
    if (kind === 'collision') f.registry.storeFor(f.b.id).writeJson('runtime.json', { ...descriptor, profileId: f.b.id });
    f.registry.storeFor(f.a.id).writeJson('runtime.json', descriptor);
    await assert.rejects(f.pool.acquire(f.a.id, { ownerId: 'bad' }), /descriptor|collide/);
    assert.equal(f.runtimes.length, 0); await f.pool.shutdown();
  }
});

await test('descriptor lease refuses another writer and does not change its ownership', async () => {
  const f = fixture('writer'), file = path.join(root, 'writer', 'runtime-descriptors.lock');
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid }));
  await assert.rejects(f.pool.acquire(f.a.id, { source: f.source, ownerId: 'run' }), /another writer/);
  assert.equal(f.runtimes.length, 0); assert.equal(JSON.parse(fs.readFileSync(file)).pid, process.pid);
  await f.pool.shutdown();
});

console.log(`${checks} runtime-pool checks passed; fixtures retained at ${root}`);
