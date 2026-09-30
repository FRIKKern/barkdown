import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Row 16: a 500-block paper types without lag and ops stay batched. Against the local server (so the
// network is not the variable): open a 500-block paper, type for two seconds near the end and measure
// keystroke-to-paint and how many ops batches leave the canvas, then scroll to the end and drag a block
// with the grip. Numbers are recorded in the result and in docs/EDITOR-PARITY.md.
//
// Budgets (stated here, checked below): keystroke-to-paint p95 ≤ 50 ms and max ≤ 150 ms at 500 blocks;
// no batch leaves while typing continues (the debounce resets per keystroke) and the run lands as ONE
// patch; the diff over 500 blocks (runToOps + projection) takes ≤ 150 ms; a drag lands as one batch
// and the server holds the same block order as the canvas.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-perf';
const N = 500;
const words = 'the canvas holds a long paper and every block is a row the author can reach without waiting'.split(' ');
const blocks = [{ type: 'heading', level: 1, text: 'Five hundred blocks of prose' }];
for (let i = 1; i < N; i++) {
  if (i % 40 === 0) blocks.push({ type: 'heading', level: 2, text: `Section ${i / 40}` });
  else if (i % 37 === 0) blocks.push({ type: 'blockquote', content: [{ type: 'text', value: `Quote ${i}: ${words.slice(0, 8).join(' ')}.` }] });
  else if (i % 53 === 0) blocks.push({ type: 'list', items: [{ content: [{ type: 'text', value: `item ${i} a` }] }, { content: [{ type: 'text', value: `item ${i} b` }] }] });
  else if (i % 97 === 0) blocks.push({ type: 'code', lang: 'sh', value: `echo block ${i}` });
  else blocks.push(para(`Block ${i}: ${words.slice(i % 5, (i % 5) + 10).join(' ')}.`));
}
publishFixture({ slug: SLUG, title: 'Five hundred blocks of prose', description: 'Scratch paper for Barkdown row 16: five hundred blocks the canvas must open, type into and reorder without lag, with the ops batched. Rewritten on every run of tests/editor-perf.live.mjs.', blocks });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-perf-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const canvasEl = () => page.evaluate(() => !!document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor);
const settled = async () => { await page.waitForFunction(() => !/Saving/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(400); };
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10; };
const canvasOrder = () => page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.getJSON().content.map(n => n.attrs?.bpId || null));
const serverOrder = () => getPaper(SLUG).blocks.map(b => b.id);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let openMs = null;
await row(`opens a ${N}-block paper in under 6 s`, async () => {
  const t0 = Date.now();
  await openFixturePaper(page, SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
  await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
  openMs = Date.now() - t0;
  const count = await page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.doc.childCount);
  return { pass: count === N && openMs < 6000, blocks: count, openMs };
});

// Hooks: keystroke → next paint after ProseMirror's transaction; ops batches; the diff's own duration.
await page.evaluate(() => {
  const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
  const ed = c._editor;
  window.__perf = { keys: [], paints: [], batches: [], emits: [] };
  let lastKey = null;
  ed.view.dom.addEventListener('keydown', () => { lastKey = performance.now(); window.__perf.keys.push(lastKey); }, true);
  ed.on('transaction', ({ transaction }) => { if (!transaction.docChanged || lastKey == null) return; const k = lastKey; lastKey = null; requestAnimationFrame(() => window.__perf.paints.push(performance.now() - k)); });
  c.addEventListener('bp-canvas-ops', e => window.__perf.batches.push({ at: performance.now(), ops: (e.detail?.ops || e.detail || []).length }));
  const orig = c._emitOps.bind(c);
  c._emitOps = function () { const t = performance.now(); const r = orig(); window.__perf.emits.push(performance.now() - t); return r; };
});

