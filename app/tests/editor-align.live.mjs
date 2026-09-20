// Plan #21: text alignment on paragraphs and headings — the bubble's align buttons in the canvas, an `align`
// block attribute on the server, text-align on the paper page. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-align';
publishFixture({ slug: SLUG, title: 'Centred and flushed right', description: 'Scratch paper for the Barkdown alignment row: a paragraph goes centred and a heading flush right from the bubble, the server holds the align attribute, the paper page renders text-align, back to left drops it. Rewritten on every run of tests/editor-align.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Centred and flushed right' }, para('This paragraph will be centred.'), { type: 'heading', level: 2, text: 'This heading goes right' }, { type: 'paragraph', align: 'center', content: [{ type: 'text', value: 'Already centred on the server.' }] }] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-align-'));
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
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const shape = () => page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c._editor.getJSON().content.filter(n => n.type === 'paragraph' || n.type === 'heading').map(n => (n.attrs?.textAlign && n.attrs.textAlign !== 'left') ? n.attrs.textAlign : '-'); });
const serverShape = () => getPaper(SLUG).blocks.filter(b => b.type === 'paragraph' || b.type === 'heading').map(b => b.align || '-');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const waitServer = async (pred) => { for (let i = 0; i < 20; i++) { const s = serverShape(); if (pred(s)) return s; await page.waitForTimeout(1000); } return serverShape(); };
// A keyboard selection inside a block, so the bubble shows.
const selectIn = async (sel) => { await pm.locator(sel).first().click(); await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const ed = c._editor; const $f = ed.state.selection.$from; ed.commands.setTextSelection($f.end($f.depth)); ed.commands.focus(); }); await page.keyboard.press('Shift+ArrowLeft'); await page.keyboard.press('Shift+ArrowLeft'); await page.waitForTimeout(400); };

await row('a paragraph stored with align:center mounts centred', async () => { const s = await shape(); return { pass: s[3] === 'center', shape: s }; });
await row('the bubble’s centre button centres a paragraph; the server holds align:center', async () => {
  await selectIn('p:has-text("will be centred")');
  await page.locator('body .bp-paper-format__btn--align-center').first().click();
  const s = await waitServer(x => x[1] === 'center');
  return { pass: s[1] === 'center' && same(await shape(), s), server: s };
});
await row('the bubble’s right button flushes a heading right; the server holds align:right', async () => {
  await selectIn('h2:has-text("goes right")');
  await page.locator('body .bp-paper-format__btn--align-right').first().click();
  const s = await waitServer(x => x[2] === 'right');
  return { pass: s[2] === 'right' && same(await shape(), s), server: s };
});
await row('the paper page renders text-align on both', async () => {
  const server = (JSON.parse(execFileSync('bp', ['use', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })).active || {}).server || 'http://localhost:4000';
  const html = await (await fetch(`${server.replace(/\/$/, '')}/papers/${SLUG}`)).text();
  const centred = /<p[^>]*text-align:center[^>]*>This paragraph will be centred\./.test(html);
  const right = /<h2[^>]*text-align:right[^>]*>This heading goes right/.test(html);
  return { pass: centred && right, centred, right, sample: (html.match(/<p[^>]*>This paragraph will be centred\./) || [''])[0].slice(0, 160) };
});
await row('back to left drops the attribute on the server (no align:left is stored)', async () => {
  await selectIn('p:has-text("will be centred")');
  await page.locator('body .bp-paper-format__btn--align-left').first().click();
  const s = await waitServer(x => x[1] === '-');
  const raw = getPaper(SLUG).blocks.filter(b => b.type === 'paragraph')[0];
  return { pass: s[1] === '-' && raw.align == null && same(await shape(), s), server: s, raw };
});
await row('reload: alignment comes back from the server as shown', async () => {
  const before = await shape();
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await open();
  const after = await shape();
  return { pass: same(before, after) && same(after, serverShape()), before, after };
});

await page.screenshot({ path: 'test-results/41-align.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
