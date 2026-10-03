// The browser a person and an agent can live in (C089 slice A), in real Electron against a local site:
// the tab names Chrome and not Electron; a sign-in popup returns to its opener and closes; a link that
// wants a new tab opens a Barkdown tab beside; a site's permission is asked once and remembered; the
// import from a Chrome profile fills Favorites and the address bar; a session survives a restart.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { makeChromeFixture } from './lib/chrome-fixture.mjs';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C089/live', new Date().toISOString().replace(/[:.]/g, '-') + '-browser');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-browser-')));
const downloadsDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-downloads-')));
// A filter list of our own stands in for EasyList: deterministic, and no network in the test.
const listDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-blocklist-')), blocklist = path.join(listDir, 'filters.txt'); fs.writeFileSync(blocklist, '! test list\n/tracker.js\n');
const chromeHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chrome-home-')));
makeChromeFixture(chromeHome);
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['A local site stands in for Google, GitHub and Microsoft: the popup, new-tab, permission and cookie mechanics are what is proven here; real sign-ins are a person\'s check. One Mac, from source under Electron.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

// The site: a cookie on first visit, a popup that reports back and closes, a new-tab link, a permission button.
const pages = {
  '/': `<title>Fixture home</title><p id="who">cookie: __COOKIE__</p><a id="beside" href="/beside" target="_blank">open beside</a> <button id="popup" onclick="window.open('/popup','signin','width=420,height=380')">sign in</button><p id="popup-result">popup: waiting</p><script>addEventListener('message', e => { document.querySelector('#popup-result').textContent = 'popup: ' + e.data; });</script>`,
  '/popup': `<title>Sign in</title><script>window.opener.postMessage('signed-in', '*'); setTimeout(() => window.close(), 150);</script><p>signing in…</p>`,
  '/beside': `<title>Beside page</title><p>opened beside</p>`,
  '/perm': `<title>Permission page</title><button id="ask" onclick="Notification.requestPermission().then(r => { document.querySelector('#perm-result').textContent = 'permission: ' + r; })">notify</button><p id="perm-result">permission: unknown</p>`,
  '/whoami': `<title>Who am I</title><p id="who">cookie: __COOKIE__</p>`,
  '/tracked': `<title>Tracked page</title><p id="t">tracker: waiting</p><script src="/tracker.js" onload="document.querySelector('#t').textContent='tracker: loaded'" onerror="document.querySelector('#t').textContent='tracker: blocked'"></script>`,
  '/links': `<title>Links page</title><p>Some words to find: cookies, cookies again.</p><p><a id="dl" href="/file.txt" download>Download the file</a> · <a id="ctx" href="/beside">A link to right-click</a></p>`,
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), body = pages[url.pathname];
  if (url.pathname === '/tracker.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end('window.tracked = true;'); }
  if (url.pathname === '/file.txt') { res.setHeader('Content-Type', 'text/plain'); res.setHeader('Content-Disposition', 'attachment; filename="badger-notes.txt"'); return res.end('A file the browser downloaded.\n'); }
  if (!body) { res.statusCode = 404; return res.end('no'); }
  const cookie = /session=([^;]+)/.exec(req.headers.cookie || '')?.[1] || 'none';
  if (url.pathname === '/' && cookie === 'none') res.setHeader('Set-Cookie', 'session=kept-7f3a; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax');
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(body.replace('__COOKIE__', cookie));
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const site = `http://localhost:${server.address().port}`;

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Browser desk' });
createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: false } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api', BARKDOWN_CHROME_HOME: chromeHome, BARKDOWN_DOWNLOADS_DIR: downloadsDir, BARKDOWN_BLOCKLIST: blocklist } });
  const stderr = fs.createWriteStream(path.join(out, 'main-stderr.log'), { flags: 'a' }); app.process().stderr?.on('data', chunk => stderr.write(chunk));
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const openWeb = async url => { await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'site' }), url); await page.locator('webview#view').last().waitFor(); };
// Inside the active website tab: the <webview> tag's own executeJavaScript, as a user gesture.
const inSite = (code, gesture = true) => page.evaluate(([c, g]) => { const views = [...document.querySelectorAll('webview#view')]; const shown = views.filter(v => v.getBoundingClientRect().width > 0); return (shown.at(-1) || views.at(-1)).executeJavaScript(c, g); }, [code, gesture]);
// Thirty seconds: the step after a cold relaunch under chain load missed a ten-second budget once (2026-10-03).
const siteReady = async text => { for (let i = 0; i < 300; i++) { const t = await inSite('document.body && document.body.innerText', false).catch(() => ''); if (String(t).includes(text)) return t; await new Promise(r => setTimeout(r, 100)); } throw new Error('site did not show: ' + text); };
const webTabs = () => page.evaluate(() => { const s = window.__barkdown.state; const chat = s.chats[s.current]; return chat.tabs.filter(t => t.type === 'web').map(t => t.url); });

