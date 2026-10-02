// The browser session (main/browser-session.js) with fakes: the user agent names Chrome and not Electron;
// a site's permission is asked once and remembered; unknown permissions are refused by policy; a popup
// becomes a child window in the same partition; a new-tab link opens a Barkdown tab beside.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createBrowserSession, cleanUserAgent, popupSize, chromeShortcut, freeName, PERMISSIONS_FILE } = require('../main/browser-session');

function fakes() {
  const files = new Map();
  const store = { readJson: (name, fallback) => files.has(name) ? structuredClone(files.get(name)) : fallback, writeJson: (name, value) => files.set(name, structuredClone(value)) };
  const session = { ua: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Electron/44.5.1 Safari/537.36',
    getUserAgent() { return this.ua; }, setUserAgent(ua) { this.ua = ua; }, request: null, check: null,
    setPermissionRequestHandler(fn) { this.request = fn; }, setPermissionCheckHandler(fn) { this.check = fn; } };
  const asked = [], beside = [];
  const ask = async request => { asked.push(request); return request.permission === 'geolocation' ? 'deny' : 'allow'; };
  const browser = createBrowserSession({ session, partition: 'persist:test', store, ask, openBeside: detail => beside.push(detail), parentWindow: () => ({ id: 'main' }) });
  const request = (permission, url, extra = {}) => new Promise(resolve => session.request({}, permission, resolve, { requestingUrl: url, ...extra }));
  return { files, store, session, asked, beside, browser, request };
}

assert.equal(cleanUserAgent('A Chrome/152.0 Electron/44.5.1 Safari/537.36'), 'A Chrome/152.0 Safari/537.36');
assert.deepEqual(popupSize('width=420,height=380,menubar=no'), { width: 420, height: 380 });
assert.deepEqual(popupSize(''), { width: 560, height: 680 });
assert.deepEqual(popupSize('width=10,height=99999'), { width: 200, height: 1600 }, 'sizes are clamped');

