// Actual Electron, renderer and generated CLI; HTTP catalog responses are controlled fixtures.
// No real library, provider, save or Mac-transfer claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url), appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.env.BARKDOWN_CATALOG_CONTROL_OUT || path.join(appRoot, '../docs/cycles/evidence/C097/catalog-control-native-01'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-catalog-command-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: appRoot, encoding: 'utf8' }).trim() !== '', scope: 'Actual Windows Electron and generated CLI, controlled HTTP catalog; no real server or provider claim', status: 'running', checks: [], transcript: [], requests: [], images: [] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
let mode = 'known', app, page;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 200);
  report.requests.push({ mode, path: url.pathname, offset });
  if (mode === 'cold-refusal' || (mode === 'partial-refusal' && offset > 0)) { res.writeHead(403, { 'content-type': 'text/plain' }); res.end('Fixture permission lost on page 2'); return; }
  if (url.pathname !== '/v1/data/query/production/paper') { res.writeHead(404); res.end('Unexpected fixture request'); return; }
  const all = mode === 'empty' ? [] : mode === 'known' ? [{ _id: 'known', slug: 'known', title: 'Known catalog note' }] : Array.from({ length: 201 }, (_, i) => ({ _id: `fresh-${i}`, slug: `fresh-${i}`, title: `Fresh catalog note ${i}` }));
  const documents = all.slice(offset, offset + limit), hasMore = offset + documents.length < all.length;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ documents, limit, offset, count: documents.length, total: all.length, perspective: 'published', hasMore, nextOffset: hasMore ? offset + limit : null }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const launcher = path.join(userData, 'bin', process.platform === 'win32' ? 'barkdown.cmd' : 'barkdown');
const list = () => new Promise((resolve, reject) => {
  const env = { ...process.env }; delete env.BARKDOWN_CONTROL;
  const child = spawn(launcher, ['--user-data', userData, 'note', 'list', '--json'], { env, shell: process.platform === 'win32' });
  let stdout = '', stderr = ''; child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; }); child.once('error', reject);
  child.once('close', code => { const result = { code, stdout, stderr }; report.transcript.push(result); persist(); resolve({ code, value: JSON.parse(stdout || stderr) }); }); child.stdin.end();
});
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.images.push(name + '.png'); persist(); };
const check = name => { report.checks.push(name); console.log('ok ' + name); persist(); };
const watchdog = setTimeout(() => { report.status = 'timeout'; persist(); app?.process().kill(); process.exit(1); }, 120000);
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.evaluate(async server => {
    const x = window.__barkdown;
    x.state.settings = await window.barkdown.settings.set({ theme: 'dark', barkpark: { enabled: true, viaCli: false, server, dataset: 'production', local: { enabled: false } } });
    document.documentElement.dataset.theme = 'dark';
    await x.refreshLibrary();
  }, `http://127.0.0.1:${server.address().port}`);
  let result = await list(); assert.equal(result.code, 0); assert.equal(result.value.result[0].id, 'known');
  // Place the known note through the UI so preservation checks cover human Pages.
  await page.locator('#bw-cloud-archive-toggle').click();
  await page.locator('#bw-cloud-archive .bw-archive-row').first().hover();
  await page.locator('#bw-cloud-archive [data-place]').first().click();
  const before = await page.evaluate(() => structuredClone(window.__barkdown.state.pages));
  mode = 'partial-refusal'; result = await list(); assert.equal(result.code, 1); assert.equal(result.value.ok, false); assert.equal(result.value.error.code, 'catalog_unavailable');
  assert.match(result.value.error.message, /403 Forbidden/);
  assert(report.requests.some(r => r.mode === 'partial-refusal' && r.offset === 199));
  assert.equal(await page.evaluate(() => window.__barkdown.state.barkparkDocs[0].id), 'known');
  assert.deepEqual(await page.evaluate(() => window.__barkdown.state.pages), before);
  await page.locator('.bw-library-notice', { hasText: 'Showing last known papers.' }).waitFor();
  await page.locator('#bw-pages', { hasText: 'Known catalog note' }).waitFor();
  await shot('cached-refusal'); check('CLI exits 1 after page-2 refusal; known note and human Pages remain visible and unchanged');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(720, 760));
  await page.waitForFunction(() => window.innerWidth === 720);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('#bw-pages-toggle').click();
  await page.locator('#bw-library-retry').focus(); assert.equal(await page.locator('#bw-library-retry').evaluate(el => el === document.activeElement), true);
  await shot('narrow-refusal');
  mode = 'fresh'; await page.locator('#bw-library-retry').click();
  await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length === 201 && !window.__barkdown.state.barkparkLibraryError);
  result = await list(); assert.equal(result.code, 0); assert.equal(result.value.result.length, 201); assert(result.value.result.every(n => n.id.startsWith('fresh-')));
  await page.locator('#bw-pages-toggle').click();
  await shot('retry-fresh'); check('Visible Retry and subsequent command return all 201 fresh notes');
  mode = 'empty'; result = await list(); assert.equal(result.code, 0); assert.deepEqual(result.value.result, []);
  mode = 'cold-refusal'; result = await list(); assert.equal(result.code, 1); assert.equal(result.value.error.code, 'catalog_unavailable');
  await page.locator('.bw-library-notice', { hasText: 'Paper library unavailable.' }).waitFor(); await shot('empty-refusal');
  check('Genuine empty success is distinguished from an unavailable uncached library');
  report.status = 'passed'; persist();
} catch (error) { report.status = 'failed'; report.error = error.stack; persist(); if (page) await shot('failure').catch(() => {}); throw error; }
finally { clearTimeout(watchdog); if (app) await app.close(); await new Promise(resolve => server.close(resolve)); }
