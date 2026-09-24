import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture, paperFixtureScope } from './lib/paper-fixture.mjs';
// Plan #26: tables — header column and per-cell alignment. The chrome's header-column toggle turns each
// body row's first cell into a row header; the bubble's align buttons align the cell the caret sits in.
// The server holds `headCol` and the cell's `{ content, align }`, the paper page renders <th scope="row">
// and text-align on the cell, a reload agrees, and toggling the header column off lands as well.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-tablehead';
const t = v => [{ type: 'text', value: v }];
publishFixture({ slug: SLUG, title: 'Row headers and aligned cells', description: 'Scratch paper for the Barkdown header-column and cell-alignment row: a table whose first column becomes row headers from the chrome and whose cells are aligned from the bubble, compared with the server and the reader page after each step. Rewritten on every run of tests/editor-tablehead.live.mjs.', blocks: [
  { type: 'heading', level: 1, text: 'Row headers and aligned cells' },
  para('A table:'),
  { type: 'table', head: [t('Item'), t('Qty'), t('Price')], rows: [[t('Apple'), t('3'), t('1.20')], [t('Pear'), t('5'), t('0.90')]] },
] });
// Match the CLI request override used by the isolated runtime. `bp use` reports
// saved configuration, which can point the reader check at another server.
const server = paperFixtureScope().server.replace(/\/$/, '');
const base = server.replace(/\/$/, '');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-tablehead-'));
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
const row = async (name, fn) => {
  try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); }
  catch (e) {
    const failureImage = `test-results/tablehead-failure-${results.length}.png`;
    await page.screenshot({ path: failureImage });
    const state = await page.evaluate(() => {
      const canvas = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
      return { focused: document.hasFocus(), active: document.activeElement?.tagName,
        selection: canvas?._editor?.state.selection.toJSON(),
        buttons: [...document.querySelectorAll('.bp-paper-format__btn--align-left')].map(b => {
          const r=b.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return { display:getComputedStyle(b).display, rect:{x:r.x,y:r.y,width:r.width,height:r.height},
            bubbleDisplay:getComputedStyle(b.parentElement).display, hit:hit?.outerHTML.slice(0,600) };
        }) };
    });
    results.push({ name, pass: false, error: e.message, failureImage, state });
  }
};
const settled = async () => { await page.waitForFunction(() => !/Saving/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(400); };
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
// The canvas table rows as DOM: [tag, text, align] per cell.
const domGrid = () => page.evaluate(() => Array.from(document.querySelectorAll('.bw-paper-pane:not([hidden]) bp-paper-canvas table.bp-table tr')).map(tr => Array.from(tr.cells).map(c => [c.tagName.toLowerCase() + (c.getAttribute('scope') ? '[' + c.getAttribute('scope') + ']' : ''), c.textContent, c.style.textAlign || null])));
const serverTable = () => { const b = getPaper(SLUG).blocks.find(x => x.type === 'table'); return { headCol: b.headCol ?? null, rows: b.rows }; };
const waitServer = async pred => { for (let i = 0; i < 20; i++) { const s = serverTable(); if (pred(s)) return s; await page.waitForTimeout(1000); } return serverTable(); };
// Use the keyboard selection a person makes. An immediate synthetic PM
// selection after pointerup can be replaced by Chromium's queued DOM selection
// change (observed on Linux), leaving a caret and correctly hidden toolbar.
const clickCell = async (rowIndex, cellIndex, selectText = true) => {
  const cell = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas table.bp-table tr').nth(rowIndex).locator('td, th').nth(cellIndex);
  await cell.click();
  // Table chrome works at a caret; only the formatting bubble needs selected text.
  if (!selectText) return;
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  const expected = await cell.textContent();
  await page.waitForFunction(text => {
    const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;
    const { from, to } = ed.state.selection;
    return from < to && ed.state.doc.textBetween(from, to) === text;
  }, expected);
};
const chromeBtn = async name => { const d = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas details:has(summary:has-text("Configure table"))').first(); if (!(await d.evaluate(el => el.open).catch(() => false))) await d.locator('summary').click(); return page.locator(`.bw-paper-pane:not([hidden]) bp-paper-canvas [data-table-action="${name}"]`).first(); };
const readerRows = async () => { const html = await (await fetch(`${base}/papers/${SLUG}`)).text(); const table = /<table[^>]*class="bp-table"[\s\S]*?<\/table>/.exec(html)?.[0] || ''; return [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<(t[dh])([^>]*)>([\s\S]*?)<\/t[dh]>/g)].map(x => [x[1] + (/scope="row"/.test(x[2]) ? '[row]' : ''), x[3].replace(/<[^>]+>/g, ''), /text-align:(\w+)/.exec(x[2])?.[1] || null])); };

