// Plan #25: tables — column resize. Drag a column's edge in the canvas: the column takes the new width at
// once, the server holds it as `cols[i].width`, a reload shows the same width, and the paper page renders
// a <colgroup> with it. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-tablewidths';
const t = v => [{ type: 'text', value: v }];
publishFixture({ slug: SLUG, title: 'Columns that take a width', description: 'Scratch paper for the Barkdown column-resize row: a three-column table whose first column is dragged wider in the canvas; the width must land on the server, survive a reload and reach the reader page as a colgroup. Rewritten on every run of tests/editor-tablewidths.live.mjs.', blocks: [
  { type: 'heading', level: 1, text: 'Columns that take a width' },
  para('A table:'),
  { type: 'table', head: [t('Name'), t('Qty'), t('Note')], rows: [[t('Apple'), t('3'), t('crisp')], [t('Pear'), t('5'), t('soft')]] },
] });
const server = (JSON.parse(execFileSync('bp', ['use', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })).active || {}).server || 'http://localhost:4000';
const base = server.replace(/\/$/, '');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-tablewidths-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async () => { await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); await page.waitForTimeout(500); };
await open();

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const settled = async () => { await page.waitForFunction(() => !/Saving/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(400); };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const table = () => page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas table.bp-table').first();
const colWidths = () => page.evaluate(() => Array.from(document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas table.bp-table colgroup')?.children || []).map(c => c.style.width || null));
const cellWidths = () => page.evaluate(() => Array.from(document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas table.bp-table tr')?.cells || []).map(c => Math.round(c.getBoundingClientRect().width)));
const serverCols = () => { const b = getPaper(SLUG).blocks.find(x => x.type === 'table'); return b.cols || null; };
const waitServer = async pred => { for (let i = 0; i < 20; i++) { const c = serverCols(); if (pred(c)) return c; await page.waitForTimeout(1000); } return serverCols(); };
const readerColgroup = async () => { const html = await (await fetch(`${base}/papers/${SLUG}`)).text(); return /<table[^>]*class="bp-table">(<colgroup>.*?<\/colgroup>)?/.exec(html)?.[1] || null; };

let before = null, target = null;
await row('a fresh table has no column widths in the canvas or on the server', async () => {
  before = await cellWidths();
  return { pass: (await colWidths()).every(w => !w) && serverCols() === null, before, server: serverCols() };
});
await row('dragging the first column\'s edge 80px to the right widens it at once; the server holds cols[0].width', async () => {
  await pm.locator('.bp-table__th').first().click();
  const box = await table().boundingBox();
  await page.mouse.move(box.x + 20, box.y + 10); await page.waitForTimeout(250);
  const grip = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .bp-canvas-table__resize[data-col="0"]').first();
  const gb = await grip.boundingBox();
  if (!gb) return { pass: false, error: 'no resize grip on the first column' };
  target = before[0] + 80;
  await page.mouse.move(gb.x + gb.width / 2, gb.y + 20, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2 + 80, gb.y + 20, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const widths = await colWidths();
  const cells = await cellWidths();
  await settled();
  const server = await waitServer(c => Array.isArray(c) && Number.isInteger(c[0]?.width));
  const w = server?.[0]?.width;
  return { pass: widths[0] === `${target}px` && Math.abs(cells[0] - target) <= 3 && Math.abs(w - target) <= 3, widths, cells, server };
});
await row('the paper page renders a colgroup with the width', async () => {
  const cg = await readerColgroup();
  return { pass: !!cg && cg.includes(`<col style="width:${target}px">`) && (cg.match(/<col[ >]/g) || []).length === 3, colgroup: cg };
});
await row('reload: the width comes back from the server as shown', async () => {
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await open();
  const widths = await colWidths(); const cells = await cellWidths();
  return { pass: widths[0] === `${target}px` && Math.abs(cells[0] - target) <= 3, widths, cells };
});
await row('the reader\'s column types survive beside the width: a second drag keeps cols as one list', async () => {
  await pm.locator('.bp-table__th').nth(1).click();
  const box = await table().boundingBox();
  await page.mouse.move(box.x + 20, box.y + 10); await page.waitForTimeout(250);
  const grip = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .bp-canvas-table__resize[data-col="1"]').first();
  const gb = await grip.boundingBox();
  if (!gb) return { pass: false, error: 'no resize grip on the second column' };
  await page.mouse.move(gb.x + gb.width / 2, gb.y + 20, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2 + 40, gb.y + 20, { steps: 8 });
  await page.mouse.up();
  await settled();
  const server = await waitServer(c => Array.isArray(c) && Number.isInteger(c[1]?.width));
  return { pass: Array.isArray(server) && server.length >= 2 && server[0].width === target && Number.isInteger(server[1].width), server };
});

await page.screenshot({ path: 'test-results/47-tablewidths.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