{
  const f = fakes();
  assert.doesNotMatch(f.session.ua, /Electron/); assert.match(f.session.ua, /Chrome\/152/);
  // Granted without asking; refused by policy; asked and remembered.
  assert.equal(await f.request('clipboard-read', 'https://a.example/page'), true);
  assert.equal(await f.request('midiSysex', 'https://a.example/page'), false);
  assert.equal(await f.request('media', 'https://a.example/page', { mediaTypes: ['video'] }), true);
  assert.deepEqual(f.asked, [{ origin: 'https://a.example', permission: 'media', mediaTypes: ['video'] }]);
  assert.equal(await f.request('media', 'https://a.example/other', { mediaTypes: ['audio'] }), true, 'remembered per site, not per page');
  assert.equal(f.asked.length, 1, 'no second prompt for the same site');
  assert.equal(f.session.check({}, 'media', 'https://a.example', { requestingUrl: 'https://a.example/x' }), true);
  assert.equal(f.session.check({}, 'media', 'https://b.example', { requestingUrl: 'https://b.example/x' }), false);
  // Two concurrent requests from one page share one prompt.
  const both = await Promise.all([f.request('notifications', 'https://c.example/'), f.request('notifications', 'https://c.example/')]);
  assert.deepEqual(both, [true, true]); assert.equal(f.asked.filter(a => a.permission === 'notifications').length, 1);
  // A refusal is remembered too, and is forgettable.
  assert.equal(await f.request('geolocation', 'https://a.example/'), false);
  assert.equal(f.store.readJson(PERMISSIONS_FILE).sites['https://a.example'].geolocation, 'deny');
  assert.deepEqual(f.browser.list().map(s => s.origin).sort(), ['https://a.example', 'https://c.example']);
  assert.equal(f.browser.forget('https://a.example'), true); assert.equal(f.browser.forget('https://a.example'), false);
  assert.equal(f.asked.length, 3); await f.request('media', 'https://a.example/', { mediaTypes: ['video'] }); assert.equal(f.asked.length, 4, 'forgotten sites are asked again');
  // Only web origins are asked; a file: page gets nothing.
  assert.equal(await f.request('media', 'file:///tmp/x.html'), false);
}
{
  // Popups and new-tab links.
  const f = fakes();
  const popup = f.browser.windowOpen({ url: 'https://accounts.example/oauth', disposition: 'new-window', features: 'width=480,height=600' }, { id: 7 });
  assert.equal(popup.action, 'allow');
  assert.equal(popup.overrideBrowserWindowOptions.webPreferences.partition, 'persist:test');
  assert.equal(popup.overrideBrowserWindowOptions.webPreferences.sandbox, true);
  assert.equal(popup.overrideBrowserWindowOptions.webPreferences.preload, undefined);
  assert.deepEqual([popup.overrideBrowserWindowOptions.width, popup.overrideBrowserWindowOptions.height], [480, 600]);
  assert.deepEqual(popup.overrideBrowserWindowOptions.parent, { id: 'main' });
  assert.deepEqual(f.browser.windowOpen({ url: 'https://docs.example/page', disposition: 'foreground-tab' }, { id: 7 }), { action: 'deny' });
  assert.deepEqual(f.beside, [{ url: 'https://docs.example/page', openerId: 7 }]);
  assert.deepEqual(f.browser.windowOpen({ url: 'javascript:alert(1)', disposition: 'new-window' }, { id: 7 }), { action: 'deny' });
  assert.equal(f.beside.length, 1, 'a non-web address opens nothing');
  // attach() routes the guest and every window it creates.
  const handlers = []; const made = [];
  const contents = { id: 9, setWindowOpenHandler: fn => handlers.push(fn), on: (event, fn) => made.push([event, fn]) };
  f.browser.attach(contents);
  assert.equal(handlers.length, 1); assert.equal(made[0][0], 'did-create-window');
  const child = { webContents: { id: 10, setWindowOpenHandler: fn => handlers.push(fn), on: () => {} } };
  made[0][1](child); assert.equal(handlers.length, 2, 'the popup gets the same handler');
}
// --- slice E: the browser's own keys, download names, downloads and the context menu reaching the window
assert.equal(chromeShortcut({ type: 'keyDown', key: 'f', meta: true }), 'cmd+f'); assert.equal(chromeShortcut({ type: 'keyDown', key: 'L', control: true }), 'cmd+l');
assert.equal(chromeShortcut({ type: 'keyDown', key: '+', meta: true, shift: true }), 'shift+cmd+='); assert.equal(chromeShortcut({ type: 'keyDown', key: 'Escape' }), 'Escape');
assert.equal(chromeShortcut({ type: 'keyDown', key: 'f' }), null, 'a plain letter is the page\'s'); assert.equal(chromeShortcut({ type: 'keyUp', key: 'f', meta: true }), null); assert.equal(chromeShortcut({ type: 'keyDown', key: 'f', meta: true, alt: true }), null);
{
  const taken = new Set(['/d/report.pdf', '/d/report (2).pdf']);
  assert.equal(freeName('/d', 'report.pdf', p => taken.has(p)), 'report (3).pdf'); assert.equal(freeName('/d', 'notes', p => taken.has(p)), 'notes');
}
{
  const events = [], store = { readJson: () => null, writeJson() {} };
  const handlers = {}; const session = { getUserAgent: () => 'x Electron/1', setUserAgent() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, on: (event, fn) => { handlers[event] = fn; } };
  const browser = createBrowserSession({ session, partition: 'persist:p', store, ask: async () => 'deny', openBeside: () => {}, downloads: '/tmp/dl', fs: { existsSync: p => p === '/tmp/dl/a.txt' }, now: () => 7,
    onDownload: d => events.push(['download', d.state, d.filename, d.received]), onShortcut: d => events.push(['shortcut', d.key]), onContextMenu: d => events.push(['menu', d.linkURL, d.mediaType]) });
  // A download gets a free name in the folder and its progress is reported until done.
  const itemHandlers = {}; let received = 0;
  const item = { getFilename: () => 'a.txt', getURL: () => 'https://x.example/a.txt', getReceivedBytes: () => received, getTotalBytes: () => 100, savePath: null, setSavePath(p) { this.savePath = p; }, on: (e, fn) => { itemHandlers[e] = fn; }, once: (e, fn) => { itemHandlers[e] = fn; } };
  handlers['will-download']({}, item, { id: 3 });
  assert.equal(item.savePath, '/tmp/dl/a (2).txt');
  received = 50; itemHandlers.updated({}, 'progressing'); received = 100; itemHandlers.done({}, 'completed');
  assert.deepEqual(events.filter(e => e[0] === 'download'), [['download', 'started', 'a (2).txt', 0], ['download', 'progressing', 'a (2).txt', 50], ['download', 'completed', 'a (2).txt', 100]]);
  // Keys the chrome owns are taken from the page and forwarded; the context menu is forwarded with what the page offered.
  const contentsHandlers = {}; let prevented = 0;
  const contents = { id: 9, setWindowOpenHandler() {}, on: (e, fn) => { contentsHandlers[e] = fn; } };
  browser.attach(contents);
  contentsHandlers['before-input-event']({ preventDefault: () => prevented++ }, { type: 'keyDown', key: 'f', meta: true });
  contentsHandlers['before-input-event']({ preventDefault: () => prevented++ }, { type: 'keyDown', key: 'x', meta: true });
  contentsHandlers['before-input-event']({ preventDefault: () => prevented++ }, { type: 'keyDown', key: 'Escape' });
  assert.equal(prevented, 1, 'only the chrome\'s keys are taken from the page; Escape is only mirrored');
  contentsHandlers['context-menu']({}, { x: 10, y: 20, linkURL: 'https://x.example/l', mediaType: 'none' });
  assert.deepEqual(events.filter(e => e[0] !== 'download'), [['shortcut', 'cmd+f'], ['shortcut', 'Escape'], ['menu', 'https://x.example/l', 'none']]);
}
console.log('Browser session: Chrome user agent, permissions asked once per site and remembered, policy refusals, popups as child windows, new-tab links beside, chrome keys, download names and progress, and the context menu passed.');
