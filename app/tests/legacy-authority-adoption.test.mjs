import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { acquireAuthorityLease, createLegacyAdoption } = require('../main/legacy-authority-adoption');
const { createProfileRegistry } = require('../main/profile-registry');
const { acquireFileLease } = require('../main/file-lease');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-authority-'));
const fixtures = [];
const readSecrets = () => ({ password: 'fixture-password', token: 'fixture-token' });
const checkCold = async dir => { if (fs.existsSync(path.join(dir, 'pgdata/postmaster.pid'))) throw new Error('Database is not cold'); };
function fixture(name, runtime = false) {
  const userData = path.join(root, name), source = path.join(userData, 'barkdown');
  fs.mkdirSync(path.join(source, 'attachments'), { recursive: true }); fs.mkdirSync(path.join(source, 'documents')); fs.mkdirSync(path.join(source, 'agent-edits'));
  const image = path.join(source, 'attachments/picture.png'), url = pathToFileURL(image).href; fs.writeFileSync(image, 'owned-image-bytes');
  const imageObject = { id: 'image', path: image, url, name: 'picture.png' };
  const chats = { main: { id: 'main', title: 'Original main', folder: path.join(root, 'external-project'), messages: [{ role: 'user', text: 'Original transcript', images: [imageObject] }], tabs: [{ kind: 'doc', id: 'note' }], draft: 'Draft kept', draftImages: [imageObject] }, side: { id: 'side', parent: 'main', parentTitle: 'Original main', side: true, messages: [], tabs: [], draft: 'Side draft' } };
  const put = (file, value) => fs.writeFileSync(path.join(source, file), JSON.stringify(value));
  put('workspace.json', { version: 1, chats, order: ['main', 'side'], current: 'main', favorites: [{ kind: 'doc', id: 'note' }], pages: [{ id: 'note', children: [{ id: 'bp:same-slug' }] }], unknownCompatible: { retained: true } });
  put('settings.json', { theme: 'dark', sidebarWidth: 222, barkpark: { local: { enabled: runtime, source: path.join(root, 'built'), port: 4540, pgPort: 5540 } } });
  put('local-credentials.json', { password: 'enc:preserved-password-bytes', token: 'enc:preserved-token-bytes' });
  put('documents/note.json', { id: 'note', rev: 3, title: 'Local note', content: { type: 'doc', content: [{ type: 'image', attrs: { src: url } }] }, markdown: `![Owned image](${url})` });
  fs.writeFileSync(path.join(source, 'documents/note.md'), `# Local note\n\n![Owned image](${url})\n`);
  put('agent-edits/note.json', { id: 'receipt', documentId: 'note', beforeRev: 2, afterRev: 3, before: { content: { type: 'doc', content: [{ type: 'image', attrs: { src: url } }] } } });
  if (runtime) {
    const data = path.join(source, 'local-barkpark/default'); fs.mkdirSync(path.join(data, 'pgdata/pg_tblspc'), { recursive: true }); fs.mkdirSync(path.join(data, 'media'));
    fs.writeFileSync(path.join(data, 'pgdata/PG_VERSION'), '18'); fs.writeFileSync(path.join(data, 'pgdata/content'), 'database-content'); fs.writeFileSync(path.join(data, 'seeded'), 'clean\n'); fs.writeFileSync(path.join(data, 'media/original.png'), 'server-image-bytes');
  }
  const f = { userData, source, image, ownership: acquireAuthorityLease(userData), readSecrets, checkCold };
  f.api = checkpoint => createLegacyAdoption({ ...f, checkpoint }); fixtures.push(f); return f;
}
const a = fixture('full', true), api = a.api();
assert.equal(api.inspect().status, 'none');
const originalWorkspace = fs.readFileSync(path.join(a.source, 'workspace.json'));
const prepared = await api.prepare(); assert.equal(prepared.status, 'staged'); assert.deepEqual(prepared.actions, ['activate']);
assert.equal(fs.existsSync(prepared.finalRoot), false);
assert.equal((await api.prepare()).profileId, prepared.profileId);
const activated = await api.recover({ action: 'activate' }); assert.equal(activated.status, 'active');
assert.equal((await api.recover({ action: 'activate' })).profileId, activated.profileId);
const registry = createProfileRegistry(activated.finalRoot), store = registry.storeFor(activated.profileId), ws = store.readJson('workspace.json');
assert.equal(registry.load().profiles.length, 1); assert.equal(registry.load().appSettings.theme, 'dark');
assert.equal(ws.chats.side.parent, 'main'); assert.equal(ws.chats.main.draft, 'Draft kept'); assert.equal(ws.chats.side.draft, 'Side draft');
assert.equal(ws.chats.main.messages[0].text, 'Original transcript'); assert.equal(ws.chats.main.folder, path.join(root, 'external-project'));
assert.equal(ws.unknownCompatible.retained, true); assert.deepEqual(ws.pages, JSON.parse(originalWorkspace).pages);
const moved = path.join(store.storeDir, 'attachments/picture.png');
assert.equal(ws.chats.main.draftImages[0].path, moved); assert.equal(ws.chats.main.messages[0].images[0].url, pathToFileURL(moved).href);
assert.equal(store.readJson('agent-edits/note.json').before.content.content[0].attrs.src, pathToFileURL(moved).href);
assert.match(fs.readFileSync(path.join(store.storeDir, 'documents/note.md'), 'utf8'), /profile-data/);
assert.equal(fs.readFileSync(path.join(store.storeDir, 'local-credentials.json'), 'utf8'), fs.readFileSync(path.join(a.source, 'local-credentials.json'), 'utf8'));
fs.renameSync(path.join(a.source, 'attachments'), path.join(a.source, 'attachments-retained'));
assert.equal(fs.readFileSync(moved, 'utf8'), 'owned-image-bytes');
fs.renameSync(path.join(a.source, 'attachments-retained'), path.join(a.source, 'attachments'));
assert.deepEqual(fs.readFileSync(path.join(a.source, 'workspace.json')), originalWorkspace);
ws.chats.main.draft = 'Adopted-only edit'; store.writeJson('workspace.json', ws);
registry.createProfile({ name: 'Later legitimate profile' });
assert.equal(api.inspect().status, 'active', 'later registry generations must remain valid');
const rolled = await api.recover({ action: 'rollback' }); assert.equal(rolled.status, 'rolled-back');
assert.equal((await api.recover({ action: 'rollback' })).status, 'rolled-back');
assert.equal(fs.existsSync(activated.finalRoot), false);
assert.equal(JSON.parse(fs.readFileSync(path.join(rolled.retainedRoot, 'profiles', activated.profileId, 'workspace.json'))).chats.main.draft, 'Adopted-only edit');
assert.deepEqual(fs.readFileSync(path.join(a.source, 'workspace.json')), originalWorkspace);
console.log('PASS complete shell/runtime candidate remaps owned references, preserves originals/identities and retains edited rollback');

