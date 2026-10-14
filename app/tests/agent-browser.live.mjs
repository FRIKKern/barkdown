// The agents' browser (C089 slice B) end to end, without a model: Barkdown runs in real Electron with a
// website tab open; the test connects to the browser MCP server exactly as a run would (the stdio child
// with the bridge socket, token and chat in its environment) and drives a local site through the tool
// vocabulary — tabs_context, tabs_create, read_page, find, form_input, computer (type, key, click,
// screenshot), get_page_text, javascript, console, network, tabs_close — while the window shows the
// agent's tab badged beside the person's.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C089/live', new Date().toISOString().replace(/[:.]/g, '-') + '-agent-browser');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-agent-browser-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [], tools: [],
  limits: ['The tools are driven by this test through the same MCP child a run receives, not by a model; what a model does with them is the bench (slice D). One machine, from source under Electron, a local site.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

const pages = {
  '/': `<title>Person's page</title><p>The person's own tab.</p>`,
  '/form': `<title>Sign-up form</title><h1>Join</h1><form action="/submitted"><label>Name <input name="name" id="name" autocomplete="off"></label> <label>Plan <select name="plan"><option>free</option><option>pro</option></select></label> <label><input type="checkbox" name="agree"> Agree</label> <input name="q" id="q" placeholder="search" autocomplete="off"> <button type="submit">Send</button></form><script>console.log('[agent] form ready'); fetch('/ping').catch(() => {});</script>`,
  '/ping': 'pong',
  '/shop': `<title>Shop</title><h1>Cart</h1><p>One badger hat.</p><button id="buy">Buy now</button> <button id="nothing">Nothing much</button> <label>Password <input type="password" id="pw" autocomplete="off"></label> <button id="alert" onclick="setTimeout(() => alert('Are you sure?'), 50)">Ask me</button>`,
  '/whoami': `<title>Who am I</title><p id="who">cookie: __COOKIE__</p>`,
};
let releaseKeysBody, keysSubmissions = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/submitted') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const body = `<h1 id="hello">Hello, ${url.searchParams.get('name')} (${url.searchParams.get('plan')}, agree=${url.searchParams.get('agree') ? 'yes' : 'no'}, q=${url.searchParams.get('q')})</h1>`;
    if (url.searchParams.get('name') === 'Keys') {
      // A committed URL/title need not mean the response body has arrived.
      // Hold only the owned fixture body until the read-only timeout control finishes.
      keysSubmissions++; res.write('<title>Welcome</title>');
      releaseKeysBody = () => res.end(body); return;
    }
    return res.end('<title>Welcome</title>' + body);
  }
  const body = pages[url.pathname]; if (!body) { res.statusCode = 404; return res.end('no'); }
  const cookie = /session=([^;]+)/.exec(req.headers.cookie || '')?.[1] || 'none';
  if (url.pathname === '/' && cookie === 'none') res.setHeader('Set-Cookie', 'session=person-9c1; Max-Age=86400; Path=/; SameSite=Lax');
  res.setHeader('Content-Type', url.pathname === '/ping' ? 'text/plain' : 'text/html; charset=utf-8'); res.end(body.replace('__COOKIE__', cookie));
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const site = `http://localhost:${server.address().port}`;

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Agent browser desk' });
createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: false } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page, client;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const textOf = result => (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
const LONG = { timeout: 400000 }; // calls may wait on the person
const call = async (name, args = {}) => { const started = Date.now(); const result = await client.callTool({ name, arguments: args }, undefined, LONG); report.tools.push({ name, args, ms: Date.now() - started, isError: Boolean(result.isError), preview: textOf(result).slice(0, 160) }); persist(); if (result.isError) throw new Error(`${name}: ${textOf(result)}`); return result; };
async function waitForPageText(tabId, expected, timeout = 3000) {
  const until = Date.now() + timeout;
  let actual;
  do {
    actual = textOf(await call('get_page_text', { tabId }));
    if (expected.test(actual)) return actual;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < until);
  throw new Error(`Page text did not match ${expected}: ${actual}`);
}
const webTabs = () => page.evaluate(() => { const s = window.__barkdown.state; const chat = s.chats[s.current]; return chat.tabs.filter(t => t.type === 'web').map(t => ({ url: t.url, agent: Boolean(t.agent), active: chat.active === t.id })); });

try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  // Resize the real host window. Chromium device emulation leaks the host viewport into webviews.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1300, 900));
  await page.waitForFunction(() => innerWidth === 1300 && innerHeight === 900);
  // The person's own tab, then the bridge a run in this chat would be given.
  await page.evaluate(u => window.__barkdown.openTarget({ kind: 'web', url: u, title: 'mine' }), site + '/');
  await page.locator('webview#view').waitFor();
  const chatId = await page.evaluate(() => window.__barkdown.state.current);
  const spec = await page.evaluate(id => window.barkdown.browser.bridge(id), chatId);
  assert.ok(spec.env.BARKDOWN_BROWSER_SOCKET && spec.env.BARKDOWN_BROWSER_TOKEN);
  client = new Client({ name: 'agent-browser-tour', version: '0' });
  await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, env: { ...process.env, ...spec.env }, stderr: 'pipe' }));
  const names = (await client.listTools()).tools.map(t => t.name).sort();
  check('the run receives the browser as an MCP server with the Claude in Chrome vocabulary', { tools: names });
  // tabs_context: the person's tab is there and is not the agent's.
  await page.waitForFunction(() => document.querySelector('webview#view'));
  let context; for (let i = 0; i < 50; i++) { context = JSON.parse(textOf(await call('tabs_context'))); if (context.tabs?.length) break; await new Promise(r => setTimeout(r, 100)); }
  assert.equal(context.tabs.length, 1); assert.equal(context.tabs[0].openedByYou, false); assert.match(context.tabs[0].url, /\/$/);
  check('tabs_context lists the chat\'s tabs: the person\'s tab, not opened by the agent', context.tabs);
  // tabs_create: the agent's own tab, beside the person's, badged in the window.
  const created = JSON.parse(textOf(await call('tabs_create', { url: site + '/form' }))).tab;
  assert.equal(created.openedByYou, true); assert.match(created.url, /\/form$/);
  const tabs = await webTabs(); assert.equal(tabs.length, 2); assert.equal(tabs[1].agent, true);
  await page.locator('.bw-tab-agent').waitFor();
  await shot('01-agent-tab-beside');
  check('tabs_create opens the agent\'s tab beside the person\'s, badged for the person', { created, tabs });
  // read_page and find: refs for the form controls.
  const tree = textOf(await call('read_page', { tabId: created.tabId, filter: 'interactive' }));
  assert.match(tree, /\[ref_\d+\] textbox "Name"/); assert.match(tree, /combobox "Plan"|\[ref_\d+\] combobox/); assert.match(tree, /checkbox/); assert.match(tree, /button "Send"/);
  const found = textOf(await call('find', { tabId: created.tabId, query: 'the name field' }));
  const nameRef = /\[(ref_\d+)\] textbox "Name"/.exec(found)?.[1]; assert.ok(nameRef, found);
  const planRef = /\[(ref_\d+)\] combobox/.exec(tree)?.[1], agreeRef = /\[(ref_\d+)\] checkbox/.exec(tree)?.[1], qRef = /\[(ref_\d+)\] textbox "search"/.exec(tree)?.[1], sendRef = /\[(ref_\d+)\] button "Send"/.exec(tree)?.[1];
  assert.ok(planRef && agreeRef && qRef && sendRef, tree);
  check('read_page gives refs for every control; find answers a description with the right ref', { nameRef, planRef, agreeRef, qRef, sendRef });
  // form_input sets fields by ref; computer types into one and presses a key.
  await call('form_input', { tabId: created.tabId, ref: nameRef, value: 'Agent' });
  await call('form_input', { tabId: created.tabId, ref: planRef, value: 'pro' });
  await call('form_input', { tabId: created.tabId, ref: agreeRef, value: true });
  await call('computer', { tabId: created.tabId, action: 'type', ref: qRef, text: 'shoes' });
  const shotBefore = await call('computer', { tabId: created.tabId, action: 'screenshot' });
  const image = shotBefore.content.find(c => c.type === 'image'); assert.ok(image?.data);
  fs.writeFileSync(path.join(out, '02-agent-screenshot-form.png'), Buffer.from(image.data, 'base64')); report.screenshots.push('02-agent-screenshot-form.png');
  assert.match(textOf(shotBefore), /viewport \d+×\d+ CSS px/);
  const pixels = require('pngjs').PNG.sync.read(Buffer.from(image.data, 'base64'));
  const viewSize = await page.locator('webview#view').last().evaluate(v => { const r = v.getBoundingClientRect(); return { width: r.width, height: r.height }; });
  assert.ok(Math.abs(pixels.width - viewSize.width) <= 1 && Math.abs(pixels.height - viewSize.height) <= 1, 'agent screenshot matches the visible tab viewport, not the host window');
  const bottom = ((pixels.height - 4) * pixels.width + 4) * 4;
  assert.ok(pixels.data[bottom] > 240 && pixels.data[bottom + 3] === 255, 'the blank fixture page remains opaque white, without transparent tiled copies');
  await shot('03-window-while-agent-types');
  // "Send" is sending: the click pauses for the person, who allows it.
  const sending = call('computer', { tabId: created.tabId, action: 'left_click', ref: sendRef });
  await page.locator('.bw-pause').waitFor(); const sendPause = await page.locator('.bw-pause span').innerText(); await page.locator('.bw-pause [data-decision="allow"]').click();
  await sending;
  const after = await waitForPageText(created.tabId, /Hello, Agent \(pro, agree=yes, q=shoes\)/);
  assert.match(after, /Hello, Agent \(pro, agree=yes, q=shoes\)/);
  check('form_input, computer type and click fill and submit a form (the Send click pauses first); get_page_text reads the result', { after: after.split('\n').slice(-1)[0], sendPause });
  // javascript, console and network.
  const title = textOf(await call('javascript', { tabId: created.tabId, code: 'document.title' }));
  assert.equal(title, 'Welcome');
  const consoleText = textOf(await call('read_console_messages', { tabId: created.tabId, pattern: 'agent' }));
  assert.match(consoleText, /\[agent\] form ready/);
  // Requests are recorded from the first read of the tab on; one made now through the page shows up.
  assert.equal(textOf(await call('javascript', { tabId: created.tabId, code: "fetch('/ping').then(r => r.status)" })), '200');
  const network = textOf(await call('read_network_requests', { tabId: created.tabId, pattern: 'ping|submitted' }));
  assert.match(network, /GET 200 .*\/ping/); assert.match(network, /GET 200 .*\/submitted/);
  check('javascript, read_console_messages and read_network_requests answer from the tab', { title, console: consoleText.split('\n')[0], network: network.split('\n').length + ' lines' });
  // key presses reach the page.
  await call('navigate', { tabId: created.tabId, url: site + '/form' });
  const tree2 = textOf(await call('read_page', { tabId: created.tabId, filter: 'interactive' }));
  const nameRef2 = /\[(ref_\d+)\] textbox "Name"/.exec(tree2)?.[1];
  await call('computer', { tabId: created.tabId, action: 'type', ref: nameRef2, text: 'Keys' });
  await call('computer', { tabId: created.tabId, action: 'key', text: 'Return' });
  await waitForPageText(created.tabId, /\/submitted\?name=Keys/);
  assert.equal(keysSubmissions, 1);
  await assert.rejects(waitForPageText(created.tabId, /Hello, Keys/, 200), /Page text did not match/);
  assert.equal(keysSubmissions, 1, 'observing missing content must not replay the input');
  check('a committed submission URL with a held body times out without replaying Return');
  releaseKeysBody();
  assert.match(await waitForPageText(created.tabId, /Hello, Keys/), /Hello, Keys/);
  assert.equal(keysSubmissions, 1);
  check('computer key=Return submits the form the way a keyboard would');
  // Refusals read as tool errors; the person's tab stays untouched; closing the agent's tab.
  const bad = await client.callTool({ name: 'navigate', arguments: { tabId: created.tabId, url: 'file:///etc/hosts' } });
  assert.equal(bad.isError, true); assert.match(textOf(bad), /Only http\(s\)/);
  await call('tabs_close', { tabId: created.tabId });
  await page.waitForFunction(() => { const s = window.__barkdown.state; return s.chats[s.current].tabs.filter(t => t.type === 'web').length === 1; });
  const left = await webTabs(); assert.equal(left.length, 1); assert.match(left[0].url, /\/$/);
  check('a refusal is a tool error, not a crash; tabs_close removes the agent\'s tab and leaves the person\'s', { refusal: textOf(bad), left });
  await shot('04-after-close');
  // --- slice C: pauses, ask mode, the allow-list, dialogs, logged-out tabs
  const shop = JSON.parse(textOf(await call('tabs_create', { url: site + '/shop' }))).tab;
  const shopTree = textOf(await call('read_page', { tabId: shop.tabId, filter: 'interactive' }));
  const buyRef = /\[(ref_\d+)\] button "Buy now"/.exec(shopTree)?.[1], pwRef = /\[(ref_\d+)\] textbox "Password"/.exec(shopTree)?.[1], alertRef = /\[(ref_\d+)\] button "Ask me"/.exec(shopTree)?.[1], nothingRef = /\[(ref_\d+)\] button "Nothing much"/.exec(shopTree)?.[1];
  assert.ok(buyRef && pwRef && alertRef && nothingRef, shopTree);
  // A purchase pauses: the person blocks, the tool reports the refusal; the person allows, it proceeds.
  const blocked = client.callTool({ name: 'computer', arguments: { tabId: shop.tabId, action: 'left_click', ref: buyRef } }, undefined, LONG);
  await page.locator('.bw-pause').waitFor();
  const pauseText = await page.locator('.bw-pause span').innerText();
  await shot('05-pause-purchase');
  await page.locator('.bw-pause [data-decision="deny"]').click();
  const refusal = await blocked; assert.equal(refusal.isError, true); assert.match(textOf(refusal), /declined a purchase or payment/);
  const allowed = client.callTool({ name: 'computer', arguments: { tabId: shop.tabId, action: 'left_click', ref: buyRef } }, undefined, LONG);
  await page.locator('.bw-pause [data-decision="allow"]').click();
  assert.equal((await allowed).isError, undefined);
  check('a purchase pauses for the person; Block becomes a tool error, Allow lets the click through', { pauseText, refusal: textOf(refusal) });
  // A password field pauses on type.
  const typing = client.callTool({ name: 'computer', arguments: { tabId: shop.tabId, action: 'type', ref: pwRef, text: 'hunter2' } }, undefined, LONG);
  await page.locator('.bw-pause').waitFor(); const pwText = await page.locator('.bw-pause span').innerText(); await page.locator('.bw-pause [data-decision="deny"]').click();
  assert.match(textOf(await typing), /declined a password/); assert.match(pwText, /a password/);
  check('typing into a password field pauses', { pwText });
  // Ask mode: a harmless click pauses too; back to automatic afterwards.
  await page.evaluate(() => window.barkdown.settings.set({ browser: { mode: 'ask' } }));
  const plain = client.callTool({ name: 'computer', arguments: { tabId: shop.tabId, action: 'left_click', ref: nothingRef } }, undefined, LONG);
  await page.locator('.bw-pause').waitFor(); const askText = await page.locator('.bw-pause span').innerText(); await page.locator('.bw-pause [data-decision="allow"]').click();
  assert.equal((await plain).isError, undefined); assert.match(askText, /ask-before-every-action/);
  await page.evaluate(() => window.barkdown.settings.set({ browser: { mode: 'auto' } }));
  check('in ask mode even a harmless click pauses', { askText });
  // The allow-list: a site off the list pauses; a listed one does not.
  await page.evaluate(() => window.barkdown.settings.set({ browser: { sites: { mode: 'list', list: ['localhost'] } } }));
  await call('navigate', { tabId: shop.tabId, url: site + '/shop' });
  const offList = client.callTool({ name: 'navigate', arguments: { tabId: shop.tabId, url: 'https://example.com/' } }, undefined, LONG);
  await page.locator('.bw-pause').waitFor(); const listText = await page.locator('.bw-pause span').innerText(); await page.locator('.bw-pause [data-decision="deny"]').click();
  assert.match(textOf(await offList), /declined opening example\.com/);
  await page.evaluate(() => window.barkdown.settings.set({ browser: { sites: { mode: 'all', list: [] } } }));
  check('a site off the allow-list pauses and can be refused', { listText });
  // A dialog the page raises is dismissed and reported with the next result, never stranding the run.
  const shopTree2 = textOf(await call('read_page', { tabId: shop.tabId, filter: 'interactive' }));
  const alertRef2 = /\[(ref_\d+)\] button "Ask me"/.exec(shopTree2)?.[1];
  await call('computer', { tabId: shop.tabId, action: 'left_click', ref: alertRef2 });
  await new Promise(r => setTimeout(r, 400));
  const afterDialog = textOf(await call('get_page_text', { tabId: shop.tabId }));
  assert.match(afterDialog, /^A alert dialog said "Are you sure\?" and was dismissed\./);
  check('a page dialog is dismissed and reported; the run is not stranded');
  // Logged-out mode: the agent's new tab carries none of the person's sessions.
  await call('tabs_close', { tabId: shop.tabId });
  await page.evaluate(() => window.barkdown.settings.set({ browser: { loggedOut: true } }));
  const mine = JSON.parse(textOf(await call('tabs_context'))).tabs.find(t => !t.openedByYou);
  await call('navigate', { tabId: mine.tabId, url: site + '/whoami' });
  const personSees = textOf(await call('get_page_text', { tabId: mine.tabId }));
  const priv = JSON.parse(textOf(await call('tabs_create', { url: site + '/whoami' }))).tab;
  const agentSees = textOf(await call('get_page_text', { tabId: priv.tabId }));
  assert.match(personSees, /cookie: person-9c1/); assert.match(agentSees, /cookie: none/);
  await shot('06-logged-out-agent-tab');
  await call('tabs_close', { tabId: priv.tabId });
  await page.evaluate(() => window.barkdown.settings.set({ browser: { loggedOut: false } }));
  check('in logged-out mode the agent\'s tab has none of the person\'s sessions', { personSees: personSees.split('\n').at(-1), agentSees: agentSees.split('\n').at(-1) });
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ out, checks: report.checks.map(c => c.name), toolCalls: report.tools.length }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); persist();
  try { await shot('99-failure'); } catch {}
  console.error(error); process.exitCode = 1;
} finally {
  // Cleanup that hangs must not hang the chain: twenty seconds, then the process ends with the verdict it had.
  await Promise.race([(async () => { await client?.close().catch(() => {}); await app?.close().catch(() => {}); })(), new Promise(r => setTimeout(r, 20000))]);
  server.close(); fs.rmSync(userData, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
