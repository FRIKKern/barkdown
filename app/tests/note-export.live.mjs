// Export a note, in real Electron on the carried runtime: a Paper note with a heading, a link, a nested list, a
// task list, a table, code and two pictures (one uploaded to the profile's library, one on another site) is
// exported from the note's Export menu as Markdown (pictures in a new folder beside it), HTML (pictures
// embedded) and PDF (printed with nothing remote), and copied as Markdown. The note is only read: its blocks
// and revision stay the same. A cancelled dialog writes nothing; a picture folder that is already there is
// left alone. The save dialog is answered by the test. Run: TMPDIR=/private/tmp/ heavy node tests/note-export.live.mjs
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
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { releaseOf } = require('../main/local-barkpark-source');
const { markdownToDoc } = require('../shared/markdown');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
if (!releaseOf(release)?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const out = process.env.BARKDOWN_EXPORT_OUT || path.resolve('../docs/cycles/evidence/note-export/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-export-')));
const exportDir = fs.realpathSync(fs.mkdtempSync(path.join(process.env.BARKDOWN_EXPORT_FILES || os.tmpdir(), 'bd-export-files-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['The save dialog is answered by the test (dialog.showSaveDialog replaced in main); one Mac, from source under Electron on the carried runtime.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

// A 2x2 PNG: the uploaded picture; a second copy is served by another site.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP4z8DwHwyBNIgBEQEAo/sH+TlPqzcAAAAASUVORK5CYII=', 'base64');
const OTHER = Buffer.concat([PNG]);
const server = http.createServer((req, res) => { if (req.url === '/other.png') { res.setHeader('Content-Type', 'image/png'); return res.end(OTHER); } res.statusCode = 404; res.end('no'); }).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const site = `http://127.0.0.1:${server.address().port}`;

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Export desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const errors = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const toast = async text => { await page.locator('.bw-toast', { hasText: text }).last().waitFor({ timeout: 60000 }); return page.locator('.bw-toast', { hasText: text }).last().innerText(); };
const clearToasts = () => page.evaluate(() => document.querySelectorAll('.bw-toast').forEach(t => t.remove()));
const answerSave = file => app.evaluate(({ dialog }, chosen) => { globalThis.__exportAsked = []; dialog.showSaveDialog = async (_win, options) => { globalThis.__exportAsked.push(options); return chosen ? { canceled: false, filePath: chosen } : { canceled: true, filePath: '' }; }; }, file);
const asked = () => app.evaluate(() => globalThis.__exportAsked || []);
const pane = () => page.locator('.bw-paper-pane:not([hidden])');
const choose = async format => {
  await pane().locator('[data-act="export"]').click();
  await page.locator('.bw-export-menu').waitFor();
  await page.locator(`.bw-export-menu [data-format="${format}"]`).click();
};
const t = value => ({ type: 'text', value });
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await new Promise(r => setTimeout(r, 200)); }

  // The note: made in the profile's library, with a picture uploaded there and one on another site.
  const made = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  const fresh = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), made);
  const media = await page.evaluate(({ binding, data }) => window.barkdown.barkpark.uploadMedia({ binding, name: 'map.png', mime: 'image/png', dataUrl: 'data:image/png;base64,' + data }), { binding: fresh.binding, data: PNG.toString('base64') });
  assert(/^https?:/.test(media.src), 'the upload gives an address: ' + JSON.stringify(media));
  const blocks = [
    { type: 'heading', level: 1, text: 'Trip plan' },
    { type: 'paragraph', content: [t('Bring '), { type: 'strong', children: [t('boots')] }, t(' and read '), { type: 'link', href: 'https://example.com/guide', children: [t('the guide')] }, t('.')] },
    { type: 'list', ordered: false, items: [[t('Tent')], { content: [t('Stove')], children: [{ type: 'list', ordered: true, items: [[t('Gas')]] }] }] },
    { type: 'list', task: true, items: [{ content: [t('Book the hut')], checked: true }, { content: [t('Pack')], checked: false }] },
    { type: 'table', head: [[t('Day')], [t('Km')]], rows: [[[t('Mon')], [t('12')]], [[t('Tue')], [t('9')]]] },
    { type: 'code', lang: 'js', value: 'const pack = ["tent"];' },
    { type: 'image', src: media.src, alt: 'Route map' },
    { type: 'image', src: site + '/other.png', alt: 'Other site' },
    { type: 'paragraph', content: [t('<script>alert(1)</script> [click](javascript:alert(2))')] },
  ];
  const applied = await page.evaluate(({ id, blocks, rev, binding }) => window.barkdown.barkpark.applyOps(id, blocks.map(block => ({ op: 'append-block', block })), rev, binding), { id: made.id, blocks, rev: fresh.rev, binding: fresh.binding });
  assert(applied.ok);
  const before = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), made);
  const stable = paper => JSON.stringify({ rev: paper.rev, revision: paper.revision, blocks: paper.blocks, title: paper.title });
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), made);
  await pane().locator('.ProseMirror', { hasText: 'Book the hut' }).waitFor();
  await page.waitForTimeout(800);

  // 1. Export as Markdown.
  const mdFile = path.join(exportDir, 'Trip plan.md');
  await answerSave(mdFile);
  await pane().locator('[data-act="export"]').click();
  await page.locator('.bw-export-menu').waitFor();
  const items = await page.locator('.bw-export-menu button').allInnerTexts();
  assert.deepEqual(items.map(s => s.trim()), ['Export as Markdown…', 'Export as HTML…', 'Export as PDF…', 'Copy as Markdown']);
  await shot('01-export-menu');
  await page.locator('.bw-export-menu [data-format="markdown"]').click();
  const mdToast = await toast('Exported to Trip plan.md');
  const md = fs.readFileSync(mdFile, 'utf8');
  assert(md.startsWith('# Trip plan\n\nBring'), 'the note starts with its heading: ' + md.slice(0, 60));
  for (const piece of [ 'Bring **boots** and read [the guide](https://example.com/guide).', '- Tent\n- Stove\n  1. Gas', '- [x] Book the hut\n- [ ] Pack',
    '| Day | Km |\n| --- | --- |\n| Mon | 12 |\n| Tue | 9 |', '```js\nconst pack = ["tent"];\n```', '![Route map](Trip%20plan_files/image-1.png)', '![Other site](Trip%20plan_files/image-2.png)', '\\<script\\>']) assert(md.includes(piece), `Markdown lacks ${piece}:\n${md}`);
  assert(!md.includes('](javascript:'));
  assert.deepEqual(fs.readFileSync(path.join(exportDir, 'Trip plan_files', 'image-1.png')), PNG, 'the library picture is taken along');
  assert.deepEqual(fs.readFileSync(path.join(exportDir, 'Trip plan_files', 'image-2.png')), OTHER, 'the other site\'s picture is taken along');
  assert(!JSON.stringify(markdownToDoc(md)).includes('"href":"javascript'), 'read back, no unsafe link');
  const firstAsk = (await asked())[0];
  assert.equal(path.basename(firstAsk.defaultPath), 'Trip plan.md'); assert.deepEqual(firstAsk.filters, [{ name: 'Markdown', extensions: ['md'] }]);
  check('Export as Markdown writes the chosen file: heading, link, nested list, task list, table, code; both pictures in Trip plan_files beside it', { toast: mdToast, bytes: md.length });

  // 2. Again to the same name: the existing pictures folder is left as it was; a new one is made.
  await clearToasts();
  fs.writeFileSync(path.join(exportDir, 'Trip plan_files', 'mine.txt'), 'kept');
  await answerSave(mdFile); await choose('markdown');
  await toast('Trip plan_files-2');
  assert.equal(fs.readFileSync(path.join(exportDir, 'Trip plan_files', 'mine.txt'), 'utf8'), 'kept');
  assert.deepEqual(fs.readdirSync(path.join(exportDir, 'Trip plan_files')).sort(), ['image-1.png', 'image-2.png', 'mine.txt']);
  assert(fs.readFileSync(mdFile, 'utf8').includes('](Trip%20plan_files-2/image-1.png)'));
  check('exporting again over the confirmed file leaves the earlier pictures folder untouched and makes Trip plan_files-2');

  // 3. A cancelled dialog writes nothing and says nothing.
  await clearToasts();
  const listing = fs.readdirSync(exportDir).sort();
  await answerSave(null); await choose('html');
  await page.waitForTimeout(1500);
  assert.deepEqual(fs.readdirSync(exportDir).sort(), listing);
  assert.equal(await page.locator('.bw-toast', { hasText: 'Exported' }).count(), 0);
  check('a cancelled save dialog writes nothing');

  // 4. Export as HTML: one file, pictures embedded, note text escaped.
  await clearToasts();
  const htmlFile = path.join(exportDir, 'Trip plan.html');
  await answerSave(htmlFile); await choose('html');
  const htmlToast = await toast('Exported to Trip plan.html');
  const html = fs.readFileSync(htmlFile, 'utf8');
  for (const piece of ['<title>Trip plan</title>', '<h1>Trip plan</h1>', '<a href="https://example.com/guide">the guide</a>', '<li>Stove<ol><li>Gas</li></ol></li>', '<thead><tr><th>Day</th><th>Km</th></tr></thead>',
    '<pre><code class="language-js">const pack = [&quot;tent&quot;];</code></pre>', `<img src="data:image/png;base64,${PNG.toString('base64')}" alt="Route map">`, '&lt;script&gt;alert(1)&lt;/script&gt;']) assert(html.includes(piece), `HTML lacks ${piece}`);
  assert(!/<script/i.test(html) && !/href="javascript/i.test(html));
  assert(!fs.existsSync(path.join(exportDir, 'Trip plan_files-3')), 'HTML makes no folder');
  check('Export as HTML writes one file with the pictures embedded and the note text escaped', { toast: htmlToast });

  // 5. Export as PDF.
  await clearToasts();
  const pdfFile = path.join(exportDir, 'Trip plan.pdf');
  await answerSave(pdfFile); await choose('pdf');
  const pdfToast = await toast('Exported to Trip plan.pdf');
  const pdf = fs.readFileSync(pdfFile);
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert(pdf.length > 2000, 'a real PDF: ' + pdf.length);
  const windows = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  assert.equal(windows, 1, 'the print window is gone');
  check('Export as PDF writes a PDF from a hidden window that is closed after', { toast: pdfToast, bytes: pdf.length });

  // 6. Copy as Markdown.
  await clearToasts();
  await app.evaluate(({ clipboard }) => clipboard.writeText('before'));
  const filesBefore = fs.readdirSync(exportDir).sort();
  await choose('copy');
  await toast('Copied as Markdown');
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  for (const piece of ['# Trip plan', '| Day | Km |', '- [x] Book the hut', `![Route map](${media.src})`, `![Other site](${site}/other.png)`]) assert(copied.includes(piece), `clipboard lacks ${piece}:\n${copied}`);
  assert.deepEqual(fs.readdirSync(exportDir).sort(), filesBefore, 'copy writes no file');
  await shot('02-copied');
  check('Copy as Markdown puts the Markdown on the clipboard with the pictures\' own addresses', { characters: copied.length });

  // 7. The note was only read.
  const after = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), made);
  assert.equal(stable(after), stable(before), 'blocks, revision and title are unchanged');
  check('the note is unchanged after every export: same blocks, revision and title', { rev: after.rev });

  fs.copyFileSync(htmlFile, path.join(out, 'export.html')); fs.copyFileSync(pdfFile, path.join(out, 'export.pdf'));
  fs.writeFileSync(path.join(out, 'export.md'), md); fs.writeFileSync(path.join(out, 'copied.md'), copied);
  assert.deepEqual(errors, []);
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ status: report.status, out }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1;
  if (page) await shot('failure').catch(() => {});
} finally { if (app) await app.close().catch(() => {}); server.close(); fs.rmSync(userData, { recursive: true, force: true }); fs.rmSync(exportDir, { recursive: true, force: true }); }