for (const bad of ['existing', 'source-change', 'candidate-change', 'runtime-change', 'marker-change', 'missing-active', 'unfinished', 'unresolved', 'filename-prefix']) {
  const f = fixture(bad, bad === 'runtime-change'), h = f.api();
  if (bad === 'existing') { fs.mkdirSync(path.join(f.userData, 'profile-data')); await assert.rejects(h.prepare(), /never overwritten/); continue; }
  if (['unfinished', 'unresolved', 'filename-prefix'].includes(bad)) {
    const ws = JSON.parse(fs.readFileSync(path.join(f.source, 'workspace.json')));
    if (bad === 'unfinished') ws.chats.main.runId = 'stale-run'; else ws.chats.main.draftImages[0].path = path.join(f.source, bad === 'filename-prefix' ? 'attachments/picture.png-missing' : 'attachments/missing.png');
    fs.writeFileSync(path.join(f.source, 'workspace.json'), JSON.stringify(ws));
    await assert.rejects(h.prepare(), bad === 'unfinished' ? /unfinished run/ : /Unresolved owned/); continue;
  }
  const staged = await h.prepare(), journal = JSON.parse(fs.readFileSync(path.join(f.userData, 'legacy-adoption.json'))), candidate = path.join(f.userData, 'legacy-adoption-work', journal.operationId, 'candidate-registry');
  if (bad === 'source-change') fs.appendFileSync(path.join(f.source, 'documents/note.md'), 'source edit');
  if (bad === 'candidate-change') fs.appendFileSync(path.join(candidate, 'profiles', staged.profileId, 'documents/note.md'), 'bad change');
  if (bad === 'runtime-change') fs.appendFileSync(path.join(f.source, 'local-barkpark/default/pgdata/content'), 'later source DB edit');
  if (bad === 'marker-change') { const p = path.join(candidate, 'legacy-authority.json'), marker = JSON.parse(fs.readFileSync(p)); marker.finalRoot += '-foreign'; fs.writeFileSync(p, JSON.stringify(marker)); }
  if (bad === 'missing-active') { await h.recover({ action: 'activate' }); fs.renameSync(staged.finalRoot, staged.finalRoot + '-retained'); assert.equal(h.inspect().status, 'blocked'); await assert.rejects(h.prepare()); continue; }
  await assert.rejects(h.recover({ action: 'activate' })); assert.equal(fs.existsSync(staged.finalRoot), false);
}
console.log('PASS existing/changed/corrupt/missing authorities, unfinished runs and unresolved owned paths fail closed');

