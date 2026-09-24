import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Row 15: IME composition does not produce stray ops — a dead key ("¨" then "u" → "ü") and a CJK run
// composed through the IME (にほん → 日本) emit nothing mid-composition, land on the server once,
// as one patch per composed run, and undo removes the whole run in one step. Composition is driven
// through Chromium's own IME channel (CDP Input.imeSetComposition / Input.insertText) in the real
// Electron window, so ProseMirror sees exactly what an OS IME sends. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-ime';
publishFixture({ slug: SLUG, title: 'Composed through the IME', description: 'Scratch paper for Barkdown row 15: one paragraph a dead key and a CJK composition are typed into; the ops the canvas emits are counted while the composition is open and after it commits. Rewritten on every run of tests/editor-ime.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Composed through the IME' }, para('Dead key: '), para('CJK: ')] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-ime-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async () => { await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug, paperOwner: window.__barkdown.state.barkparkDocs.find(d => d.id === slug)?.paperOwner }), SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); await page.waitForTimeout(500); };
await open();
// Count every ops batch the canvas emits, with the text it carried, so a batch sent mid-composition is named.
await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); window.__ops = []; c.addEventListener('bp-canvas-ops', e => { const ops = e.detail?.ops || e.detail || []; window.__ops.push({ at: Date.now(), ops: JSON.parse(JSON.stringify(ops)), composing: !!c._editor?.view?.composing }); }); });
const cdp = await app.context().newCDPSession(page);
await cdp.send('Input.enable').catch(() => {});

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const settled = async () => { await page.waitForFunction(() => !/Saving/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(400); };
const caretAtEndOf = async text => { await pm.locator(`p:has-text("${text}")`).first().click(); await page.evaluate(t => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; let end = null; ed.state.doc.descendants((node, pos) => { if (end == null && node.isTextblock && node.textContent.includes(t)) end = pos + node.nodeSize - 1; }); ed.view.focus(); ed.commands.setTextSelection(end); }, text); await page.waitForTimeout(150); };
const opsSince = mark => page.evaluate(m => window.__ops.filter(o => o.at > m), mark);
const paraText = prefix => page.evaluate(p => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; let t = null; ed.state.doc.descendants(n => { if (t == null && n.type.name === 'paragraph' && n.textContent.startsWith(p)) t = n.textContent; }); return t; }, prefix);
const serverText = prefix => { const b = getPaper(SLUG).blocks.find(x => x.type === 'paragraph' && (x.content || []).map(n => n.value || '').join('').startsWith(prefix)); return b ? (b.content || []).map(n => n.value || '').join('') : null; };
const waitServer = async (prefix, pred) => { for (let i = 0; i < 20; i++) { const t = serverText(prefix); if (pred(t)) return t; await page.waitForTimeout(1000); } return serverText(prefix); };
const patchesOf = ops => ops.flatMap(o => o.ops).filter(op => op.op === 'patch-block');
// A composition, the way an OS IME talks to Chromium: open with the first candidate, update it, hold, commit.
const compose = async (steps, commit, holdMs) => {
  for (const s of steps) { await cdp.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length }); await page.waitForTimeout(holdMs); }
  await cdp.send('Input.insertText', { text: commit });
};

await row('a dead key (¨ held, then u → ü): nothing is emitted while the composition is open; one patch lands; the server holds "ü"', async () => {
  await caretAtEndOf('Dead key: ');
  const mark = Date.now();
  await compose(['¨'], 'ü', 700);
  const during = await opsSince(mark);
  await page.waitForTimeout(600);
  await settled();
  const after = await opsSince(mark);
  const text = await paraText('Dead key:');
  const server = await waitServer('Dead key:', t => t === 'Dead key: ü');
  return { pass: during.length === 0 && patchesOf(after).length === 1 && text === 'Dead key: ü' && server === 'Dead key: ü', during: during.length, batches: after.length, patches: patchesOf(after).length, text, server };
});

await row('a CJK run (にほん over three updates → 日本): nothing while composing, one patch, the server holds the committed text', async () => {
  await caretAtEndOf('CJK: ');
  const mark = Date.now();
  await compose(['に', 'にほ', 'にほん'], '日本', 450);
  const during = await opsSince(mark);
  await page.waitForTimeout(600);
  await settled();
  const after = await opsSince(mark);
  const text = await paraText('CJK:');
  const server = await waitServer('CJK:', t => t === 'CJK: 日本');
  return { pass: during.length === 0 && patchesOf(after).length === 1 && text === 'CJK: 日本' && server === 'CJK: 日本', during: during.length, batches: after.length, patches: patchesOf(after).length, midCompositionTexts: during.map(o => JSON.stringify(o.ops).slice(0, 80)), text, server };
});

await row('undo removes the whole composed run in one step; the server follows', async () => {
  await caretAtEndOf('CJK: ');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  const text = await paraText('CJK:');
  await settled();
  const server = await waitServer('CJK:', t => t === 'CJK: ');
  return { pass: text === 'CJK: ' && server === 'CJK: ', text, server };
});

await row('reload: the composed text comes back from the server as committed', async () => {
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await open();
  const dead = await paraText('Dead key:'); const cjk = await paraText('CJK:');
  return { pass: dead === 'Dead key: ü' && cjk === 'CJK: ', dead, cjk };
});

await page.screenshot({ path: 'test-results/43-ime.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
