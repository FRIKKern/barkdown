// Row 10 of docs/EDITOR-PARITY.md: tables. What the Tiptap tab gives an author (TableKit: cells you type in,
// Tab / Shift+Tab between cells, Tab past the last cell adds a row, GFM tables from markdown) the canvas must give
// too, and the server must hold what the canvas shows. Live against the bp-connected server; not part of npm test.
// Red rows are expected until the canvas closes them; the point is that the list is checked, not assumed.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-tables';
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], { ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input }), shell: true, encoding: 'utf8', maxBuffer: 20e6 }));
// Newer servers run a publish wall: a new paper needs a description and registered, weighted tags.
for (const [id, title] of [['barkdown', 'Barkdown'], ['scratch', 'Scratch']]) { try { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); } catch (e) { console.error(`tag ${id}: ${(e.stdout || e.message).toString().slice(0, 200)}`); } }
bp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, title: 'Table probe', description: 'Scratch paper for the Barkdown table parity probe; rewritten on every run of tests/editor-tables.live.mjs.', tags: [{ tag: 'barkdown', strength: 90, rationale: 'owned by the Barkdown editor suite' }, { tag: 'scratch', strength: 40, rationale: 'disposable test fixture' }], blocks: [{ type: 'heading', level: 1, text: 'Table probe' }, { type: 'paragraph', content: [{ type: 'text', value: 'Start here.' }] }] }));
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-tables-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async () => { await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); };
await open();

