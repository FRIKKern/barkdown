import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture, paperFixtureScope } from './lib/paper-fixture.mjs';
// Plan #20: subscript and superscript marks — Ctrl+, / Ctrl+. and the bubble in the canvas, `sub` / `sup`
// inline wrappers on the server, <sub>/<sup> on the paper page. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-subsup';
publishFixture({ slug: SLUG, title: 'Below and above the line', description: 'Scratch paper for the Barkdown subscript/superscript row: the 2 in H2O goes below the line with Ctrl+, and the 2 in mc2 above it with Ctrl+., the server holds sub and sup wrappers, the reader renders the tags. Rewritten on every run of tests/editor-subsup.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Below and above the line' }, para('Water is H2O and energy is mc2 in this line.'), { type: 'paragraph', content: [{ type: 'text', value: 'Already ' }, { type: 'sup', children: [{ type: 'text', value: 'raised' }] }, { type: 'text', value: ' on the server.' }] }] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-subsup-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
await app.evaluate(({ nativeTheme, BrowserWindow }) => { nativeTheme.themeSource = 'dark'; const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(1400, 900); win.focus(); });
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async () => { await openFixturePaper(page, SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); await page.waitForTimeout(500); };
await open();

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
// Electron input reaches before-input-event and native accelerators, unlike a synthetic DOM event.
const nativeKey = (key, modifiers = ['control']) => app.evaluate(({ BrowserWindow }, { key, modifiers }) => {
  const contents = BrowserWindow.getAllWindows()[0].webContents;
  contents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers });
  contents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers });
}, { key, modifiers });
const editorState = () => page.evaluate(() => ({ settingsClosed: !document.querySelector('.bw-settings'), editorFocused: Boolean(document.activeElement?.closest('bp-paper-canvas')) }));
// Each paragraph as text with <sub>…</sub> / <sup>…</sup> around marked runs, canvas and server alike.
const canvasShape = () => page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c._editor.getJSON().content.filter(n => n.type === 'paragraph').map(n => (n.content || []).map(x => { const m = (x.marks || []).map(k => k.type); const t = x.text; return m.includes('subscript') ? `<sub>${t}</sub>` : m.includes('superscript') ? `<sup>${t}</sup>` : t; }).join('')); });
const serverShape = () => { const d = getPaper(SLUG); const inline = a => (a || []).map(x => x.type === 'sub' ? `<sub>${inline(x.children)}</sub>` : x.type === 'sup' ? `<sup>${inline(x.children)}</sup>` : x.type === 'text' ? x.value : inline(x.children)).join(''); return d.blocks.filter(b => b.type === 'paragraph').map(b => inline(b.content)); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const waitAgree = async () => { for (let i = 0; i < 20; i++) { const c = await canvasShape(); const s = serverShape(); if (same(c, s)) return { canvas: c, server: s, agree: true }; await page.waitForTimeout(1000); } return { canvas: await canvasShape(), server: serverShape(), agree: false }; };
// Select `word` inside the first paragraph through ProseMirror.
const selectWord = async (word, nth = 0) => page.evaluate(([word, nth]) => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const ed = c._editor; let hit = -1, k = -1; ed.state.doc.descendants((n, pos) => { if (hit >= 0 || !n.isText) return; let i = -1; while ((i = n.text.indexOf(word, i + 1)) !== -1) { k++; if (k === nth) { hit = pos + i; break; } } }); if (hit < 0) return false; ed.commands.setTextSelection({ from: hit, to: hit + word.length }); ed.commands.focus(); return true; }, [word, nth]);

await row('a sup stored on the server mounts as the superscript mark', async () => { const c = await canvasShape(); return { pass: c.some(s => s.includes('<sup>raised</sup>')), canvas: c }; });
await row('Ctrl+, makes the 2 of H2O a subscript; the server holds a sub wrapper', async () => {
  const sel = await selectWord('2', 0); await nativeKey(',');
  const r = await waitAgree(); const ui = await editorState();
  await page.screenshot({ path: 'test-results/40-subsup-shortcut.png' });
  return { ...r, ...ui, pass: sel && r.agree && r.canvas[0].includes('H<sub>2</sub>O') && ui.settingsClosed && ui.editorFocused };
});
// Preserve the failed action above before resetting the sheet for independent rows.
if (await page.locator('.bw-settings').count()) await page.locator('.bw-settings [data-act="cancel"]').click();
await row('the bubble’s x² makes the 2 of mc2 a superscript; the server follows', async () => {
  const sel = await selectWord('2', 1);
  await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const ed = c._editor; ed.commands.setTextSelection(ed.state.selection.to); ed.commands.focus(); });
  await page.keyboard.press('Shift+ArrowLeft'); await page.waitForTimeout(400);
  await page.locator('body .bp-paper-format__btn--superscript').first().click();
  const r = await waitAgree(); return { ...r, pass: sel && r.agree && r.canvas[0].includes('mc<sup>2</sup>') };
});
await row('the paper page renders <sub>2</sub> and <sup>2</sup>', async () => {
  const server = paperFixtureScope().server.replace(/\/$/, '');
  const html = await (await fetch(`${server.replace(/\/$/, '')}/papers/${SLUG}`)).text();
  return { pass: /H<span>?<sub>2<\/sub>/.test(html.replace(/<span[^>]*>/g, '<span>')) && /<sup>2<\/sup>/.test(html), sample: (html.match(/.{0,40}<sub>.{0,60}/) || [''])[0] };
});
await row('Ctrl+. on the superscript removes it again; server follows', async () => {
  await selectWord('2', 1); await page.keyboard.press('Control+.');
  const r = await waitAgree(); return { ...r, pass: r.agree && r.canvas[0].includes('mc2') };
});
await row('reload: the marks come back from the server as shown', async () => {
  const before = await canvasShape();
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await open();
  const after = await canvasShape();
  return { pass: same(before, after) && same(after, serverShape()), before, after };
});

await row('Settings shortcut opens from the composer and native menu remains available from Paper', async () => {
  await page.locator('#bw-prompt').focus();
  await nativeKey(',', [MOD === 'Meta' ? 'meta' : 'control']);
  await page.locator('.bw-settings').waitFor({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/40-subsup-settings.png' });
  await page.locator('.bw-settings [data-act="cancel"]').click();
  await selectWord('2', 0);
  await app.evaluate(({ Menu, BrowserWindow }) => {
    const settings = Menu.getApplicationMenu().items.find(item => item.label === 'File').submenu.items.find(item => item.label === 'Settings…');
    settings.click(undefined, BrowserWindow.getAllWindows()[0]);
  });
  await page.locator('.bw-settings').waitFor({ timeout: 5000 });
  await page.locator('.bw-settings [data-act="cancel"]').click();
  return { pass: true };
});

await page.screenshot({ path: 'test-results/40-subsup.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