await row('typing for two seconds near the end: keystroke-to-paint p95 ≤ 50 ms, max ≤ 150 ms; no batch while typing; one patch after; the diff over 500 blocks ≤ 150 ms', async () => {
  const target = pm.locator('p:has-text("Block 482:")').first();
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await page.evaluate(() => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; const $f = ed.state.selection.$from; ed.commands.setTextSelection($f.end($f.depth)); ed.commands.focus(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__perf.keys.length = 0; window.__perf.paints.length = 0; window.__perf.batches.length = 0; window.__perf.emits.length = 0; });
  const text = ' typed for two seconds while five hundred blocks sit in the same paper';
  const t0 = Date.now();
  await page.keyboard.type(text, { delay: 28 });
  const typingMs = Date.now() - t0;
  const during = await page.evaluate(() => window.__perf.batches.length);
  await page.waitForTimeout(700);
  await settled();
  const p = await page.evaluate(() => ({ keys: window.__perf.keys.length, paints: window.__perf.paints.slice(), batches: window.__perf.batches.length, emits: window.__perf.emits.slice() }));
  const p95 = pct(p.paints, 0.95), max = pct(p.paints, 1), median = pct(p.paints, 0.5), emitMax = pct(p.emits, 1);
  const server = (() => { for (let i = 0; i < 20; i++) { const b = getPaper(SLUG).blocks.find(x => (x.content || []).map(n => n.value || '').join('').startsWith('Block 482:')); const t = b ? (b.content || []).map(n => n.value || '').join('') : ''; if (t.endsWith(text)) return true; } return false; })();
  const patches = await page.evaluate(() => window.__perf.batches.reduce((n, b) => n + b.ops, 0));
  return { pass: p95 != null && p95 <= 50 && max <= 150 && during === 0 && p.batches === 1 && patches === 1 && emitMax != null && emitMax <= 150 && server, keystrokes: p.keys, samples: p.paints.length, typingMs, paintMs: { median, p95, max }, batchesWhileTyping: during, batchesAfter: p.batches, opsInBatch: patches, diffMs: { max: emitMax, all: p.emits.map(x => Math.round(x)) }, serverHasText: server };
});

await row('scroll to the end and drag a block up two places with the grip: one batch, the server holds the canvas order', async () => {
  const src = pm.locator('p:has-text("Block 496:")').first();
  const dst = pm.locator('p:has-text("Block 494:")').first();
  await src.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const before = await canvasOrder();
  const sb = await src.boundingBox(); const db = await dst.boundingBox();
  // The gutter handle follows the hovered block; then the grip is dragged with real pointer events.
  await page.mouse.move(sb.x + 40, sb.y + sb.height / 2); await page.waitForTimeout(250);
  const grip = page.locator('body .bp-block-handle__grip, .bw-paper-pane:not([hidden]) .bp-block-handle__grip').first();
  const gb = await grip.boundingBox();
  if (!gb) return { pass: false, error: 'no grip visible after hovering the block' };
  await page.evaluate(() => { window.__perf.batches.length = 0; window.__perf.emits.length = 0; });
  const t0 = Date.now();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2, { steps: 4 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2, db.y + 2, { steps: 12 });
  await page.waitForTimeout(100);
  const dragState = await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const h = c._handle; return { index: h?._index, dragging: !!h?._drag, dropShown: h?._drop?.style.display !== 'none' }; });
  await page.mouse.up();
  const menuOpen = await page.evaluate(() => !!document.querySelector('.bp-block-menu'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await settled();
  const dragMs = Date.now() - t0;
  const after = await canvasOrder();
  const moved = before.indexOf(after[before.indexOf(after.find((id, i) => id !== before[i]))]);
  let server = serverOrder(); for (let i = 0; i < 20 && !same(server, after); i++) { await page.waitForTimeout(1000); server = serverOrder(); }
  const batches = await page.evaluate(() => window.__perf.batches.length);
  const srcText = await page.evaluate(() => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; const i = ed.state.doc.content.content.findIndex(n => n.textContent.startsWith('Block 496:')); return { index: i, above: ed.state.doc.child(Math.max(0, i - 1)).textContent.slice(0, 10), below: ed.state.doc.child(Math.min(ed.state.doc.childCount - 1, i + 1)).textContent.slice(0, 10) }; });
  const orderChanged = !same(before, after);
  return { pass: orderChanged && same(server, after) && batches === 1, orderChanged, moved, position: srcText, batches, dragMs, serverMatches: same(server, after), dragState, menuOpen, grip: gb };
});

await page.screenshot({ path: 'test-results/44-perf.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