const own = fixture('ownership'); assert.throws(() => acquireAuthorityLease(own.userData), /owned/);
own.ownership.release(); await assert.rejects(own.api().prepare(), /released/);
const alias = path.join(root, 'linked-user-data'); fs.symlinkSync(own.userData, alias, 'junction'); assert.throws(() => acquireAuthorityLease(alias), /Linked/);
const relocatedDir = path.join(root, 'lease-original'), renamedDir = path.join(root, 'lease-renamed'); fs.mkdirSync(relocatedDir);
const lease = acquireFileLease(path.join(relocatedDir, 'owner.json')); lease.prepareRelocation(); fs.renameSync(relocatedDir, renamedDir); lease.relocated(path.join(renamedDir, 'owner.json')); lease.release();
assert.equal(fs.existsSync(path.join(renamedDir, 'owner.json')), false);
console.log('PASS userData ownership, stale token, junction refusal and verified lease relocation');

for (const phase of ['authority-prepared', 'shell-file-copied', 'authority-snapshotted', 'registry-registry-committed', 'authority-candidate', 'runtime-adoption-prepared', 'runtime-descriptor-committed', 'runtime-adoption-committed', 'reference-file-remapped', 'authority-ready', 'authority-activating', 'authority-renamed', 'authority-active', 'authority-rolling-back', 'authority-retired', 'authority-rolled-back']) {
  const f = fixture('exit-' + phase, phase.startsWith('runtime-')); f.ownership.release();
  const script = `const {acquireAuthorityLease,createLegacyAdoption}=require(${JSON.stringify(require.resolve('../main/legacy-authority-adoption'))});const userData=${JSON.stringify(f.userData)};const ownership=acquireAuthorityLease(userData);const api=createLegacyAdoption({userData,ownership,readSecrets:()=>({password:'fixture',token:'fixture'}),checkCold:async()=>{},checkpoint:p=>{if(p===${JSON.stringify(phase)})process.exit(73)}});(async()=>{await api.prepare();await api.recover({action:'activate'});await api.recover({action:'rollback'});ownership.release()})().catch(e=>{console.error(e);process.exit(1)});`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', windowsHide: true }); assert.equal(result.status, 73, phase + ': ' + result.stderr);
  f.ownership = acquireAuthorityLease(f.userData); const h = f.api(); let state = h.inspect(); assert.notEqual(state.status, 'blocked', state.error);
  if (phase.startsWith('authority-roll') || phase === 'authority-retired') { if (state.status !== 'rolled-back') state = await h.recover({ action: 'rollback' }); assert.equal(state.status, 'rolled-back'); }
  else { if (state.status === 'staged') state = await h.recover({ action: 'resume' }); if (state.status !== 'active') state = await h.recover({ action: 'activate' }); assert.equal(state.status, 'active'); assert.equal(createProfileRegistry(state.finalRoot).load().profiles.length, 1); }
}
console.log('PASS sixteen actual process exits across shell/runtime/reference/publication/rollback reconcile without duplicate profiles or empty seed');
for (const f of fixtures) f.ownership.release();
console.log('Retained fixtures:', root);
