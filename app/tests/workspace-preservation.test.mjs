import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const registryModule = require.resolve('../main/profile-registry');
const repositoryModule = require.resolve('../main/workspace-repository');
const { createProfileRegistry } = require(registryModule);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-workspace-preservation-'));
const registry = createProfileRegistry(path.join(root, 'registry'));
const a = registry.createProfile({ name: 'A' }), b = registry.createProfile({ name: 'B' });
function workspace(label) { return { version: 1, chats: { same: { id: 'same', messages: [], draft: label + ' unsent', tabs: [{ type: 'doc', id: 'same' }], events: [] } }, order: ['same'], current: 'same', favorites: [{ id: 'same', title: label }], pages: { roots: ['same'] } }; }
registry.storeFor(a.id).writeJson('workspace.json', workspace('A'));
registry.storeFor(b.id).writeJson('workspace.json', workspace('B'));
registry.selectProfile(b.id);
const aFile = path.join(registry.storeFor(a.id).storeDir, 'workspace.json');
const bFile = path.join(registry.storeFor(b.id).storeDir, 'workspace.json');
const originalA = fs.readFileSync(aFile), originalB = fs.readFileSync(bFile);
fs.renameSync(bFile, bFile + '.retained');
const probe = spawnSync(process.execPath, ['-e', `
const {createProfileRegistry}=require(${JSON.stringify(registryModule)});
const {createWorkspaceRepository}=require(${JSON.stringify(repositoryModule)});
const registry=createProfileRegistry(${JSON.stringify(path.join(root, 'registry'))});
const repo=createWorkspaceRepository({registry});
const profileId=registry.load().selectedProfileId;
const result={profileId};
try { result.loaded=repo.load(profileId); } catch(error) { result.loadError=error.message; }
try { repo.saveView(profileId,{version:1,chats:{},order:[]}); result.saved=true; } catch(error) { result.saveError=error.message; }
console.log(JSON.stringify(result));
`], { encoding: 'utf8' });
assert.equal(probe.status, 0, probe.stderr);
const result = JSON.parse(probe.stdout);
fs.writeFileSync(path.join(root, 'restart-result.json'), JSON.stringify(result, null, 2));
console.log('Retained restart evidence: ' + root);
assert.equal(result.profileId, b.id);
assert.ok(result.loadError, 'missing saved B must reject load, not return empty');
assert.ok(result.saveError, 'missing saved B must reject save, not create replacement');
assert.equal(fs.existsSync(bFile), false);
assert.deepEqual(fs.readFileSync(aFile), originalA);
assert.deepEqual(fs.readFileSync(bFile + '.retained'), originalB);
console.log('PASS actual child-process restart refuses missing saved B without replacement or changes to A/original');

const { createWorkspaceRepository } = require(repositoryModule);
const repository = createWorkspaceRepository({ registry });
for (const invalid of ['null', '[]', '{broken', JSON.stringify({ version: 2, chats: {}, order: [] })]) {
  fs.writeFileSync(bFile, invalid);
  assert.throws(() => repository.load(b.id));
  assert.throws(() => repository.saveView(b.id, workspace('replacement')));
  assert.equal(fs.readFileSync(bFile, 'utf8'), invalid);
}
fs.renameSync(bFile, bFile + '.invalid-retained');
assert.deepEqual(fs.readFileSync(aFile), originalA);
console.log('PASS null, malformed, array and unsupported workspace remain unchanged on failed load/save');

const fresh = registry.createProfile({ name: 'Fresh' });
assert.deepEqual(repository.load(fresh.id).chats, {});
repository.saveView(fresh.id, workspace('Fresh'));
assert.equal(repository.load(fresh.id).chats.same.draft, 'Fresh unsent');
console.log('PASS new profile owns a valid empty workspace immediately and supports first save');

for (const phase of ['profile-workspace-initialized', 'generation-written', 'previous-pointer-written', 'registry-committed']) {
  const target = path.join(root, phase), requestId = randomUUID();
  const prior = createProfileRegistry(target).createProfile({ name: 'Existing' });
  const killed = spawnSync(process.execPath, ['-e', `
const {createProfileRegistry}=require(${JSON.stringify(registryModule)});
createProfileRegistry(${JSON.stringify(target)},{checkpoint:phase=>{if(phase===${JSON.stringify(phase)})process.exit(73)}}).createProfile({name:'Interrupted',requestId:${JSON.stringify(requestId)}});
`], { encoding: 'utf8' });
  assert.equal(killed.status, 73, killed.stderr);
  const reopened = createProfileRegistry(target);
  for (const profile of reopened.load().profiles) assert.equal(reopened.storeFor(profile.id).readJson('workspace.json').version, 1);
  const created = reopened.createProfile({ name: 'Interrupted', requestId });
  assert.equal(reopened.createProfile({ name: 'Interrupted', requestId }).id, created.id);
  assert.equal(reopened.load().profiles.length, 2);
  assert.ok(reopened.load().profiles.some(p => p.id === prior.id));
  const file = path.join(reopened.storeFor(created.id).storeDir, 'workspace.json');
  fs.renameSync(file, file + '.retained');
  assert.equal(reopened.createProfile({ name: 'Interrupted', requestId }).id, created.id);
  assert.equal(fs.existsSync(file), false, 'idempotent create retry must not repair missing visible data');
}
console.log('PASS four actual initialization/publication exits never expose uninitialized profiles; retry publishes once without repairing later loss');
