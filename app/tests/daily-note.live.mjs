// Daily notes, in real Electron on the carried runtime: quick open › Today's note makes one note titled with
// today's date under a "Daily notes" page and opens it, twice and three fast shortcut presses later still one;
// the path bar's Previous day shows a missing day and Create makes it; a renamed Daily notes page is reused;
// a deleted day note gets a new one (the old one stays in Deleted notes); a profile switch while main holds a
// create's answer puts nothing in the other profile, and back home the kept request settles as that one note. Run: TMPDIR=/private/tmp/ heavy node tests/daily-note.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { releaseOf } = require('../main/local-barkpark-source');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
if (!releaseOf(release)?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const out = process.env.BARKDOWN_DAILY_OUT || path.resolve('../docs/cycles/evidence/daily-note/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-daily-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One Mac, from source under Electron on the carried runtime; the date is the machine’s local date during the run.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Daily desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const errors = [];
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const notes = () => page.evaluate(async () => { await window.__barkdown.refreshLibrary(); return window.__barkdown.state.barkparkDocs.map(d => ({ id: d.id, title: d.title, paperOwner: d.paperOwner })); });
const titled = async title => (await notes()).filter(n => n.title === title);
const daily = () => page.evaluate(() => structuredClone(window.__barkdown.state.pages?.daily || null));
const tree = () => page.evaluate(() => structuredClone(window.__barkdown.state.pages));
const activeDoc = () => page.evaluate(() => { const s = window.__barkdown.state, chat = s.mode === 'document' ? s.chats.direct : s.chats[s.current]; const t = chat?.tabs.find(x => x.id === chat.active); return t ? { id: t.path.at(-1), source: t.source } : null; });
const waitActive = async id => { for (let i = 0; i < 300; i++) { if ((await activeDoc())?.id === id) return; await sleep(100); } throw new Error('the note did not open: ' + id + ' (active ' + JSON.stringify(await activeDoc()) + ')'); };
const pane = () => page.locator('.bw-paper-pane:visible').last();
const quickOpen = async (query, label) => {
  await page.locator('#bw-prompt').focus(); await page.keyboard.press(MOD + '+k');
  await page.locator('#bw-palette-input').fill(query);
  await page.locator('#bw-palette-list [data-palette]', { hasText: label }).first().waitFor();
  await page.keyboard.press('Enter');
};
const settle = async (title, count = 1) => { for (let i = 0; i < 300; i++) { const found = await titled(title); if (found.length >= count && !(await daily())?.creation) return found; await sleep(200); } throw new Error('no settled note titled ' + title); };
const waitReady = async () => { for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') return; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await sleep(200); } throw new Error('runtime not ready'); };
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  await waitReady();
  const today = await page.evaluate(() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });
  const title = (await page.evaluate(day => { const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d, 12)); return [new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(t), new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(t.getTime() - 864e5)), new Date(t.getTime() - 864e5).toISOString().slice(0, 10)]; }, today));
  const [todayTitle, yesterdayTitle, yesterday] = title;
  const before = (await notes()).length;

  // 1. Quick open › Today's note: one Daily notes page, one day note under it, opened.
  await quickOpen('today', 'Today’s note');
  const [first] = await settle(todayTitle);
  await waitActive(first.id);
  const d1 = await daily(), t1 = await tree();
  assert.equal((await titled('Daily notes')).length, 1, 'one Daily notes page');
  assert(t1.roots.includes(d1.parent), 'Daily notes sits in Pages');
  assert.deepEqual(t1.children[d1.parent], [d1.days[today]], 'today under Daily notes');
  assert(d1.days[today].endsWith(encodeURIComponent(first.id)));
  await pane().locator('.ProseMirror').waitFor();
  await pane().locator('.ProseMirror h1', { hasText: todayTitle }).waitFor();
  await page.locator('#bw-today-note').waitFor();
  await shot('01-today');
  check('quick open › Today’s note makes today’s note under a Daily notes page and opens it', { title: todayTitle, made: (await notes()).length - before });

  // 2. Again from quick open, then the shortcut three times fast: still one note, open each time.
  await page.evaluate(() => { const s = window.__barkdown.state; s.chats[s.current].tabs = []; s.chats[s.current].active = null; window.__barkdown.render(); });
  await quickOpen('today', 'Today’s note');
  await waitActive(first.id);
  await page.locator('#bw-prompt').focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press(MOD + '+Shift+D');
  await sleep(3000);
  assert.equal((await titled(todayTitle)).length, 1, 'still one note for today');
  assert.equal((await titled('Daily notes')).length, 1);
  await waitActive(first.id);
  check('Today’s note again and the shortcut pressed three times fast open the same note; no second note');

  // 3. Previous day: a missing day says so; Create makes it under Daily notes after today; Next day returns.
  await pane().locator('.bw-daily-nav').waitFor();
  await pane().getByRole('button', { name: '‹ Previous day' }).click();
  await pane().locator('.bw-daily-missing', { hasText: `No note for ${yesterdayTitle}` }).waitFor();
  assert.equal((await titled(yesterdayTitle)).length, 0, 'browsing a past day makes nothing');
  await shot('02-missing-day');
  await pane().getByRole('button', { name: 'Create', exact: true }).click();
  const [past] = await settle(yesterdayTitle);
  await waitActive(past.id);
  const d3 = await daily(), t3 = await tree();
  assert.deepEqual(t3.children[d3.parent], [d3.days[today], d3.days[yesterday]], 'newest first');
  await pane().locator('.ProseMirror h1', { hasText: yesterdayTitle }).waitFor();
  await shot('03-yesterday');
  await pane().getByRole('button', { name: 'Next day ›' }).click();
  await waitActive(first.id);
  check('Previous day shows “No note for …” and creates nothing until Create; Create makes it in date order; Next day opens today', { yesterday: yesterdayTitle });

  // 4. Rename Daily notes, then press: the renamed page is reused.
  const parent = (await titled('Daily notes'))[0];
  // A local note's title is its first heading: rename it the way a person does, in the editor.
  await page.evaluate(p => window.__barkdown.openTarget({ kind: 'doc', id: p.id, source: 'barkpark', paperOwner: p.paperOwner }), parent);
  await waitActive(parent.id);
  await pane().locator('.ProseMirror h1', { hasText: 'Daily notes' }).click();
  await page.keyboard.press('End'); for (let i = 0; i < 'Daily notes'.length; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('My journal');
  for (let i = 0; i < 300 && !(await titled('My journal')).length; i++) await sleep(200);
  assert.equal((await titled('My journal')).length, 1, 'the page was renamed');
  await page.locator('#bw-prompt').focus();
  await page.keyboard.press(MOD + '+Shift+D'); await sleep(2500);
  await waitActive(first.id);
  assert.equal((await titled('Daily notes')).length, 0); assert.equal((await titled(todayTitle)).length, 1);
  assert.equal((await daily()).parent, d1.parent);
  check('after renaming Daily notes the press reuses it: no new parent, no new day');

  // 5. Delete today's note, press again: a new note; the old one is in Deleted notes.
  await waitActive(first.id);
  await pane().getByRole('button', { name: 'Delete note', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete note', exact: true }).click();
  await page.locator('p:visible', { hasText: 'This note was deleted.' }).first().waitFor();
  await page.locator('#bw-prompt').focus(); await page.keyboard.press(MOD + '+Shift+D');
  let second;
  for (let i = 0; i < 300 && !second; i++) { second = (await titled(todayTitle)).find(n => n.id !== first.id); if (!second) await sleep(200); }
  assert(second, 'a new note for today'); await waitActive(second.id);
  await page.locator('#bw-deleted-notes').click();
  await page.getByRole('dialog', { name: 'Deleted notes' }).getByText(todayTitle, { exact: true }).waitFor();
  await shot('04-deleted-and-new');
  await page.keyboard.press('Escape');
  check('a deleted day note is replaced by a new one on the next press; the deleted one stays in Deleted notes');

  // 6. A profile switch mid-create: nothing lands in the other profile; back home, exactly one note for the day.
  const profileA = await page.evaluate(() => window.__barkdown.state.profileId);
  const profileB = (await page.evaluate(() => window.barkdown.profiles.create('Other desk'))).id;
  const tomorrowTitle = await page.evaluate(day => { const [y, m, d] = day.split('-').map(Number); return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d + 1, 12))); }, today);
  const switchTo = async id => {
    await page.locator('#bw-prompt').focus(); await page.keyboard.press(MOD + '+,'); await page.locator('#profile-choice').selectOption(id); await page.locator('#profile-switch').click();
    await page.waitForFunction(id => window.__barkdown?.state.profileId === id && window.__barkdown?.state.loaded, id, { timeout: 180000 });
  };
  // Force the kept path: main commits tomorrow's note but holds its answer, and the switch lands meanwhile, so the
  // first profile keeps the request unconfirmed. (Test-only: wraps main's IPC handler, then puts it back.)
  const hooked = await app.evaluate(({ ipcMain }) => { const m = ipcMain._invokeHandlers, orig = m?.get?.('barkpark:createNoteWith'); if (!orig) return false;
    globalThis.__dailyHold = { orig, done: 0 }; m.set('barkpark:createNoteWith', async (...a) => { const r = await orig(...a); globalThis.__dailyHold.done++; await new Promise(res => setTimeout(res, 8000)); return r; }); return true; });
  assert(hooked, 'could not hold main’s create answer');
  await pane().getByRole('button', { name: 'Next day ›' }).click();
  await pane().locator('.bw-daily-missing', { hasText: `No note for ${tomorrowTitle}` }).waitFor();
  await pane().getByRole('button', { name: 'Create', exact: true }).click();
  for (let i = 0; i < 300 && !(await app.evaluate(() => globalThis.__dailyHold.done)); i++) await sleep(100);
  assert.equal(await app.evaluate(() => globalThis.__dailyHold.done), 1, 'main made tomorrow’s note before the switch');
  const request = (await daily())?.creation;
  assert.equal(request?.kind, 'day', 'the request is saved before main answers');
  await switchTo(profileB);
  await app.evaluate(({ ipcMain }) => ipcMain._invokeHandlers.set('barkpark:createNoteWith', globalThis.__dailyHold.orig));
  await sleep(3000);
  const pagesB = await tree();
  assert(!pagesB?.daily && !(pagesB?.roots || []).some(k => String(k).startsWith('bp:')), 'nothing lands in the other profile: ' + JSON.stringify(pagesB));
  await shot('05-other-profile');
  await switchTo(profileA); await waitReady();
  const kept = (await daily())?.creation;
  assert.equal(kept?.requestId, request.requestId, 'the first profile kept the unconfirmed request');
  await page.locator('#bw-prompt').focus(); await page.keyboard.press(MOD + '+Shift+D');
  for (let i = 0; i < 300 && (await daily())?.creation; i++) await sleep(200);
  await waitActive(second.id);
  const tomorrow = await titled(tomorrowTitle), after = await daily();
  assert.deepEqual(tomorrow.map(n => n.id), ['drafts.bd-note-' + request.requestId], 'one note for tomorrow: the one main made for the kept request');
  assert(after.days[request.date].endsWith(encodeURIComponent(tomorrow[0].id)) && !after.creation, 'mapped, nothing kept');
  const rowKey = after.days[request.date], t6 = await tree();
  assert((t6.children[after.parent] || []).includes(rowKey), 'placed under Daily notes: ' + JSON.stringify(t6.children[after.parent]));
  await page.locator(`#bw-pages [data-open="${rowKey}"]`).waitFor({ state: 'visible' });
  assert.equal((await titled('Daily notes')).length + (await titled('My journal')).length, 1, 'still one Daily notes page');
  assert.deepEqual((await titled(todayTitle)).map(n => n.id), [second.id], 'today keeps one listed note');
  check('a profile switch while main holds the answer puts nothing in the other profile; back home the kept request settles as the one note main made', { request: request.requestId });

  assert.deepEqual(errors, []);
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ status: report.status, out }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1;
  if (page) await shot('failure').catch(() => {});
} finally { if (app) await app.close().catch(() => {}); fs.rmSync(userData, { recursive: true, force: true }); }
