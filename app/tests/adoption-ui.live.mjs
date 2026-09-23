import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-adoption-ui-'));
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
const launch = (dir, flags = []) => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${dir}`, ...flags], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
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
  assert.equal(await page.locator('button').count(), 1);
  assert(!fs.existsSync(path.join(corrupt, 'profile-data'))); assert(!fs.existsSync(path.join(corrupt, 'barkdown')));
  const quit = app.waitForEvent('close'); await page.getByRole('button', { name: 'Quit' }).click(); await quit; app = null;
  console.log('PASS explicit adoption, parent/draft/attachment preservation, saved width, restart without flags, repeated adoption, explicit offline rollback');
  console.log('PASS interrupted startup offers resume/activation without seeding; corrupt receipt refuses every library writer');
} finally { if (app) await app.close(); }