// The canvas table as a grid of cell texts: [['Name','Qty'],['Apple','3']]; header cells prefixed with '#'.
const grids = () => page.evaluate(() => {
  const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
  const text = n => (n.content || []).map(x => x.text || '').join('');
  return c._editor.getJSON().content.filter(n => n.type === 'bpTable').map(t => t.content.map(row => row.content.map(cell => (cell.type === 'bpTableHeaderCell' ? '#' : '') + text(cell))));
});
const kinds = () => page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.getJSON().content.map(n => n.type));
const waitSaved = async () => { await page.waitForFunction(() => /Saved · rev|Not saved|Conflict/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); return page.locator('.bw-paper-pane:not([hidden]) #save-state').innerText(); };
// The server's table as the same grid shape, from the raw paper.
const serverGrids = () => { const r = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); const d = r.document || r; const text = cell => Array.isArray(cell) ? cell.map(x => x.value || x.text || '').join('') : typeof cell === 'string' ? cell : JSON.stringify(cell); return d.blocks.filter(b => b.type === 'table').map(t => [...(t.head?.length ? [t.head.map(c => '#' + text(c))] : []), ...(t.rows || []).map(row => (Array.isArray(row) ? row : row.cells || []).map(text))]); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Compare canvas and server once the UI says "Saved", then again 3s later: a later match means the save state
// showed too early; a persistent mismatch means an op was lost. Either is red — the author was told it was saved.
const compare = async () => { const save = await waitSaved(); await settle(); const canvas = await grids(); const server = serverGrids(); const pass = same(server, canvas); let serverLater; if (!pass) { await page.waitForTimeout(3000); serverLater = serverGrids(); } return { pass, save, canvas: canvas[0], server: server[0], ...(serverLater ? { serverLater: serverLater[0], lateMatch: same(serverLater, canvas) } : {}) }; };

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 200) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const paste = (text, html) => page.evaluate(([t, h]) => { const dt = new DataTransfer(); dt.setData('text/plain', t); if (h) dt.setData('text/html', h); document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [text, html || '']);
// The rails live inside a <details> ("Configure table"); open it before reaching for a button.
const chrome = async name => { const d = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas details:has(summary:has-text("Configure table"))').first(); if (!(await d.evaluate(el => el.open).catch(() => false))) await d.locator('summary').click(); return page.locator(`.bw-paper-pane:not([hidden]) bp-paper-canvas [aria-label*="${name}" i]`).first(); };
const settle = () => page.waitForTimeout(600);

await row('slash /table inserts a table with a header row', async () => {
  await pm.locator('p:has-text("Start here")').first().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.keyboard.type('/table'); await page.waitForTimeout(400); await page.keyboard.press('Enter'); await settle();
  const g = await grids(); return { pass: g.length === 1 && g[0].length >= 1 && g[0][0].every(c => c.startsWith('#')), grid: g[0] };
});
await row('typing in cells; Tab and Shift+Tab move between cells', async () => {
  await pm.locator('.bp-table__th').first().click(); await page.keyboard.type('Name'); await page.keyboard.press('Tab'); await page.keyboard.type('Qty');
  await page.keyboard.press('Tab'); await page.keyboard.type('Apple'); await page.keyboard.press('Tab'); await page.keyboard.type('3');
  // TableKit's Tab / Shift+Tab select the whole cell content (prosemirror-tables goToNextCell), so typing replaces it.
  await page.keyboard.press('Shift+Tab'); await page.keyboard.type('Pear'); await settle();
  const g = (await grids())[0]; return { pass: same(g, [['#Name', '#Qty'], ['Pear', '3']]), grid: g, expected: 'Shift+Tab selects the cell content, so typing replaces it (TableKit)' };
});
await row('server holds the typed cells after save', compare);
await row('Tab in the last cell adds a row (as TableKit does)', async () => {
  const before = (await grids())[0].length;
  await pm.locator('.bp-table__td').last().click(); await page.keyboard.press('End'); await page.keyboard.press('Tab');
  // The new row is a transaction of its own; type only once it exists (CI is slower than a laptop).
  await page.waitForFunction(n => { const t = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .bp-table'); return t && t.querySelectorAll('tr').length > n; }, before, { timeout: 5000 }).catch(() => {});
  await page.keyboard.type('Pear'); await settle();
  const g = (await grids())[0]; return { pass: g.length === before + 1 && g[before][0] === 'Pear', grid: g, before };
});
await row('chrome: add column, add row', async () => {
  await pm.locator('.bp-table__td').first().click();
  await (await chrome('add column')).click(); await settle(); await (await chrome('add row')).click(); await settle();
  const g = (await grids())[0]; return { pass: g.every(r => r.length === 3) && g.length >= 3, grid: g };
});
await row('chrome: remove column, remove row', async () => {
  await pm.locator('.bp-table__td').first().click();
  await (await chrome('remove column')).click(); await settle(); await (await chrome('remove row')).click(); await settle();
  const g = (await grids())[0]; return { pass: g.every(r => r.length === 2), grid: g };
});
await row('server matches the canvas after structural edits', compare);
await row('undo a cell edit; server follows', async () => {
  await pm.locator('.bp-table__td').first().click(); await page.keyboard.press('End'); await page.keyboard.type('XYZ'); await settle(); await waitSaved();
  await page.keyboard.press('Control+z'); await settle(); const r = await compare();
  return { ...r, pass: r.pass && !JSON.stringify(r.canvas).includes('XYZ') };
});
await row('paste a GFM pipe table as a table block', async () => {
  await pm.locator('p:has-text("Start here")').first().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await paste('| City | Pop |\n|---|---|\n| Oslo | 700k |\n| Bergen | 290k |'); await settle();
  const g = await grids(); const k = await kinds(); return { pass: g.length === 2 && same(g.find(t => t[0]?.[0] === '#City'), [['#City', '#Pop'], ['Oslo', '700k'], ['Bergen', '290k']]), tables: g.length, kinds: k };
});
await row('Enter inside a cell does not split the table', async () => {
  const before = await grids(); const tablesBefore = (await kinds()).filter(x => x === 'bpTable').length;
  await pm.locator('.bp-table__td').first().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await settle();
  const after = await grids(); const k = await kinds();
  return { pass: k.filter(x => x === 'bpTable').length === tablesBefore && after.length === before.length && after.every((t, i) => t.length === before[i].length), kinds: k };
});
await row('reload: the tables come back from the server as edited', async () => {
  await waitSaved(); const before = await grids();
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(500); await open(); await settle();
  const after = await grids(); return { pass: same(before, after) && same(after, serverGrids()), before, after };
});

await page.screenshot({ path: 'test-results/31-tables.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
