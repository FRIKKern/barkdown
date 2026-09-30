// Profiles are the ordinary launch (legacy retirement R2). Real Electron, no flags.
// 1) Fresh user data: the app opens a profile without being asked.
// 2) User data holding a legacy library and no profiles: the adoption window offers to move it
//    into a profile; "Adopt" does so and the notes, chats and settings arrive; the legacy files stay.
// 3) The same, choosing "Not now": an empty profile opens, the legacy library is untouched, and
//    the next launch offers again. `--legacy` still opens the single legacy library for tours.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C087/live', new Date().toISOString().replace(/[:.]/g, '-') + '-launch-default');
fs.mkdirSync(out, { recursive: true });
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-launch-default-')));
const report = { source: host, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One machine, one run. The legacy library is a small fixture without a runtime; adoption of a library with a managed runtime is covered by the runtime adoption tour. No provider is signed in.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const legacyLibrary = dir => {
  const legacy = path.join(dir, 'barkdown'); fs.mkdirSync(path.join(legacy, 'documents'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'settings.json'), JSON.stringify({ provider: 'api', chatWidth: 47, barkpark: { enabled: false } }));
  fs.writeFileSync(path.join(legacy, 'documents', 'old-note.json'), JSON.stringify({ id: 'old-note', title: 'Old note', rev: 1, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Written before profiles existed.' }] }] } }));
  fs.writeFileSync(path.join(legacy, 'workspace.json'), JSON.stringify({ version: 1, current: 'main', order: ['main'], chats: { main: { id: 'main', title: 'Old conversation', messages: [], events: [], apiHistory: [], tabs: [], draft: 'An old unsent thought' } }, pages: { roots: ['old-note'], children: {}, expanded: {} }, favorites: [] }));
  return legacy;
};
const launch = (dir, flags = []) => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${dir}`, ...flags], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const quit = async app => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
let app;
try {
  // 1) Fresh.
  const fresh = path.join(root, 'fresh'); fs.mkdirSync(fresh);
  app = await launch(fresh); let page = await app.firstWindow({ timeout: 120000 });
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const status = await page.evaluate(() => window.barkdown.profiles.status());
  assert.equal(status.enabled, true); assert.equal(status.profiles.length, 1); assert.equal(status.profiles[0].name, 'Personal');
  assert.ok(fs.existsSync(path.join(fresh, 'profile-data', 'registry.json')));
  await page.screenshot({ path: path.join(out, '01-fresh-launch-opens-a-profile.png') }); report.screenshots.push('01-fresh-launch-opens-a-profile.png');
  await quit(app);
  report.checks.push({ name: 'A fresh launch with no flags opens profiles with one profile, Personal' }); persist();

  // 2) A legacy library: adopt.
  const adopt = path.join(root, 'adopt'); fs.mkdirSync(adopt); const legacy = legacyLibrary(adopt);
  const before = { workspace: fs.readFileSync(path.join(legacy, 'workspace.json'), 'utf8'), note: fs.readFileSync(path.join(legacy, 'documents', 'old-note.json'), 'utf8') };
  app = await launch(adopt); const offer = await app.firstWindow({ timeout: 120000 });
  await offer.getByRole('button', { name: 'Adopt existing library' }).waitFor({ timeout: 30000 });
  await offer.getByRole('button', { name: 'Not now, start empty' }).waitFor();
  assert.ok(!fs.existsSync(path.join(adopt, 'profile-data')), 'nothing is created before the choice');
  await offer.screenshot({ path: path.join(out, '02-legacy-library-offered-for-adoption.png') }); report.screenshots.push('02-legacy-library-offered-for-adoption.png');
  const opened = app.waitForEvent('window');
  await offer.getByRole('button', { name: 'Adopt existing library' }).click();
  page = await opened; await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 120000 });
  const adopted = await page.evaluate(async () => ({ owner: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load(), settings: await window.barkdown.settings.get(), docs: await window.barkdown.docs.list() }));
  assert.equal(adopted.owner.enabled, true); assert.equal(adopted.owner.profiles.length, 1);
  assert.equal(adopted.ws.chats.main.draft, 'An old unsent thought'); assert.equal(adopted.settings.chatWidth, 47);
  assert.ok(adopted.docs.some(d => d.id === 'old-note'), 'the old note arrived');
  assert.equal(fs.readFileSync(path.join(legacy, 'workspace.json'), 'utf8'), before.workspace); assert.equal(fs.readFileSync(path.join(legacy, 'documents', 'old-note.json'), 'utf8'), before.note);
  await page.screenshot({ path: path.join(out, '03-adopted-into-a-profile.png') }); report.screenshots.push('03-adopted-into-a-profile.png');
  await quit(app);
  app = await launch(adopt); page = await app.firstWindow({ timeout: 120000 }); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).enabled, true, 'the next launch opens the adopted profile without asking');
  await quit(app);
  report.checks.push({ name: 'A legacy library found at an ordinary launch is offered for adoption; Adopt moves notes, chats and settings into a profile, leaves the legacy files, and later launches open the profile' }); persist();

  // 3) Not now.
  const later = path.join(root, 'later'); fs.mkdirSync(later); const legacyLater = legacyLibrary(later);
  const untouched = fs.readFileSync(path.join(legacyLater, 'workspace.json'), 'utf8');
  app = await launch(later); const offer2 = await app.firstWindow({ timeout: 120000 });
  await offer2.getByRole('button', { name: 'Not now, start empty' }).waitFor({ timeout: 30000 });
  const opened2 = app.waitForEvent('window');
  await offer2.getByRole('button', { name: 'Not now, start empty' }).click();
  page = await opened2; await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 120000 });
  const empty = await page.evaluate(async () => ({ owner: await window.barkdown.profiles.status(), docs: await window.barkdown.docs.list() }));
  assert.equal(empty.owner.profiles[0].name, 'Personal'); assert.equal(empty.docs.length, 0, 'an empty profile');
  assert.equal(fs.readFileSync(path.join(legacyLater, 'workspace.json'), 'utf8'), untouched);
  await quit(app);
  app = await launch(later); const offer3 = await app.firstWindow({ timeout: 120000 });
  const askedAgain = await offer3.getByRole('button', { name: 'Adopt existing library' }).isVisible({ timeout: 30000 }).catch(() => false);
  report.observed = { offeredAgainAfterNotNow: askedAgain };
  await quit(app);
  report.checks.push({ name: 'Not now opens an empty profile and leaves the legacy library untouched', offeredAgain: askedAgain }); persist();

  // 4) --legacy.
  app = await launch(later, ['--legacy']); page = await app.firstWindow({ timeout: 120000 }); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const legacyMode = await page.evaluate(async () => ({ owner: await window.barkdown.profiles.status(), docs: await window.barkdown.docs.list() }));
  assert.equal(legacyMode.owner.enabled, false); assert.ok(legacyMode.docs.some(d => d.id === 'old-note'));
  await quit(app);
  report.checks.push({ name: 'A --legacy launch still opens the single legacy library, for the development tours' }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); persist();
  try { await quit(app); } catch {}
  throw error;
}
