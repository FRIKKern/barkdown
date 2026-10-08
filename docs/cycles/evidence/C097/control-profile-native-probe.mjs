// Actual Electron profile selection and captured MCP connection; disposable HTTP catalogs only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root = process.cwd(), appRoot = path.join(root, 'app');
const require = createRequire(path.join(appRoot, 'package.json'));
const { _electron: electron } = require('playwright');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const out = path.resolve(process.env.BARKDOWN_CONTROL_PROFILE_OUT || 'docs/cycles/evidence/C097/control-profile-native-01');
if (fs.existsSync(out)) throw Error('Refusing to overwrite native evidence');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scope: 'Actual Windows Electron, Settings profile switch, captured stdio MCP and controlled HTTP catalogs; no real library or model', status: 'running', checks: [], responses: {}, requests: [] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const servers = [];
for (const owner of ['A', 'B']) {
  const server = http.createServer((req, res) => {
    report.requests.push({ owner, url: req.url });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ documents: [{ _id: 'same-slug', slug: 'same-slug', title: `Profile ${owner} fixture note` }], count: 1, total: 1, hasMore: false, offset: 0, limit: 200, nextOffset: null, perspective: 'published' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
}
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-control-profile-native-')));
let app, page; const clients = [];
const connect = async spec => { const client = new Client({ name: 'profile-ownership-proof', version: '0' }); clients.push(client); await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, env: { ...process.env, ...spec.env }, stderr: 'pipe' })); return client; };
const list = async client => { const r = await client.callTool({ name: 'app', arguments: { command: 'note.list' } }); return { error: Boolean(r.isError), text: r.content.map(c => c.text || '').join('\n') }; };
async function configure(owner, server) {
  await page.evaluate(async ({ owner, server }) => {
    const api = window.barkdown;
    await api.settings.set({ theme: 'dark', barkpark: { enabled: true, viaCli: false, server, dataset: 'production', local: { enabled: false } } });
    window.__barkdown.state.settings = await api.settings.get();
    document.documentElement.dataset.theme = 'dark';
    await window.__barkdown.refreshLibrary();
  }, { owner, server: `http://127.0.0.1:${server.address().port}` });
}
const watchdog = setTimeout(() => { report.status = 'timeout'; persist(); app?.process().kill(); process.exit(1); }, 90000);
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
  report.responses.currentB = await list(await connect(specB));
  assert.equal(report.responses.currentB.error, false); assert.match(report.responses.currentB.text, /Profile B fixture note/);
  report.checks.push('Actual Settings switch selects B; natural starter chat IDs and matching note slugs; new B bridge reads B'); persist();
  report.responses.oldA = await list(clientA); persist();
  await page.locator('#bw-cloud-archive-toggle').click();
  await page.locator('#bw-cloud-archive', { hasText: 'Profile B fixture note' }).waitFor();
  await page.screenshot({ path: path.join(out, 'active-b.png') });
  assert.equal(report.responses.oldA.error, true, 'A captured assistant bridge must refuse after the person selects B');
  report.status = 'passed'; persist();
} catch (error) { report.status = 'failed'; report.error = error.stack; persist(); if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw error; }
finally { clearTimeout(watchdog); for (const client of clients) await client.close().catch(() => {}); if (app) await app.close(); for (const server of servers) await new Promise(resolve => server.close(resolve)); }
