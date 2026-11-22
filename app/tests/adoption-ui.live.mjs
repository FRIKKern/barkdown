import { _electron as electron } from './lib/playwright.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
// The legacy settings below route through the Barkpark CLI; this suite starts no Barkpark, so the app's CLI reaches nothing.
import { unreachableBarkpark } from './lib/bp-runner.mjs';
import { fixtureFolder } from './lib/fixture-folder.mjs';
const require = createRequire(import.meta.url);
const root = fixtureFolder('bd-adoption-ui-');
const userData = path.join(root, 'adopt'), legacy = path.join(userData, 'barkdown');
fs.mkdirSync(path.join(legacy, 'attachments'), { recursive: true });
fs.writeFileSync(path.join(legacy, 'attachments', 'note.txt'), 'Retained attachment');
fs.writeFileSync(path.join(legacy, 'settings.json'), JSON.stringify({ provider: 'api', chatWidth: 43, barkpark: { enabled: true, viaCli: true } }));
const ws = { version: 1, current: 'parent', order: ['parent', 'side'], chats: {
  parent: { id: 'parent', title: 'Retained parent', messages: [], events: [], apiHistory: [], following: true, tabs: [], draft: 'Unsent parent', images: [path.join(legacy, 'attachments', 'note.txt')] },
  side: { id: 'side', title: 'Retained side', parent: 'parent', side: true, messages: [], events: [], apiHistory: [], following: true, tabs: [], draft: 'Unsent side' },
} };
fs.writeFileSync(path.join(legacy, 'workspace.json'), JSON.stringify(ws));
const original = fs.readFileSync(path.join(legacy, 'workspace.json'), 'utf8');
const launch = (dir, flags = []) => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${dir}`, ...flags], env: unreachableBarkpark({ ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' }) });
let app;
try {
  app = await launch(userData, ['--adopt-legacy']);
  const recovery = await app.firstWindow();
  await recovery.getByRole('button', { name: 'Adopt existing library' }).waitFor();
  assert(!fs.existsSync(path.join(userData, 'profile-data')), 'confirmation precedes profile creation');
  const newWindow = app.waitForEvent('window');
  await recovery.getByRole('button', { name: 'Adopt existing library' }).click();
  let page = await newWindow;
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const first = await page.evaluate(async () => ({ owner: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load(), settings: await window.barkdown.settings.get() }));
  assert(first.owner.enabled); assert.equal(first.owner.profiles.length, 1);
  assert.equal(first.ws.chats.side.parent, 'parent'); assert.equal(first.ws.chats.parent.draft, 'Unsent parent');
  assert.equal(first.settings.chatWidth, 43);
  assert.match(await page.evaluate(async () => { try { await window.barkdown.barkpark.list(); return 'unexpected success'; } catch (error) { return error.message; } }), /direct server connection in Settings/);
  await page.evaluate(() => window.barkdown.settings.set({ barkpark: { enabled: false, viaCli: false } }));
  assert(first.ws.chats.parent.images[0].includes(first.owner.profileId));
  assert(fs.existsSync(first.ws.chats.parent.images[0]));
  assert.equal(fs.readFileSync(path.join(legacy, 'workspace.json'), 'utf8'), original);
  const ownerBefore = fs.readFileSync(path.join(userData, 'workspace-owner.json'), 'utf8');
  const secondEnv = { ...process.env }; delete secondEnv.ELECTRON_RUN_AS_NODE;
  const duplicate = spawn(require('electron'), [path.resolve('.'), `--user-data=${userData}`, '--adopt-legacy'], { env: secondEnv, stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { duplicate.kill(); reject(new Error('Second instance did not exit')); }, 10000);
    duplicate.once('error', error => { clearTimeout(timer); reject(error); });
    duplicate.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Second instance exit ${code}`)); });
  });
  assert.equal(fs.readFileSync(path.join(userData, 'workspace-owner.json'), 'utf8'), ownerBefore, 'duplicate process cannot replace authority');
  await app.close(); app = null;
  for (const flags of [[], ['--adopt-legacy']]) {
    app = await launch(userData, flags); page = await app.firstWindow();
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    const status = await page.evaluate(() => window.barkdown.profiles.status());
    assert.equal(status.profileId, first.owner.profileId); assert.equal(status.profiles.length, 1);
    await app.close(); app = null;
  }
  app = await launch(userData, ['--rollback-adoption']);
  page = await app.firstWindow();
  await page.getByRole('button', { name: 'Restore legacy authority' }).waitFor();
  const legacyWindow = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Restore legacy authority' }).click();
  page = await legacyWindow; await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).enabled, false);
  assert.equal((await page.evaluate(() => window.barkdown.state.load())).chats.side.parent, 'parent');
  await app.close(); app = null;
  const { acquireAuthorityLease, createLegacyAdoption } = require('../main/legacy-authority-adoption');
  const interrupted = path.join(root, 'interrupted');
  fs.mkdirSync(path.join(interrupted, 'barkdown'), { recursive: true });
  fs.writeFileSync(path.join(interrupted, 'barkdown', 'workspace.json'), JSON.stringify({ ...ws, chats: { ...ws.chats, parent: { ...ws.chats.parent, images: [] } } }));
  const ownership = acquireAuthorityLease(interrupted);
  try {
    await assert.rejects(createLegacyAdoption({ userData: interrupted, ownership, checkpoint: phase => { if (phase === 'authority-prepared') throw new Error('fixture interruption'); } }).prepare(), /fixture interruption/);
  } finally { ownership.release(); }
  app = await launch(interrupted, ['--profiles']); page = await app.firstWindow();
  await page.getByRole('button', { name: 'Resume preparation' }).waitFor();
  assert(!fs.existsSync(path.join(interrupted, 'profile-data')), 'interrupted boot cannot seed Personal');
  await page.getByRole('button', { name: 'Resume preparation' }).click();
  await page.getByRole('button', { name: 'Use verified profile' }).waitFor();
  const resumedWindow = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Use verified profile' }).click();
  page = await resumedWindow; await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal((await page.evaluate(() => window.barkdown.state.load())).chats.parent.draft, 'Unsent parent');
  await app.close(); app = null;
  const corrupt = path.join(root, 'corrupt'); fs.mkdirSync(corrupt);
  fs.writeFileSync(path.join(corrupt, 'legacy-adoption.json'), '{broken');
  app = await launch(corrupt, ['--profiles']); page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Library recovery' }).waitFor();
  await page.getByRole('button', { name: 'Show library folder' }).waitFor();
  assert.equal(await page.locator('button').count(), 2);
  assert(!fs.existsSync(path.join(corrupt, 'profile-data'))); assert(!fs.existsSync(path.join(corrupt, 'barkdown')));
  const quit = app.waitForEvent('close'); await page.getByRole('button', { name: 'Quit' }).click(); await quit; app = null;
  console.log('PASS explicit adoption, parent/draft/attachment preservation, saved width, restart without flags, repeated adoption, explicit offline rollback');
  console.log('PASS interrupted startup offers resume/activation without seeding; corrupt receipt refuses every library writer');
  if (process.platform === 'darwin') {
    const profile = path.join(root, 'prior-device');
    const { createProfileRegistry } = require('../main/profile-registry');
    const { createStore } = require('../main/store');
    const { controller } = require('../main/writer-admission');
    const registry = createProfileRegistry(path.join(profile, 'profile-data'));
    function seedPriorDevice(name, draft) {
      const { id } = registry.createProfile({ name });
      const store = createStore(registry.storeFor(id).storeDir, { create: false });
      const control = controller(store), token = control.capture();
      control.run(token, 'test.initialize', () => {
        store.writeJson('workspace.json', { ...ws, chats: { parent: { ...ws.chats.parent, images: [] }, side: { ...ws.chats.side, draft } } });
      });
      const saved = store.readJson('writer-identity.json');
      assert(saved.mac?.uuid, 'the fixture must use an APFS volume with a native UUID');
      const canonical = fs.realpathSync.native(store.dir());
      const { dev, ino } = fs.statSync(canonical, { bigint: true });
      saved.mac.device = String(dev + 1n);
      saved.rootHash = createHash('sha256').update(JSON.stringify([canonical, saved.mac.device, String(ino)])).digest('hex');
      store.writeJson('writer-identity.json', saved);
      return { id, store, control, token, prior: fs.readFileSync(store.filePath('writer-identity.json'), 'utf8') };
    }
    const { id, store, control, token, prior } = seedPriorDevice('Recovery fixture', 'Unsent side');
    const second = seedPriorDevice('Second recovery fixture', 'Second profile draft');

    app = await launch(profile); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Repair and open library' }).waitFor();
    assert.equal(fs.readFileSync(store.filePath('writer-identity.json'), 'utf8'), prior);
    assert(!fs.existsSync(store.filePath('writer-recovery')));
    const workspace = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Repair and open library' }).click();
    page = await workspace;
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, id);
    assert.equal((await page.evaluate(() => window.barkdown.state.load())).chats.side.draft, 'Unsent side');
    assert.deepEqual(control.capture(), token);
    const backups = store.list('writer-recovery', '.json');
    assert.equal(backups.length, 1);
    assert.equal(store.readJson(backups[0]).identity, prior);
    await app.close(); app = null;

    app = await launch(profile); page = await app.firstWindow();
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, id);
    assert.deepEqual(store.list('writer-recovery', '.json'), backups);

    const switchProfile = async choice => {
      const nextWindow = app.waitForEvent('window');
      const result = page.evaluate(id => window.barkdown.profiles.select(id).then(() => true, () => false), second.id);
      const repairWindow = await nextWindow;
      await repairWindow.getByRole('heading', { name: 'Repair this library' }).waitFor();
      await repairWindow.getByRole('button', { name: choice }).click();
      return result;
    };
    assert.equal(await switchProfile('Keep current library'), false);
    assert.equal(registry.load().selectedProfileId, id);
    assert.equal(fs.readFileSync(second.store.filePath('writer-identity.json'), 'utf8'), second.prior);
    assert.equal(await switchProfile('Repair and open library'), true);
    await page.reload();
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, second.id);
    assert.equal((await page.evaluate(() => window.barkdown.state.load())).chats.side.draft, 'Second profile draft');
    assert.deepEqual(second.control.capture(), second.token);
    await app.close(); app = null;
    console.log('PASS the native APFS witness offers repair for a simulated prior device at startup and profile switch, preserving drafts and ownership');
  }
} finally { if (app) await app.close(); }