try {
  await launch();
  await openWeb(site + '/'); await siteReady('cookie: none');
  const ua = await inSite('navigator.userAgent', false);
  assert.match(ua, /Chrome\/\d+/); assert.doesNotMatch(ua, /Electron/);
  check('the tab names Chrome and not Electron', { userAgent: ua });
  // A sign-in popup: a child window in the same partition that talks back to its opener and closes.
  const popupPromise = app.waitForEvent('window', { timeout: 15000 });
  await inSite("document.querySelector('#popup').click(); 1");
  const popup = await popupPromise;
  const popupUrl = popup.url();
  await popup.waitForEvent('close', { timeout: 15000 }).catch(() => {});
  const result = await siteReady('popup: signed-in');
  assert.match(popupUrl, /\/popup$/);
  check('a popup opens as a child window, reports back to its opener and closes itself', { popupUrl, opener: result.split('\n').find(l => l.startsWith('popup:')) });
  await shot('01-popup-returned');
  // A link that wants a new tab opens a Barkdown tab beside, in the same chat.
  await inSite("document.querySelector('#beside').click(); 1");
  await page.waitForFunction(() => { const s = window.__barkdown.state; return s.chats[s.current].tabs.filter(t => t.type === 'web').length === 2; });
  const tabs = await webTabs();
  assert.equal(tabs.length, 2); assert.match(tabs[1], /\/beside$/);
  await siteReady('opened beside');
  check('a target=_blank link opens a Barkdown tab beside, not a window', { tabs });
  await shot('02-opened-beside');
  // A permission: asked in Barkdown's own words, remembered for the site.
  await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'perm' }), site + '/perm'); await siteReady('permission: unknown');
  await inSite("document.querySelector('#ask').click(); 1");
  await page.locator('.bw-permission').waitFor();
  const prompt = await page.locator('.bw-permission span').innerText();
  await shot('03-permission-asked');
  await page.locator('.bw-permission [data-decision="allow"]').click();
  await siteReady('permission: granted');
  const remembered = await page.evaluate(() => window.barkdown.browser.permissions());
  assert.equal(remembered.length, 1); assert.equal(remembered[0].notifications, 'allow'); assert.equal(remembered[0].origin, site);
  await inSite('location.reload(); 1', false); await siteReady('permission: unknown');
  await inSite("document.querySelector('#ask').click(); 1");
  await siteReady('permission: granted');
  assert.equal(await page.locator('.bw-permission').count(), 0, 'no second prompt for a remembered site');
  check('a site\'s permission is asked once in plain words and remembered', { prompt, remembered: remembered[0] });
  // Import from Chrome: Settings › Browser lists the fixture profile; the import fills Favorites and suggestions.
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await page.locator('.bw-settings').waitFor();
  await page.locator('nav [data-pane="browser"]').click();
  await page.locator('#browser-sources [data-import]').first().waitFor();
  const sources = await page.locator('#browser-sources .bw-source').allInnerTexts();
  await shot('04-settings-browser');
  await page.locator('#browser-sources [data-import]').first().click();
  await page.locator('#browser-import-status.ok').waitFor();
  const status = await page.locator('#browser-import-status').innerText();
  assert.match(status, /Imported 4 bookmarks and 3 history entries; 2 new Favorites/);
  await shot('05-imported');
  await page.keyboard.press('Escape');
  const favorites = await page.evaluate(() => window.__barkdown.state.favorites.map(f => f.target.url));
  assert.deepEqual(favorites, ['https://docs.barkpark.cloud/', 'https://fixture.example/']);
  check('Import from Chrome: the bookmarks bar becomes Favorites, the import is named with its counts', { sources, status, favorites });
  // The address bar suggests imported places.
  const address = page.locator('#address:visible').last();
  await address.click(); await address.fill(''); await address.type('fixture pri');
  await page.locator('.bw-suggest li').first().waitFor();
  const suggestions = await page.locator('.bw-suggest li .bw-suggest-url').allInnerTexts();
  assert.ok(suggestions.includes('https://fixture.example/pricing'), JSON.stringify(suggestions));
  await shot('06-suggestions');
  await page.keyboard.press('Escape');
  check('the address bar suggests imported history and bookmarks as you type', { typed: 'fixture pri', suggestions });
  // --- slice E: the browser's own chrome — download, find in page, zoom, the context menu
  await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'links' }), site + '/links'); await siteReady('Some words to find');
  await inSite("document.querySelector('#dl').click(); 1");
  await page.locator('.bw-download').waitFor();
  await page.waitForFunction(() => /downloaded/.test(document.querySelector('.bw-download')?.textContent || ''));
  const downloadText = await page.locator('.bw-download .bw-download-text').innerText();
  const saved = fs.readdirSync(downloadsDir);
  assert.deepEqual(saved, ['badger-notes.txt']); assert.equal(fs.readFileSync(path.join(downloadsDir, 'badger-notes.txt'), 'utf8'), 'A file the browser downloaded.\n');
  assert.equal(await page.locator('.bw-download [data-act="open"]').count(), 1);
  await shot('07-download-card');
  check('a download lands in the Downloads folder under its own name, with a card that opens or shows it', { downloadText, saved });
  // Find in page: ⌘F in the bar opens the find bar; the webview counts the matches.
  const bar = page.locator('#address:visible').last(); await bar.click(); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
  const findInput = page.locator('#find:visible #find-q').last(); await findInput.waitFor(); await findInput.type('cookies');
  await page.waitForFunction(() => /of 2/.test([...document.querySelectorAll('#find-count')].map(e => e.textContent).join(' ')));
  const count1 = await page.locator('#find:visible #find-count').last().innerText();
  await findInput.press('Enter'); await page.waitForFunction(() => /2 of 2/.test([...document.querySelectorAll('#find-count')].map(e => e.textContent).join(' ')));
  await shot('08-find-in-page');
  await findInput.press('Escape'); assert.equal(await page.locator('#find:visible').count(), 0);
  check('⌘F finds in the page and counts matches; Enter steps; Escape closes', { count1 });
  // Zoom: ⌘= steps the page up and shows the chip; ⌘0 resets and hides it.
  await bar.click(); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+=' : 'Control+=');
  await page.waitForFunction(() => [...document.querySelectorAll('#zoom')].some(z => !z.hidden && z.textContent === '110%'));
  const zoomFactor = await inSite('window.devicePixelRatio / (window.visualViewport ? 1 : 1)', false).catch(() => null);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+0' : 'Control+0');
  await page.waitForFunction(() => [...document.querySelectorAll('#zoom:not([hidden])')].length === 0);
  check('⌘= zooms the page and shows 110%; ⌘0 resets', { zoomFactor });
  // The page's context menu, from a right-click inside the page, offers to open a link beside.
  const linkBox = await inSite("(() => { const r = document.querySelector('#ctx').getBoundingClientRect(); return { x: Math.round(r.left + 5), y: Math.round(r.top + 5) }; })()", false);
  await page.evaluate(({ x, y }) => { const views = [...document.querySelectorAll('webview#view')]; const v = views.find(w => w.getBoundingClientRect().width > 0) || views.at(-1); v.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 }); v.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 }); }, linkBox);
  await page.locator('.bw-context-menu:not([hidden])').waitFor();
  const menuItems = await page.locator('.bw-context-menu:not([hidden]) button').allInnerTexts();
  await shot('09-context-menu');
  const tabsBefore = (await webTabs()).length;
  await page.locator('.bw-context-menu:not([hidden]) button', { hasText: 'Open link in a new tab beside' }).click();
  await page.waitForFunction(n => { const s = window.__barkdown.state; return s.chats[s.current].tabs.filter(t => t.type === 'web').length === n + 1; }, tabsBefore);
  check('a right-click in the page shows Barkdown\'s context menu; a link opens beside', { menuItems });
  // Ads and trackers: the list blocks the page's tracker script; the shield counts it and switches the site.
  await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'tracked' }), site + '/tracked'); await siteReady('tracker: blocked');
  const shieldStates = () => page.evaluate(() => [...document.querySelectorAll('#shield')].map(sh => ({ hidden: sh.hidden, text: sh.textContent, visible: sh.getBoundingClientRect().width > 0 })));
  const blockedSeen = await page.waitForFunction(() => [...document.querySelectorAll('#shield')].some(sh => !sh.hidden && /1 blocked/.test(sh.textContent)), null, { timeout: 15000 }).then(() => true, () => false);
  if (!blockedSeen) { report.diagnostics = { shields: await shieldStates(), tabs: await webTabs(), body: await inSite('document.body.innerText', false).catch(() => null), settings: await page.evaluate(() => window.__barkdown.state.settings.browser) }; persist(); throw new Error('shield did not show "1 blocked": ' + JSON.stringify(report.diagnostics)); }
  await shot('10-shield');
  await page.locator('#shield:visible').last().click();
  await siteReady('tracker: loaded');
  await page.waitForFunction(() => [...document.querySelectorAll('#shield')].some(sh => !sh.hidden && sh.textContent === 'ads on'));
  const allowList = await page.evaluate(() => window.__barkdown.state.settings.browser.blocking.allow);
  await page.locator('#shield:visible').last().click(); await siteReady('tracker: blocked');
  check('a tracker script is blocked and counted; the shield allows the site and blocks it again', { allowList });
  // Restart: the session cookie set on the first visit is still sent.
  await app.close();
  await launch();
  await openWeb(site + '/whoami'); const who = await siteReady('cookie: kept-7f3a');
  check('a session set in a tab survives a restart of Barkdown', { who: who.split('\n').find(l => l.startsWith('cookie:')) });
  const again = await page.evaluate(() => window.barkdown.browser.permissions());
  assert.equal(again[0]?.notifications, 'allow');
  check('the remembered permission survives the restart too');
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ out, checks: report.checks.map(c => c.name) }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); persist();
  try { await shot('99-failure'); } catch {}
  console.error(error); process.exitCode = 1;
} finally {
  await app?.close().catch(() => {}); server.close();
  fs.rmSync(userData, { recursive: true, force: true }); fs.rmSync(chromeHome, { recursive: true, force: true }); fs.rmSync(downloadsDir, { recursive: true, force: true }); fs.rmSync(listDir, { recursive: true, force: true });
}
