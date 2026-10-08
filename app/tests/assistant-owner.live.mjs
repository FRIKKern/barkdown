// Actual Electron profile selection and captured MCP connection; disposable HTTP catalogs only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), root = path.dirname(appRoot);
const require = createRequire(path.join(appRoot, 'package.json'));
const { _electron: electron } = require('playwright');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const out = path.resolve(process.env.BARKDOWN_CONTROL_PROFILE_OUT || path.join(appRoot, 'test-results/assistant-owner', new Date().toISOString().replace(/[:.]/g, '-')));
if (fs.existsSync(out)) throw Error('Refusing to overwrite native evidence');
fs.mkdirSync(out, { recursive: true });
const report = { dirty: execFileSync('git', ['status', '--porcelain', '--', 'app'], { cwd: root, encoding: 'utf8' }).trim() !== '', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Actual Windows Electron, Settings profile switch, captured stdio MCP and controlled HTTP catalogs; no real library or model', status: 'running', checks: [], responses: {}, requests: [] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const servers = [];
let holdCatalog = null;
for (const owner of ['A', 'B']) {
  const server = http.createServer((req, res) => {
    report.requests.push({ owner, url: req.url });
    if (holdCatalog && owner === holdCatalog.owner && req.url.startsWith('/v1/data/query/')) { const held = holdCatalog; holdCatalog = null; held.entered(); held.release = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ documents: [{ _id: 'same-slug', slug: 'same-slug', title: `Profile ${owner} fixture note` }], count: 1, total: 1, hasMore: false, offset: 0, limit: 200, nextOffset: null, perspective: 'published' })); }; return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ documents: [{ _id: 'same-slug', slug: 'same-slug', title: `Profile ${owner} fixture note` }], count: 1, total: 1, hasMore: false, offset: 0, limit: 200, nextOffset: null, perspective: 'published' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
}
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-control-profile-native-')));
let app, page; const clients = [];
const connect = async spec => { const client = new Client({ name: 'profile-ownership-proof', version: '0' }); clients.push(client); await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, env: { ...process.env, ...spec.env }, stderr: 'pipe' })); return client; };
const tool = async (client, name, args = {}) => { const r = await client.callTool({ name, arguments: args }); return { error: Boolean(r.isError), text: r.content.map(c => c.text || '').join('\n') }; };
const list = client => tool(client, 'app', { command: 'note.list' });
async function configure(owner, server) {
  await page.evaluate(async ({ owner, server }) => {
    const api = window.barkdown;
    await api.settings.set({ theme: 'dark', barkpark: { enabled: true, viaCli: false, server, dataset: 'production', local: { enabled: false } } });
    window.__barkdown.state.settings = await api.settings.get();
    document.documentElement.dataset.theme = 'dark';
    await window.__barkdown.refreshLibrary();
  }, { owner, server: `http://127.0.0.1:${server.address().port}` });
}
const watchdog = setTimeout(() => { report.status = report.status === 'failed' ? 'failed' : 'timeout'; report.watchdog = true; persist(); app?.process().kill(); process.exit(1); }, 90000);
try {
  persist(); app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await configure('A', servers[0]);
  const ownerA = await page.evaluate(() => window.__barkdown.state.profileId);
  const chatA = await page.evaluate(() => window.__barkdown.state.current);
  const specA = await page.evaluate(id => window.barkdown.browser.bridge(id), chatA);
  const clientA = await connect(specA); report.responses.before = await list(clientA);
  assert.equal(report.responses.before.error, false); assert.match(report.responses.before.text, /Profile A fixture note/);
  report.checks.push('Captured A bridge reads A catalog'); persist();
  await page.keyboard.press('Control+,');
  await page.locator('#profile-name').fill('Disposable B'); await page.locator('#profile-create').click();
  await page.waitForFunction(() => document.querySelector('#profile-choice')?.options.length === 2);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId !== id, ownerA);
  await configure('B', servers[1]);
  report.owners = { before: ownerA, after: await page.evaluate(() => window.__barkdown.state.profileId) };
  assert.notEqual(report.owners.before, report.owners.after);
  const chatB = await page.evaluate(() => window.__barkdown.state.current);
  report.chats = { before: chatA, after: chatB };
  const specB = await page.evaluate(id => window.barkdown.browser.bridge(id), chatB);
  const clientB = await connect(specB); report.responses.currentB = await list(clientB);
  assert.equal(report.responses.currentB.error, false); assert.match(report.responses.currentB.text, /Profile B fixture note/);
  report.checks.push('Actual Settings switch selects B; natural starter chat IDs and matching note slugs; new B bridge reads B'); persist();
  report.responses.oldA = await list(clientA); persist();
  await page.locator('#bw-cloud-archive-toggle').click();
  await page.locator('#bw-cloud-archive', { hasText: 'Profile B fixture note' }).waitFor();
  await page.screenshot({ path: path.join(out, 'active-b.png') });
  assert.equal(report.responses.oldA.error, true, 'A captured assistant bridge must refuse after the person selects B');
  assert.match(report.responses.oldA.text, /profile_changed/);
  for (const [name, args] of [['app', { command: 'status' }], ['app_commands', {}], ['tabs_context', {}]]) {
    const answer = await tool(clientA, name, args); assert.equal(answer.error, true); report.responses['oldA-' + name] = answer;
  }
  const refused = await tool(clientB, 'app', { command: 'settings.set', args: { key: 'theme', value: 'light' } });
  assert.equal(refused.error, true); assert.match(refused.text, /full_yolo_required/);
  report.responses.yoloOff = refused;
  const launcher = path.join(userData, 'bin', process.platform === 'win32' ? 'barkdown.cmd' : 'barkdown');
  const cli = await new Promise((resolve, reject) => {
    const env = { ...process.env }; delete env.BARKDOWN_CONTROL;
    const child = spawn(launcher, ['--user-data', userData, 'note', 'list', '--json'], { env, shell: process.platform === 'win32' }); let out = '', err = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; }); child.once('error', reject);
    child.once('close', code => resolve({ code, text: out || err })); child.stdin.end();
  });
  assert.equal(cli.code, 0, cli.text); assert.match(cli.text, /Profile B fixture note/); report.responses.cliB = cli;
  await page.keyboard.press('Control+,');
  await page.locator('.bw-settings button[data-pane="assistant"]').click();
  const yolo = page.locator('.bw-settings label[for="full-yolo"]'); await yolo.scrollIntoViewIfNeeded(); await yolo.click();
  await page.waitForFunction(() => document.querySelector('#full-yolo')?.checked && window.__barkdown.state.settings.control?.fullYolo === true);
  await page.locator('.bw-settings [data-act="cancel"]').click();
  report.responses.switchBack = await tool(clientB, 'app', { command: 'PROFILE.SWITCH', args: { profile: ownerA } });
  assert.equal(report.responses.switchBack.error, false, report.responses.switchBack.text);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, ownerA);
  for (const client of [clientA, clientB]) { const old = await list(client); assert.equal(old.error, true); assert.match(old.text, /profile_changed/); }
  const fresh = await connect(await page.evaluate(() => window.barkdown.browser.bridge(window.__barkdown.state.current)));
  report.responses.freshA = await list(fresh); assert.equal(report.responses.freshA.error, false); assert.match(report.responses.freshA.text, /Profile A fixture note/);
  await page.locator('#bw-cloud-archive-toggle').click();
  await page.locator('#bw-cloud-archive', { hasText: 'Profile A fixture note' }).waitFor();
  await page.screenshot({ path: path.join(out, 'fresh-a.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(720, 760));
  await page.waitForFunction(() => window.innerWidth === 720); await page.locator('#bw-pages-toggle').click();
  await page.screenshot({ path: path.join(out, 'narrow-a.png') });
  report.checks.push('Old A main/catalog/browser routes refuse; ordinary CLI and Full YOLO gate remain; explicit switch completes; old generations stay refused on return and fresh A works');
  let entered; const requested = new Promise(resolve => { entered = resolve; });
  const held = { owner: 'A', entered, release: null }; holdCatalog = held;
  const pendingRead = list(fresh); await requested;
  const switching = page.evaluate(async id => { await window.barkdown.profiles.select(id); }, report.owners.after);
  await page.waitForFunction(async () => { try { await window.barkdown.settings.get(); return false; } catch (error) { return /Profile switch is in progress/.test(error.message); } });
  assert.equal(await page.evaluate(() => window.__barkdown.state.profileId), ownerA, 'A remains selected while its owned request drains');
  held.release(); report.responses.inFlightSwitch = await pendingRead;
  assert.equal(report.responses.inFlightSwitch.error, true); assert.match(report.responses.inFlightSwitch.text, /profile_changed/);
  await switching; await page.reload();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, report.owners.after);
  report.checks.push('Actual profile selection waits for pending A HTTP work; interrupted command refuses success and B selection completes');
  report.status = 'passed'; persist();
} catch (error) { report.status = 'failed'; report.error = error.stack; persist(); if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw error; }
finally {
  // Keep the watchdog alive through cleanup: a failed switch can leave a stale renderer.
  try {
    for (const client of clients) await client.close().catch(() => {});
    if (app) { if (report.status === 'failed' && page) await page.reload().catch(() => {}); await app.close(); }
    for (const server of servers) await new Promise(resolve => server.close(resolve));
  } finally { clearTimeout(watchdog); }
}
