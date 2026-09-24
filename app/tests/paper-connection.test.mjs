import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const { createPaperConnection } = createRequire(import.meta.url)('../main/paper-connection');
const original = () => ({ enabled: true, writes: true, server: 'http://127.0.0.1:1234', dataset: 'production', token: 'private-fixture', connectionOwner: ['profile-A'] });
const setup = (extra = {}) => { let current = { ...original(), ...extra }; const calls = []; const service = createPaperConnection({ config: () => current, cliScope: async c => { calls.push(c.server); return ['-s', c.server, '-d', c.dataset, '-w', 'workspace', '-p', 'project']; } }); return { service, calls, set: c => { current = c; }, get: () => current }; };
const refused = fn => assert.rejects(fn, { code: 'paper_connection_changed' });
test('missing, forged and foreign bindings refuse before any write', async () => {
  const s = setup(); const read = await s.service.read(undefined, async () => ({ id: 'same', rev: 1 })); let writes = 0;
  await refused(() => s.service.write(undefined, () => writes++));
  await refused(() => s.service.write('forged', () => writes++));
  s.set({ ...original(), server: 'http://127.0.0.1:5678' });
  await refused(() => s.service.write(read.binding, () => writes++)); assert.equal(writes, 0);
});
for (const [field, value] of [['server', 'https://other.invalid'], ['dataset', 'other'], ['token', 'other'], ['viaCli', true], ['connectionOwner', ['profile-B']]]) {
  test(`${field} changes refuse old reads and writes before access`, async () => {
    const s = setup(); const read = await s.service.read(undefined, async () => 1); s.set({ ...original(), [field]: value }); let calls = 0;
    await refused(() => s.service.read(read.binding, () => calls++)); await refused(() => s.service.write(read.binding, () => calls++)); assert.equal(calls, 0);
  });
}
test('A to B to A allows guarded retry with original routing', async () => {
  const s = setup(), read = await s.service.read(undefined, async () => 1);
  s.set({ ...original(), server: 'https://other.invalid' }); await refused(() => s.service.write(read.binding, () => assert.fail()));
  s.set(original()); assert.equal(await s.service.write(read.binding, c => c.server), original().server);
});
test('writes permission is checked without changing connection identity', async () => {
  const s = setup(), read = await s.service.read(undefined, async () => 1); s.set({ ...original(), writes: false });
  assert.equal(s.service.currentIdentity(), read.connectionIdentity);
  await assert.rejects(() => s.service.write(read.binding, () => assert.fail()), { code: 'writes_disabled' });
  s.set({ ...original(), enabled: false }); await refused(() => s.service.read(read.binding, () => assert.fail()));
});
test('settings changed during read cannot publish its result under a new connection', async () => {
  const s = setup(); await refused(() => s.service.read(undefined, async () => { s.set({ ...original(), dataset: 'other' }); return { id: 'same', rev: 1 }; }));
});
test('multi-step operation holds original config across settings changes', async () => {
  const s = setup(), read = await s.service.read(undefined, async () => 1); const seen = [];
  await s.service.write(read.binding, async c => { seen.push(c.server); s.set({ ...original(), server: 'https://other.invalid' }); await Promise.resolve(); seen.push(c.server); });
  assert.deepEqual(seen, [original().server, original().server]);
});
test('CLI routing is captured once and never falls back to ambient defaults', async () => {
  const s = setup({ viaCli: true }), read = await s.service.read(undefined, async c => c.cliRouting);
  await s.service.write(read.binding, async c => { assert.deepEqual(c.cliRouting, read.value); c.cliRouting.pop(); });
  await s.service.write(read.binding, async c => assert.deepEqual(c.cliRouting, read.value)); assert.equal(s.calls.length, 1);
  s.set({ ...s.get(), server: 'https://foreign.invalid' }); await refused(() => s.service.write(read.binding, () => assert.fail())); assert.equal(s.calls.length, 1);
});
test('CLI scope lookup completing after settings change is refused', async () => {
  let c = { ...original(), viaCli: true }; const s = createPaperConnection({ config: () => c, cliScope: async () => { c = { ...c, dataset: 'other' }; return ['-s', original().server]; } });
  await refused(() => s.read(undefined, () => assert.fail()));
});
test('bindings contain neither secrets nor destination and cannot cross sessions', async () => {
  const a = setup(), b = setup(), read = await a.service.read(undefined, async () => 1);
  assert.match(read.binding, /^[a-f0-9]{64}$/); assert.ok(!read.binding.includes('private-fixture'));
  await refused(() => b.service.write(read.binding, () => assert.fail()));
});

test('permission revoked while capture yields refuses before access', async () => {
 const s=setup(),read=await s.service.read(undefined,async()=>1);let calls=0;
 const pending=s.service.write(read.binding,()=>calls++);s.set({...original(),writes:false});
 await assert.rejects(()=>pending,{code:'writes_disabled'});assert.equal(calls,0);
});
test('disabled connection during a read cannot publish the result', async () => {
 const s=setup();await refused(()=>s.service.read(undefined,async()=>{s.set({...original(),enabled:false});return 1;}));
});
test('retained local mutations can demand a binding without requiring server write permission', async () => {
 const s=setup({writes:false});await refused(()=>s.service.read(undefined,()=>assert.fail(),true));
 const r=await s.service.read(undefined,async()=>1);assert.equal((await s.service.read(r.binding,()=>2,true)).value,2);
});
