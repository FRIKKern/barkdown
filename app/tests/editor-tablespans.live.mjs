import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture, paperFixtureScope } from './lib/paper-fixture.mjs';
// Plan #24: tables — merge and split cells. Select two cells and merge: the canvas shows one cell spanning
// two columns and the server holds the same grid (a placeholder for the covered position) plus `spans`;
// type into the merged cell; Tab skips the covered position; the reader page renders colspan on the
// origin and no <td> for what it covers; merge down makes a rowspan; split restores the plain grid;
// a reload agrees. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-tablespans';
const t = v => [{ type: 'text', value: v }];
publishFixture({ slug: SLUG, title: 'Cells that merge and split', description: 'Scratch paper for the Barkdown merged-cells row: a three-by-three table whose cells are merged across columns and rows from the canvas chrome, typed into, split again, and compared with the server and the reader page after each step. Rewritten on every run of tests/editor-tablespans.live.mjs.', blocks: [
  { type: 'heading', level: 1, text: 'Cells that merge and split' },
  para('A table:'),
  { type: 'table', head: [t('A'), t('B'), t('C')], rows: [[t('a1'), t('b1'), t('c1')], [t('a2'), t('b2'), t('c2')], [t('a3'), t('b3'), t('c3')]] },
] });
const server = paperFixtureScope().server.replace(/\/$/, '');
const base = server.replace(/\/$/, '');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-tablespans-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async () => { await openFixturePaper(page, SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); await page.waitForTimeout(500); };
await open();

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const settled = async () => { await page.waitForFunction(() => !/Saving/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(400); };
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// The canvas table as visible rows of [text, colspan, rowspan]; header cells prefixed with '#'.
const canvasGrid = () => page.evaluate(() => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; const table = ed.getJSON().content.find(n => n.type === 'bpTable'); return (table.content || []).map(r => (r.content || []).map(c => [(c.type === 'bpTableHeaderCell' ? '#' : '') + (c.content || []).map(x => x.text || '').join(''), c.attrs?.colspan || 1, c.attrs?.rowspan || 1])); });
const serverTable = () => { const b = getPaper(SLUG).blocks.find(x => x.type === 'table'); return { rows: b.rows.map(r => r.map(c => (Array.isArray(c) ? c : c?.content || []).map(n => n.value || '').join(''))), spans: b.spans || null }; };
const waitServer = async pred => { for (let i = 0; i < 20; i++) { const s = serverTable(); if (pred(s)) return s; await page.waitForTimeout(1000); } return serverTable(); };
// The caret / a selection across body cells, placed through ProseMirror: (rowIndex, cellIndex) over VISIBLE cells.
// A real click on the first cell (the table's chrome shows on hover / focus-within), then the selection through ProseMirror.
const selectCells = async (from, to) => { const rect = await page.evaluate(a => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; let found = null; ed.state.doc.descendants((node, pos) => { if (found) return false; if (node.type.name === 'bpTable') { let ri = 0; node.forEach((rowNode, rowOff) => { let ci = 0; rowNode.forEach((cell, cellOff) => { if (ri === a[0] && ci === a[1]) found = pos + 1 + rowOff + 1 + cellOff; ci++; }); ri++; }); return false; } }); const dom = found != null ? ed.view.nodeDOM(found) : null; const r = dom?.getBoundingClientRect?.(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, from); if (rect) { await page.mouse.click(rect.x, rect.y); await page.waitForTimeout(120); } return selectCellsPm(from, to); };
const selectCellsPm = (from, to) => page.evaluate(([a, b]) => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; const cells = []; ed.state.doc.descendants((node, pos) => { if (node.type.name === 'bpTable') { let ri = 0; node.forEach((rowNode, rowOff) => { let ci = 0; rowNode.forEach((cell, cellOff) => { cells.push({ r: ri, c: ci, start: pos + 1 + rowOff + 1 + cellOff + 1, end: pos + 1 + rowOff + 1 + cellOff + 1 + cell.content.size }); ci++; }); ri++; }); return false; } }); const A = cells.find(x => x.r === a[0] && x.c === a[1]); const B = b ? cells.find(x => x.r === b[0] && x.c === b[1]) : A; ed.commands.setTextSelection({ from: A.end, to: B.end }); ed.commands.focus(); return { A, B }; }, [from, to]);
const chromeBtn = async name => { const d = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas details:has(summary:has-text("Configure table"))').first(); if (!(await d.evaluate(el => el.open).catch(() => false))) await d.locator('summary').click(); return page.locator(`.bw-paper-pane:not([hidden]) bp-paper-canvas [data-table-action="${name}"]`).first(); };
const readerRow = async () => { const html = await (await fetch(`${base}/papers/${SLUG}`)).text(); const table = /<table[^>]*class="bp-table"[\s\S]*?<\/table>/.exec(html)?.[0] || ''; const trs = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]); return trs.map(tr => [...tr.matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g)].map(m => [m[2].replace(/<[^>]+>/g, ''), /colspan="(\d+)"/.exec(m[1])?.[1] || '1', /rowspan="(\d+)"/.exec(m[1])?.[1] || '1'])); };

