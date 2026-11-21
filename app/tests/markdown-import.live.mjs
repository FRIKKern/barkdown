// Actual Electron + owned local Paper runtime: Pages › Import Markdown turns a small vault into notes.
// The folder dialog is stubbed in main (as other live tests stub dialogs); everything after it is the
// real IPC, journal, media upload and Paper create. Also: the same selection again creates nothing,
// a 200-file folder interrupted by a profile switch and by quitting finishes once, with no duplicates.
// Run: heavy env TMPDIR=/private/tmp/ BARKDOWN_TEST_BP_SOURCE=<packaged runtime> node tests/markdown-import.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from './lib/playwright.mjs';
import { tinyPng } from './png.mjs';
import { fixtureFolder } from './lib/fixture-folder.mjs';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required (BARKDOWN_TEST_BP_SOURCE)');
const appDir = path.resolve('.'), base = fixtureFolder('bd-md-import-live-');
const userData = path.join(base, 'user-data'), out = path.join(appDir, 'test-results/markdown-import', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const HEX = '0123456789abcdef0123456789abcdef';
const write = (rel, body) => { const file = path.join(base, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
write('Garden/Plants.md', '---\ntitle: Plants of the garden\n---\n# Plants of the garden\n\nSaffron crocus grows by the wall.\n\n![A crocus](img/crocus.png)\n\nSee [[Tools]] and ![[gone.png]].\n\n' +
  `Never [run this](javascript:alert(1)) or [that](data:text/html,x); read [the guide](https://example.com/guide) and [Tools](Tools%20${HEX}.md).\n`);
write('Garden/img/crocus.png', tinyPng(48, 32, [200, 120, 40]));
write(`Garden/Tools ${HEX}.md`, '# Tools\n\nA trowel and a rake.');
write(`Garden/Tools ${HEX}/Trowel.md`, 'Steel, with an ash handle.');
write('Garden/.obsidian/workspace.md', '# not a note');
for (let i = 1; i <= 200; i++) write(`Bulk/note-${String(i).padStart(3, '0')}.md`, `# Bulk ${i}\n\nSmall note number ${i}.`);
const results = [], errors = [];
let app, page;
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', '--user-data=' + userData], timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
};
const configure = () => page.evaluate(async source => {
  const b = window.__barkdown; b.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } });
  document.documentElement.dataset.theme = 'dark'; await b.refreshLibrary(); b.render();
}, source);
const choose = folder => app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
const docs = () => page.evaluate(async () => { await window.__barkdown.refreshLibrary(); return window.__barkdown.state.barkparkDocs.map(d => ({ id: d.id, title: d.title, paperOwner: d.paperOwner })); });
const toast = text => page.locator('.bw-toast').filter({ hasText: text }).first().waitFor({ timeout: 900000 });
const importFrom = async folder => { await choose(folder); await page.locator('#bw-import-markdown').click(); };
const select = async id => {
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(id); await page.locator('#profile-switch').click();
  await page.waitForFunction(id => window.__barkdown?.state.profileId === id && window.__barkdown?.state.loaded, id, { timeout: 180000 });
};
const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, name + '.png') }); };
try {
  await launch(); await configure();
  const profileA = await page.evaluate(() => window.__barkdown.state.profileId);

  // 1. A small vault through the real Pages button.
  await importFrom(path.join(base, 'Garden'));
  await toast('Imported 4 notes, 1 image missing');
  await shot('01-imported-summary');
  const library = await docs(), named = title => library.find(d => d.title === title);
  for (const title of ['Garden', 'Plants of the garden', 'Tools', 'Trowel']) assert(named(title), 'missing note ' + title);
  assert(!library.some(d => d.title === 'not a note'), '.obsidian stays out');
  const tree = await page.evaluate(() => structuredClone(window.__barkdown.state.pages));
  const key = d => `bp:v1:${d.paperOwner}:${encodeURIComponent(d.id)}`;
  assert(tree.roots.includes(key(named('Garden'))));
  assert.deepEqual(tree.children[key(named('Garden'))], [key(named('Plants of the garden')), key(named('Tools'))]);
  assert.deepEqual(tree.children[key(named('Tools'))], [key(named('Trowel'))]);
  const titles = await page.locator('#bw-pages .bw-page-title').allInnerTexts();
  for (const title of ['Garden', 'Plants of the garden', 'Tools', 'Trowel']) assert(titles.includes(title), 'Pages shows ' + title);
  const plants = await page.evaluate(d => window.barkdown.barkpark.get(d.id, undefined, d.paperOwner), named('Plants of the garden'));
  assert.equal(plants.title, 'Plants of the garden');
  assert.equal(plants.blocks.filter(b => b.type === 'heading' && b.level === 1).length, 1, 'the H1 is not repeated under the title');
  assert(!JSON.stringify(plants.blocks).includes('title:'), 'front matter is not in the body');
  const image = plants.blocks.find(b => b.type === 'image');
  assert(image && /\/media\//.test(image.src) && image.alt === 'A crocus', 'image uploaded: ' + JSON.stringify(image));
  assert(JSON.stringify(plants.blocks).includes(`"docId":"${named('Tools').id}"`), 'the wiki link points at the imported Tools note');
  assert(JSON.stringify(plants.blocks).includes('missing image: gone.png'));
  // Only links the reader allows are stored; the rest keep their words. A link to another imported file stays a note link.
  const hrefs = [...JSON.stringify(plants.blocks).matchAll(/"href":"([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(hrefs, ['https://example.com/guide'], 'stored hrefs: ' + hrefs.join(', '));
  assert.match(JSON.stringify(plants.blocks), /Never run this or that; read /);
  assert.equal((JSON.stringify(plants.blocks).match(new RegExp(`"docId":"${named('Tools').id}"`, 'g')) || []).length, 2, 'both links to Tools point at the imported note');
  await page.evaluate(d => window.__barkdown.openDirect(d.id, 'barkpark', d.paperOwner), named('Plants of the garden'));
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.bw-paper-pane:not([hidden]) .ProseMirror img')].some(img => img.complete && img.naturalWidth === 48), null, { timeout: 30000 });
  await shot('02-imported-note-with-image');
  results.push('Garden vault: 4 notes, folder nesting and Notion pairing in Pages, title without duplicate H1, image uploaded and shown, wiki link to the imported note, missing image counted');

  // 2. The same selection again creates nothing.
  await importFrom(path.join(base, 'Garden'));
  await toast('Imported 0 notes, 4 already imported');
  assert.equal((await docs()).filter(d => d.title === 'Plants of the garden').length, 1);
  results.push('Same selection again: 0 created, 4 already imported, no duplicate');

  // 3. 200 files, interrupted by a profile switch, then by quitting; each rerun finishes the rest once.
  const profileB = (await page.evaluate(() => window.barkdown.profiles.create('Other notebook'))).id;
  const started = Date.now();
  await importFrom(path.join(base, 'Bulk'));
  const reached = n => page.waitForFunction(n => Number(/Importing (\d+) of/.exec(document.querySelector('#bw-import-status')?.textContent || '')?.[1]) >= n, n, { timeout: 900000, polling: 250 });
  await reached(20);
  const lag = await page.evaluate(async () => { let worst = 0; for (let i = 0; i < 10; i++) { const t = performance.now(); await new Promise(r => requestAnimationFrame(() => r())); worst = Math.max(worst, performance.now() - t); } return worst; });
  assert(lag < 500, 'the window stays responsive during import; worst frame ' + lag + ' ms');
  await shot('03-bulk-progress');
  await select(profileB); await configure();
  assert(!(await docs()).some(d => /^Bulk \d+$/.test(d.title)), 'nothing from the interrupted import lands in the other profile');
  await select(profileA); await configure();
  const afterSwitch = (await docs()).filter(d => /^Bulk \d+$/.test(d.title)).length;
  assert(afterSwitch > 0 && afterSwitch < 200, 'switch interrupted the import at ' + afterSwitch);
  await importFrom(path.join(base, 'Bulk'));
  await reached(afterSwitch + 15);
  await app.close(); app = null;
  await launch(); await configure();
  assert.equal(await page.evaluate(() => window.__barkdown.state.profileId), profileA);
  await importFrom(path.join(base, 'Bulk'));
  await toast(/Imported \d+ notes?, \d+ already imported/);
  const bulk = (await docs()).filter(d => /^Bulk \d+$/.test(d.title));
  assert.equal(bulk.length, 200, 'exactly 200 bulk notes after two interruptions');
  assert.equal(new Set(bulk.map(d => d.title)).size, 200);
  assert.equal((await docs()).filter(d => d.title === 'Bulk').length, 1, 'one folder note');
  results.push(`200 files: interrupted by a profile switch at ${afterSwitch} and by quitting, rerun finished with exactly 200 notes (${Math.round((Date.now() - started) / 1000)} s total, worst frame ${Math.round(lag)} ms)`);
  await shot('04-bulk-finished');
  assert.deepEqual(errors, []);
  console.log('PASS', results);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  console.error('FAIL', results, errors);
  throw error;
} finally {
  if (app) await app.close().catch(() => {});
  console.log('Evidence:', out, 'Retained data:', base);
}
