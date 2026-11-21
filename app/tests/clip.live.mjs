// Save to notes (web clipper), in real Electron on the carried runtime against a local site: the browser bar's
// button saves the article as a Paper note in Pages, beside the page, with a source line and without the page's
// chrome or scripts; the context menu saves a selection; two quick presses make one note; a page still loading,
// a huge page and a profile without its library each answer clearly. Run: TMPDIR=/private/tmp/ heavy node tests/clip.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from './lib/playwright.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fixtureFolder } from './lib/fixture-folder.mjs';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { releaseOf } = require('../main/local-barkpark-source');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
if (!releaseOf(release)?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const out = process.env.BARKDOWN_CLIP_OUT || path.resolve('../docs/cycles/evidence/clip/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fixtureFolder('bd-clip-'));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['A local site stands in for real articles; one Mac, from source under Electron on the carried runtime.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

const article = `<!doctype html><title>Badgers at dusk</title><nav><a href="/">Home</a> <a href="/about">About this site</a></nav>
<div class="cookie-banner">We use cookies <button>Accept</button></div>
<article><h1>Badgers at dusk</h1><p id="lead">Badgers leave the sett <strong>after sunset</strong> and follow <a href="/paths">old paths</a>.</p>
<h2>What they eat</h2><ul><li>Earthworms</li><li>Beetles and grubs</li></ul><pre><code class="language-js">const sett = dig();</code></pre>
<img src="/badger.png" alt="A badger" onerror="window.top.__clipPwned = 1"><p><a href="javascript:window.top.__clipPwned=2">Hostile link</a></p>
<script>window.__pageRan = true; document.body.dataset.ran = 'yes';</script><p id="sel">Selected words about the night shift.</p></article>
<footer>Copyright footer text</footer>`;
const huge = `<title>Huge page</title><article>${Array.from({ length: 5000 }, (_, i) => `<p>Paragraph ${i} ${'badger '.repeat(40)}</p>`).join('')}</article>`;
let releaseSlow;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname === '/article') return res.end(article);
  if (url.pathname === '/huge') return res.end(huge);
  // A page that never finishes parsing until the test lets it: the document stays "loading".
  if (url.pathname === '/slow') { res.write('<title>Slow page</title><p>Still arriving…</p>' + ' '.repeat(4096)); releaseSlow = () => res.end('<p>Arrived.</p>'); return; }
  res.statusCode = 404; res.end('no');
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const site = `http://127.0.0.1:${server.address().port}`;

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Clip desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const errors = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const pane = () => page.locator('.bw-web-pane:visible').last();
const inSite = (code, gesture = false) => page.evaluate(([c, g]) => { const v = [...document.querySelectorAll('webview#view')].filter(w => w.getBoundingClientRect().width > 0).at(-1); return v.executeJavaScript(c, g); }, [code, gesture]);
const siteReady = async text => { for (let i = 0; i < 300; i++) { const t = await inSite('document.body && document.body.innerText').catch(() => ''); if (String(t).includes(text)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('site did not show: ' + text); };
const openWeb = async url => { await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'site' }), url); await pane().locator('webview#view').waitFor(); };
const notes = () => page.evaluate(async () => { await window.__barkdown.refreshLibrary(); return window.__barkdown.state.barkparkDocs.map(d => ({ id: d.id, title: d.title, paperOwner: d.paperOwner })); });
const toast = async text => { await page.locator('.bw-toast', { hasText: text }).last().waitFor({ timeout: 60000 }); return page.locator('.bw-toast', { hasText: text }).last().innerText(); };
const clearToasts = () => page.evaluate(() => document.querySelectorAll('.bw-toast').forEach(t => t.remove()));
const read = note => page.evaluate(n => window.barkdown.barkpark.get(n.id, undefined, n.paperOwner), note);
const text = paper => JSON.stringify(paper.blocks);
const activeTab = () => page.evaluate(() => { const s = window.__barkdown.state, chat = s.chats[s.current]; return chat.tabs.find(t => t.id === chat.active); });
const inPages = note => page.evaluate(n => { const p = window.__barkdown.state.pages; const keys = [...p.roots, ...Object.values(p.children).flat()]; return keys.some(k => k.endsWith(encodeURIComponent(n.id)) || k === 'bp:' + n.id); }, note);
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await new Promise(r => setTimeout(r, 200)); }

  // 1. The button saves the article.
  await openWeb(site + '/article'); await siteReady('night shift');
  const before = (await notes()).length;
  await shot('01-browser-bar');
  const webTab = await activeTab();
  await pane().locator('#clip').click();
  const saved = await toast('Saved to notes: Badgers at dusk');
  const after = await notes();
  assert.equal(after.length, before + 1);
  const note = after.find(n => n.title === 'Badgers at dusk');
  assert(note, 'the note carries the page title');
  const paper = await read(note), body = text(paper);
  for (const want of ['What they eat', 'Earthworms', 'after sunset', 'Source: ', `${site}/article`, `${site}/paths`, 'const sett = dig();', 'Image: A badger', 'Hostile link']) assert(body.includes(want), `note lacks ${want}: ${body.slice(0, 2000)}`);
  for (const gone of ['About this site', 'We use cookies', 'Accept', 'Copyright footer', '__pageRan', '__clipPwned', 'javascript:']) assert(!body.includes(gone), `note leaks ${gone}`);
  assert.equal(await page.evaluate(() => window.__clipPwned), undefined, 'nothing from the page ran in the app window');
  const tab = await activeTab();
  assert.equal(tab.type, 'doc'); assert.equal(tab.source, 'barkpark'); assert.equal(tab.path.at(-1), note.id);
  const chatTabs = await page.evaluate(() => { const s = window.__barkdown.state; return s.chats[s.current].tabs.map(t => t.id); });
  assert.equal(chatTabs.indexOf(tab.id), chatTabs.indexOf(webTab.id) + 1, 'the note opens beside the page');
  assert(await inPages(note), 'the note is placed in Pages');
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'What they eat' }).waitFor();
  await shot('02-saved-note');
  check('Save to notes saves the article: title, source line, headings, list, code, links absolute; no nav, cookie banner, footer or script; in Pages and open beside the page', { toast: saved, id: note.id });

  // 2. Two quick presses make one note.
  await clearToasts();
  await openWeb(site + '/article'); await siteReady('night shift');
  const n2 = (await notes()).length;
  await pane().locator('#clip').evaluate(b => { b.click(); b.click(); });
  await toast('Saved to notes');
  await new Promise(r => setTimeout(r, 1500));
  assert.equal((await notes()).length, n2 + 1);
  check('two quick presses make one note');

  // 3. The context menu saves the selection only.
  await clearToasts();
  await openWeb(site + '/article'); await siteReady('night shift');
  await inSite("(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#sel')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return 1; })()");
  const box = await inSite("(() => { const r = document.querySelector('#sel').getBoundingClientRect(); return { x: Math.round(r.left + 10), y: Math.round(r.top + 5) }; })()");
  await page.evaluate(({ x, y }) => { const v = [...document.querySelectorAll('webview#view')].filter(w => w.getBoundingClientRect().width > 0).at(-1); v.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 }); v.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 }); }, box);
  await page.locator('.bw-context-menu:not([hidden])').waitFor();
  const menuItems = await page.locator('.bw-context-menu:not([hidden]) button').allInnerTexts();
  assert(menuItems.includes('Save selection as a note') && menuItems.includes('Save page as a note'), menuItems.join(', '));
  await shot('03-context-menu');
  const n3 = (await notes()).length;
  await page.locator('.bw-context-menu:not([hidden]) button', { hasText: 'Save selection as a note' }).click();
  await toast('Saved to notes');
  const all3 = await notes(); assert.equal(all3.length, n3 + 1);
  const selTab = await activeTab(), selBody = text(await read({ id: selTab.path.at(-1), paperOwner: selTab.paperOwner }));
  assert(selBody.includes('Selected words about the night shift.') && selBody.includes('Source: '), selBody);
  assert(!selBody.includes('What they eat') && !selBody.includes('Earthworms'), 'only the selection is kept');
  check('the context menu offers Save selection / Save page; a selection keeps only the selected words and the source line', { menuItems });

  // 4. A page still loading: a clear message and no note.
  await clearToasts();
  const n4 = (await notes()).length;
  await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'slow' }), site + '/slow');
  await pane().locator('webview#view').waitFor();
  for (let i = 0; i < 100 && !releaseSlow; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 500));
  await pane().locator('#clip').click();
  const loading = await toast('load');
  assert.equal((await notes()).length, n4);
  await shot('04-still-loading');
  releaseSlow?.();
  check('a page still loading answers clearly and saves nothing', { toast: loading });

  // 5. A huge page is capped, and the note says so.
  await clearToasts();
  await openWeb(site + '/huge'); await siteReady('Paragraph 4999');
  await pane().locator('#clip').click();
  await toast('Saved to notes: Huge page');
  const hugeTab = await activeTab(), hugePaper = await read({ id: hugeTab.path.at(-1), paperOwner: hugeTab.paperOwner });
  assert(text(hugePaper).includes('Clipped: this note keeps the first part of the page'));
  assert(!text(hugePaper).includes('Paragraph 4999'));
  check('a huge page is capped and the note says where the rest is', { blocks: hugePaper.blocks.length });

  // 6. Without the profile's library: a clear message, nothing saved.
  await clearToasts();
  await openWeb(site + '/article'); await siteReady('night shift');
  const n6 = (await notes()).length;
  await page.evaluate(() => { window.__barkdown.state.settings.barkpark.local.enabled = false; });
  await pane().locator('#clip').click();
  const noLibrary = await toast('local library');
  await page.evaluate(() => { window.__barkdown.state.settings.barkpark.local.enabled = true; });
  assert.equal((await notes()).length, n6);
  check('without the local library the button says so and saves nothing', { toast: noLibrary });

  // 7. A profile switch while a save is in flight: nothing lands in the other profile's Pages; back in the first
  // profile the press made at most one note, and a kept request is retried from Pages without a second note.
  await clearToasts();
  const profileA = await page.evaluate(() => window.__barkdown.state.profileId);
  const profileB = (await page.evaluate(() => window.barkdown.profiles.create('Other desk'))).id;
  await openWeb(site + '/huge'); await siteReady('Paragraph 4999');
  const n7 = (await notes()).length;
  const switchTo = async id => {
    await page.locator('#bw-prompt').focus(); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,'); await page.locator('#profile-choice').selectOption(id); await page.locator('#profile-switch').click();
    await page.waitForFunction(id => window.__barkdown?.state.profileId === id && window.__barkdown?.state.loaded, id, { timeout: 180000 });
  };
  await pane().locator('#clip').click();
  await switchTo(profileB);
  await new Promise(r => setTimeout(r, 3000));
  const pagesB = await page.evaluate(() => { const p = window.__barkdown.state.pages || {}; return { keys: [...(p.roots || []), ...Object.values(p.children || {}).flat()], clip: Boolean(p.clipCreation) }; });
  assert(!pagesB.clip && !pagesB.keys.some(k => String(k).startsWith('bp:')), 'nothing from the save lands in the other profile: ' + JSON.stringify(pagesB));
  await shot('05-other-profile');
  await switchTo(profileA);
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; await new Promise(r => setTimeout(r, 200)); }
  const kept = await page.evaluate(() => Boolean(window.__barkdown.state.pages?.clipCreation));
  if (kept) {
    await page.locator('#bw-clip-retry').waitFor(); await shot('06-not-confirmed');
    await page.locator('#bw-clip-retry').click(); await toast('Saved the earlier clip to notes: Huge page');
  }
  const after7 = await notes();
  assert(after7.length - n7 <= 1, `one press, at most one note (${after7.length - n7})`);
  check('a profile switch during a save puts nothing in the other profile; the first profile keeps at most one note, retried from Pages when unconfirmed', { keptAndRetried: kept, newNotes: after7.length - n7 });

  assert.deepEqual(errors, []);
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ status: report.status, out }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1;
  if (page) await shot('failure').catch(() => {});
} finally { releaseSlow?.(); if (app) await app.close().catch(() => {}); server.close(); fs.rmSync(userData, { recursive: true, force: true }); }