await row('select two cells across columns and merge: the canvas shows one cell with colspan 2; the server holds the placeholder and the span', async () => {
  await selectCells([1, 0], [1, 1]);
  await (await chromeBtn('merge')).click();
  await settled();
  const g = await canvasGrid();
  const s = await waitServer(x => Array.isArray(x.spans) && x.spans.length === 1);
  return { pass: same(g[1], [['a1b1', 2, 1], ['c1', 1, 1]]) && same(s.rows[0], ['a1b1', '', 'c1']) && same(s.spans, [{ row: 0, col: 0, colspan: 2, rowspan: 1 }]), canvas: g[1], server: s };
});
await row('typing into the merged cell lands on the server; Tab from it moves to the cell after the covered position', async () => {
  await selectCells([1, 0]);
  await page.keyboard.type('!');
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; return ed.state.selection.$from.parent.textContent; });
  await settled();
  const s = await waitServer(x => x.rows[0][0] === 'a1b1!');
  return { pass: s.rows[0][0] === 'a1b1!' && next === 'c1' && same(s.spans, [{ row: 0, col: 0, colspan: 2, rowspan: 1 }]), next, server: s };
});
await row('the reader page renders colspan="2" on the origin and no cell for the covered position', async () => {
  const r = await readerRow();
  return { pass: r.length === 4 && r[1].length === 2 && r[1][0][1] === '2' && r[1][0][0] === 'a1b1!' && r[2].length === 3, reader: r };
});
await row('merge down from a cell makes a rowspan; the row below loses that cell in the canvas; the server holds both spans', async () => {
  await selectCells([2, 2]);
  await (await chromeBtn('merge')).nth(0);
  const btn = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .bp-canvas-table__rail--merge button', { hasText: 'merge ↓' }).first();
  await btn.click();
  await settled();
  const g = await canvasGrid();
  const s = await waitServer(x => Array.isArray(x.spans) && x.spans.length === 2);
  return { pass: same(g[2], [['a2', 1, 1], ['b2', 1, 1], ['c2c3', 1, 2]]) && g[3].length === 2 && same(s.spans, [{ row: 0, col: 0, colspan: 2, rowspan: 1 }, { row: 1, col: 2, colspan: 1, rowspan: 2 }]) && same(s.rows[2], ['a3', 'b3', '']), canvas: g.slice(2), server: s };
});
await row('split the column span: the placeholder becomes a plain cell again; the server keeps only the rowspan', async () => {
  await selectCells([1, 0]);
  await (await chromeBtn('split')).click();
  await settled();
  const g = await canvasGrid();
  const s = await waitServer(x => Array.isArray(x.spans) && x.spans.length === 1);
  return { pass: same(g[1], [['a1b1!', 1, 1], ['', 1, 1], ['c1', 1, 1]]) && same(s.spans, [{ row: 1, col: 2, colspan: 1, rowspan: 2 }]), canvas: g[1], server: s };
});
await row('split the last span: the server drops the list (spans: [] on the patch)', async () => {
  await selectCells([2, 2]);
  await (await chromeBtn('split')).click();
  await settled();
  const g = await canvasGrid();
  const s = await waitServer(x => !x.spans || x.spans.length === 0);
  return { pass: g.every(r => r.every(c => c[1] === 1 && c[2] === 1)) && g[3].length === 3 && (!s.spans || s.spans.length === 0), canvas: g, server: s };
});
await row('merge again, then reload: the merged grid comes back from the server as shown', async () => {
  await selectCells([1, 1], [2, 2]);
  await (await chromeBtn('merge')).click();
  await settled();
  const before = await canvasGrid();
  await waitServer(x => Array.isArray(x.spans) && x.spans.length === 1);
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await open();
  const after = await canvasGrid();
  const s = serverTable();
  return { pass: same(before, after) && same(s.spans, [{ row: 0, col: 1, colspan: 2, rowspan: 2 }]) && same(after[1], [['a1b1!', 1, 1], ['c1b2c2c3', 2, 2]]) && same(s.rows[0], ['a1b1!', 'c1b2c2c3', '']), before, after, server: s };
});

await page.screenshot({ path: 'test-results/46-tablespans.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