await row('the chrome\'s header-column toggle makes each body row\'s first cell a row header; the server holds headCol: true', async () => {
  await clickCell(1, 0, false);
  await (await chromeBtn('toggleHeadCol')).click();
  await settled();
  const g = await domGrid();
  const s = await waitServer(x => x.headCol === true);
  return { pass: g[1][0][0] === 'th[row]' && g[2][0][0] === 'th[row]' && g[1][1][0] === 'td' && g[0][0][0] === 'th' && s.headCol === true, canvas: g, server: s };
});
await row('the bubble\'s align-right button on the Qty cell aligns the CELL; the server holds { content, align: "right" }', async () => {
  await clickCell(1, 1);
  await page.locator('body .bp-paper-format__btn--align-right').first().click();
  await settled();
  const g = await domGrid();
  const s = await waitServer(x => x.rows[0][1]?.align === 'right');
  return { pass: g[1][1][2] === 'right' && same(s.rows[0][1], { content: t('3'), align: 'right' }) && Array.isArray(s.rows[0][0]), canvas: g[1], server: s.rows[0] };
});
await row('the paper page renders <th scope="row"> for the header column and text-align on the aligned cell', async () => {
  const r = await readerRows();
  return { pass: r.length === 3 && r[1][0][0] === 'th[row]' && r[2][0][0] === 'th[row]' && r[1][1][2] === 'right' && r[0][0][0] === 'th' && r[1][2][2] === null, reader: r };
});
await row('align-left on the same cell drops the attribute: the server holds the plain cell again', async () => {
  await clickCell(1, 1);
  await page.locator('body .bp-paper-format__btn--align-left').first().click();
  await settled();
  const s = await waitServer(x => Array.isArray(x.rows[0][1]));
  const g = await domGrid();
  return { pass: g[1][1][2] === null && same(s.rows[0][1], t('3')), server: s.rows[0] };
});
await row('centre the Price cell, reload: header column and alignment come back from the server as shown', async () => {
  await clickCell(2, 2);
  await page.locator('body .bp-paper-format__btn--align-center').first().click();
  await settled();
  await waitServer(x => x.rows[1][2]?.align === 'center');
  const before = await domGrid();
  await page.reload();
  await page.waitForSelector('#bw-pages .bw-page-row');
  await open();
  const after = await domGrid();
  return { pass: same(before, after) && after[2][2][2] === 'center' && after[1][0][0] === 'th[row]', before, after };
});
await row('toggling the header column off lands as headCol: false; the cells are plain <td> again', async () => {
  await clickCell(1, 0, false);
  await (await chromeBtn('toggleHeadCol')).click();
  await settled();
  const g = await domGrid();
  const s = await waitServer(x => x.headCol !== true);
  return { pass: g[1][0][0] === 'td' && s.headCol !== true, canvas: g[1], server: s.headCol };
});

await page.screenshot({ path: 'test-results/48-tablehead.png' });
const passed = results.filter(r => r.pass).length;
const report = JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1);
fs.writeFileSync('test-results/tablehead.json', report + '\n');
console.log(report);
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
