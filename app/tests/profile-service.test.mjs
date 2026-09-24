import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const runs = require('../main/providers/runs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-profile-service-'));
const registry = createProfileRegistry(root);
const a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
registry.selectProfile(a.id);
const dispatched = [], delivered = [];
const agent = { ...runs, async start(options) {
  const run = runs.createRun(options); dispatched.push({ options, run });
  run.emit({ type: 'status', model: 'fixture' });
  return { runId: run.id };
} };
const service = createProfileService({ registry, agent, sendEvent: event => delivered.push(event) });
const snapshot = label => ({ version: 1, chats: { same: { id: 'same', title: label, folder: null, provider: 'api', messages: [], draft: label + ' draft', tabs: [] } }, order: ['same'], current: 'same' });
const ownerA = service.view(); service.save(ownerA, snapshot('A'));
let ownerB = await service.select(ownerA, b.id); service.save(ownerB, snapshot('B'));
assert.throws(() => service.save(ownerA, snapshot('stale')), /Stale/);
assert.throws(() => service.cancel(ownerA, 'missing'), /Stale/);
let freshA = await service.select(ownerB, a.id);
const started = await service.start(freshA, { chatId: 'same', prompt: 'Work A', attemptId: crypto.randomUUID() });
const run = dispatched[0].run;
assert.equal(run.scope.profileId, a.id);
assert.equal(run.scope.storeDir, registry.storeFor(a.id).storeDir);
assert.equal(service.load(freshA).chats.same.messages.length, 2);
const approval = runs.requestApproval(run, { kind: 'write_file', path: 'fixture.txt' });
const approvalId = [...run.approvals.keys()][0];
assert.equal(service.approve(freshA, run.id, approvalId, true), true);
assert.equal(await approval, true);
assert.equal(service.load(freshA).chats.same.messages.at(-1).approvals[0].status, 'approved');
ownerB = await service.select(freshA, b.id);
assert.throws(() => service.cancel(ownerB, run.id), /not owned/);
assert.throws(() => service.approve(ownerB, run.id, approvalId, true), /not owned/);
await assert.rejects(service.wait(ownerB, run.id), /not owned/);
const count = delivered.length;
const foregroundFile = path.join(registry.storeFor(b.id).storeDir, 'workspace.json');
fs.renameSync(foregroundFile, foregroundFile + '.retained');
assert.throws(() => service.load(ownerB), /workspace is missing/);
run.emit({ type: 'text_delta', text: 'A output after B switch' });
run.emit({ type: 'done' });
assert.equal(run.abort.signal.aborted, false, 'unreadable B must not cancel a captured A run');
fs.renameSync(foregroundFile + '.retained', foregroundFile);
assert.equal(delivered.length, count);
assert.equal(service.load(ownerB).chats.same.messages.length, 0);
assert.equal(service.load(ownerB).chats.same.draft, 'B draft');
await runs.finish(run);
await new Promise(resolve => setImmediate(resolve));
freshA = await service.select(ownerB, a.id);
assert.equal(service.load(freshA).chats.same.messages.at(-1).text, 'A output after B switch');
assert.equal(service.load(freshA).chats.same.runId, null);
assert.equal((await service.wait(freshA, started.runId)).status, 'completed');
await assert.rejects(service.start(freshA, { chatId: 'same', prompt: 'Wrong image', images: [{ path: path.join(root, 'foreign.png') }] }), /Attachment foreign.png is unavailable/);
assert.equal(dispatched.length, 1);
const input = { chatId: 'same', prompt: 'Original', images: [] };
const pending = service.start(freshA, input); input.prompt = 'Mutation';
await pending;
assert.equal(dispatched[1].options.prompt, 'Original');
service.cancel(freshA, dispatched[1].run.id);
await runs.finish(dispatched[1].run);
await new Promise(resolve => setImmediate(resolve));
assert.equal(service.load(freshA).chats.same.runId, null);
let unblock, released = 0;
const acquireGate = new Promise(resolve => { unblock = resolve; });
const localSettings = { provider: 'api', model: 'initial-model', barkpark: { local: { enabled: true, source: root } } };
const pool = {
  async acquire(profileId) { await acquireGate; return { connection: { enabled: false }, release: async () => { released++; } }; },
  async select() { throw new Error('fixture startup failed'); },
  async selectWithoutRuntime(profileId) { registry.selectProfile(profileId); return { cleanupWarning: 'retained cleanup fixture' }; }
};
const leased = createProfileService({ registry, agent, runtimePool: pool, settingsFor: () => localSettings });
const leaseOwner = leased.view();
const delayed = leased.start(leaseOwner, { chatId: 'same', prompt: 'Delayed startup' });
localSettings.model = 'mutated-model';
await assert.rejects(leased.select(leaseOwner, b.id), /startup failed/);
assert.deepEqual(leased.view(), leaseOwner);
unblock(); await delayed;
assert.equal(dispatched.at(-1).options.settings.model, 'initial-model');
assert.equal(released, 0);
leased.cancel(leaseOwner, dispatched.at(-1).run.id);
assert.equal(released, 0, 'cancel cannot release a runtime before driver cleanup');
await runs.finish(dispatched.at(-1).run);
await leased.wait(leaseOwner, dispatched.at(-1).run.id);
assert.equal(released, 1);
localSettings.barkpark.local.enabled = false;
const switched = await leased.select(leaseOwner, b.id);
assert.equal(switched.cleanupWarning, 'retained cleanup fixture');
assert.equal(leased.view().profileId, b.id);
const disabled = createProfileService({ registry,
  settingsFor: () => ({ barkpark: { enabled: false, writes: true, local: { enabled: true } } }),
  runtimePool: { acquire: async profileId => ({ connection: { enabled: true, writes: true,
    server: 'http://fixture', token: 'fixture', dataset: 'production', managedProfileId: profileId }, release: async () => {} }) }
});
const disabledScope = await disabled.resolve(b.id, 'same');
try {
  assert.equal(disabledScope.scope.connection.enabled, false, 'runtime availability must not override disabled Paper access');
  const tools = require('../main/paper-tools').createPaperTools({ store: disabledScope.scope.store, connection: disabledScope.scope.connection, profileId: b.id });
  assert.deepEqual(await tools.list(), []);
  await assert.rejects(tools.create({ title: 'Unavailable', markdown: 'Must not create' }), { code: 'draft_identity' });
} finally { await disabledScope.release(); }
const mixed = service.workspaces.load(b.id);
mixed.chats.same.provider = 'claude';
mixed.chats.same.sessions = { claude: 'fixture-session' };
mixed.chats.same.sessionSeen = { claude: 2 };
mixed.chats.same.messages = [
  { role: 'user', text: 'Already seen' }, { role: 'assistant', provider: 'claude', text: 'Seen answer' },
  { role: 'user', text: 'Intervening decision' }, { role: 'assistant', provider: 'codex', text: 'Use the blue design' }
];
registry.storeFor(b.id).writeJson('workspace.json', mixed);
const transport = require('../main/providers/claude');
let sdkPrompt;
transport.setSdkLoader(async () => ({ query({ prompt }) {
  sdkPrompt = prompt;
  return { async *[Symbol.asyncIterator]() { yield { type: 'result', subtype: 'success', result: 'Continued' }; } };
} }));
try {
  const real = createProfileService({ registry, agent: require('../main/agent') }); // in-process SDK injection seam
  const actual = await real.start(real.view(), { chatId: 'same', prompt: 'Continue it' });
  await real.wait(real.view(), actual.runId);
  assert.match(sdkPrompt, /Intervening decision/);
  assert.match(sdkPrompt, /Assistant \(Codex\): Use the blue design/);
  assert.doesNotMatch(sdkPrompt, /Already seen|Seen answer/);
} finally { transport.setSdkLoader(null); }
console.log(JSON.stringify({ passed: ['generation saves', 'trusted scope', 'durable approvals', 'cross-profile controls', 'late A transcript with B draft', 'driver finalization', 'foreign image rejection', 'dispatch input snapshot'], root, retained: true }));
