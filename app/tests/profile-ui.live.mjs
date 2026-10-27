import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { createDocuments } = require('../main/documents');
// The app no longer writes legacy notes (C087 R4); the same-slug notes are written into each profile's store from here.
const seedNote = (profileId, markdown) => createDocuments(createStore(createProfileRegistry(path.join(userData, 'profile-data')).storeFor(profileId).storeDir, { create: false })).create({ title: 'Shared slug', markdown });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-ui-'));
const requests = [];
const site = http.createServer((request, response) => { requests.push({ url: request.url, at: new Date().toISOString() }); response.end('<title>Profile website fixture</title><p>Owned website storage</p>'); });
await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
const siteUrl = `http://127.0.0.1:${site.address().port}`;
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
// Most calls here carry no timeout of their own, and one stuck call held the hosted macOS lane until the job
// limit. After five minutes, name the step, keep a picture and fail.
let step = 'launch';
const mark = name => { step = name; };
setTimeout(async () => {
  const dir = path.resolve('test-results', 'profile-ui'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'stuck.json'), JSON.stringify({ step }, null, 2) + '\n');
  try { await page?.screenshot({ path: path.join(dir, 'stuck.png'), timeout: 5000 }); } catch {}
  console.error('profile-ui: stuck at ' + step); process.exit(1);
}, 300000).unref();
let app = await launch(), page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
async function website(value) {
  mark(`website ${value ?? 'read'}: open`);
  await page.evaluate(url => window.__barkdown.openTarget({ kind: 'web', url, title: 'Fixture website' }), siteUrl);
  await page.waitForFunction(() => { const view = document.querySelector('webview'); try { return view?.getTitle() === 'Profile website fixture'; } catch { return false; } }).catch(async error => {
    // What the window held when the site never showed (kept with the CI artifacts in test-results/).
    const dir = path.resolve('test-results', 'profile-ui'); fs.mkdirSync(dir, { recursive: true });
    const views = await page.evaluate(() => [...document.querySelectorAll('webview')].map(v => { let title = null, url = null; try { title = v.getTitle(); url = v.getURL(); } catch {} let loading = null, waiting = null, crashed = null; try { loading = v.isLoading(); waiting = v.isWaitingForResponse(); crashed = v.isCrashed(); } catch {} return { src: v.getAttribute('src'), title, url, loading, waiting, crashed, gone: v.dataset.gone || null, error: v.closest('.bw-web-pane')?.querySelector('#error:not([hidden])')?.textContent || null, hidden: Boolean(v.closest('[hidden]')), size: [v.offsetWidth, v.offsetHeight], partition: v.getAttribute('partition') }; })).catch(e => String(e));
    fs.writeFileSync(path.join(dir, 'website-timeout.json'), JSON.stringify({ siteUrl, step, at: new Date().toISOString(), requests, views }, null, 2)); await page.screenshot({ path: path.join(dir, 'website-timeout.png') }).catch(() => {});
    throw error;
  });
  mark(`website ${value ?? 'read'}: script`);
  return page.evaluate(value => document.querySelector('webview').executeJavaScript(value === undefined ? '({storage:localStorage.getItem("owner"),cookie:document.cookie})' : `localStorage.setItem('owner', ${JSON.stringify(value)}); document.cookie='owner=${value}; path=/; max-age=3600';`), value);
}
try {
  mark('first load');
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const original = await page.evaluate(async () => {
    const api = window.barkdown, status = await api.profiles.status(), ws = await api.state.load();
    ws.chats.same = { id: 'same', title: 'A chat', messages: [], draft: 'A draft', tabs: [] }; ws.order = ['same']; ws.current = 'same';
    await api.state.save(ws);
    return { status, ws };
  });
  seedNote(original.status.profileId, 'A document');
  assert(original.status.enabled);
  assert(!fs.existsSync(path.join(userData, 'barkdown')), 'legacy library must remain untouched');
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await website('A');
  mark('create profile B');
  await page.keyboard.press('Control+,');
  await page.locator('#profile-name').fill('Second'); await page.locator('#profile-create').click();
  await page.waitForFunction(() => document.querySelector('#profile-choice')?.options.length === 2);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId !== id, original.status.profileId);
  const second = await page.evaluate(async () => {
    const api = window.barkdown, status = await api.profiles.status();
    const docs = await api.docs.list();
    const ws = await api.state.load(); ws.chats.same = { id: 'same', title: 'B chat', messages: [], draft: 'B draft', tabs: [] }; ws.order = ['same']; ws.current = 'same'; await api.state.save(ws);
    return { status, docs };
  });
  assert.equal(second.docs.length, 0);
  seedNote(second.status.profileId, 'B document');
  assert.deepEqual(await website(), { storage: null, cookie: '' });
  await website('B');
  mark('stale save');
  const stale = await page.evaluate(async ws => { try { await window.barkdown.state.save(ws); return null; } catch (error) { return error.message; } }, original.ws);
  assert.match(stale, /stale profile/);
  mark('switch back to A');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, original.status.profileId);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, original.status.profileId);
  assert.equal(await page.evaluate(() => window.__barkdown.state.chats.same.draft), 'A draft');
  assert.equal(await page.evaluate(async () => (await window.barkdown.docs.get('shared-slug')).markdown.trim()), 'A document');
  assert.deepEqual(await website(), { storage: 'A', cookie: 'owner=A' });
  mark('switch to B');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, second.status.profileId);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, second.status.profileId);
  await page.evaluate(async () => {
    const ws = await window.barkdown.state.load();
    ws.chats.child = { id: 'child', title: 'Saved side chat', side: true, parent: 'same', parentTitle: 'B chat', messages: [], draft: 'Child draft', folder: null, tabs: [{ id: 'site', type: 'web', title: 'Saved website', url: 'https://example.invalid', path: [] }] };
    ws.order.push('child'); await window.barkdown.state.save(ws);
  });
  mark('restart');
  // app.close() resolves before Electron has exited; a relaunch that opens the web partition while the old
  // process still holds it can leave the site unloaded (as browser.live.mjs found for cookies). Wait for the exit.
  const proc = app.process(), exited = new Promise(r => { if (proc.exitCode !== null) r(); else proc.once('exit', r); });
  await app.close(); await Promise.race([exited, new Promise(r => setTimeout(r, 15000))]); app = await launch(); page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const restart = await page.evaluate(async () => ({ status: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load(), doc: await window.barkdown.docs.get('shared-slug') }));
  assert.equal(restart.status.profileId, second.status.profileId);
  assert.equal(restart.ws.chats.same.draft, 'B draft');
  assert.equal(restart.ws.chats.child.parent, 'same'); assert.equal(restart.ws.chats.child.draft, 'Child draft'); assert.equal(restart.ws.chats.child.tabs[0].id, 'site');
  assert.equal(restart.doc.markdown.trim(), 'B document');
  assert.deepEqual(await website(), { storage: 'B', cookie: 'owner=B' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: ['opt-in UUID boot', 'Settings create/switch', 'same-slug documents', 'draft restoration', 'stale snapshot rejection', 'legacy untouched', 'same-URL website storage/cookies', 'selected B process restart with draft/side-parent/tabs'], userData }));
} finally {
  // Bounded, and the fixture's keep-alive sockets dropped: a close that waits must not hide the error above.
  mark('close'); await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 15000))]);
  site.closeAllConnections(); await new Promise(resolve => site.close(resolve));
}
