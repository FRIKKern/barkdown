// Plan #17: find and replace in a paper. Ctrl+F finds with a count and next/previous; Ctrl+H replaces one or
// all, as ops the server holds; undo restores the replace-all in one step. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para, text } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-find';
publishFixture({ slug: SLUG, title: 'Find and replace rehearsal', description: 'Scratch paper for the Barkdown find-and-replace row: three alphas across a paragraph, a list and a heading are found, stepped through, replaced at once and undone in one step. Rewritten on every run of tests/editor-find.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Find and replace rehearsal' }, para('The first alpha sits in a paragraph, next to an Alpha with a capital.'), { type: 'list', ordered: false, items: [text('a second alpha in a list'), text('nothing here')] }, { type: 'heading', level: 2, text: 'A third alpha in a heading' }] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-find-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
await page.waitForTimeout(500);

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const pane = '.bw-paper-pane:not([hidden])';
const pm = page.locator(`${pane} bp-paper-canvas .ProseMirror`);
const count = () => page.locator(`${pane} #find-count`).innerText();
const serverText = () => { const d = getPaper(SLUG); const inl = a => (a || []).map(x => x.type === 'text' ? x.value : inl(x.children)).join(''); return d.blocks.map(b => b.type === 'heading' ? b.text : b.type === 'list' ? b.items.map(i => inl(i.content || i)).join(' / ') : inl(b.content)).join('\n'); };
const occurrences = (s, w) => (s.match(new RegExp(w, 'g')) || []).length;
const waitServer = async (pred) => { for (let i = 0; i < 20; i++) { const t = serverText(); if (pred(t)) return t; await page.waitForTimeout(1000); } return serverText(); };

await row('Ctrl+F inside the paper opens the bar; typing "alpha" counts four matches (case-insensitive, starting from the caret) and highlights them', async () => {
  await pm.locator('p').first().click(); await page.keyboard.press('Control+Home'); await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.selection.from === 1);  await page.keyboard.press('Control+f');
  const open = await page.locator(`${pane} #find`).isVisible();
  await page.locator(`${pane} #find-q`).fill('alpha'); await page.waitForTimeout(200);
  const c = await count();
  const marks = await page.locator(`${pane} .bp-find-match`).count();
  return { pass: open && c === '1 of 4' && marks === 4, open, count: c, marks };
});
await row('Enter and Shift+Enter step through the matches and wrap', async () => {
  const q = page.locator(`${pane} #find-q`);
  await q.press('Enter'); const a = await count();
  await q.press('Enter'); const b = await count();
  await q.press('Enter'); await q.press('Enter'); const wrapped = await count();
  await q.press('Shift+Enter'); const back = await count();
  const active = await page.locator(`${pane} .bp-find-match--active`).count();
  return { pass: a === '2 of 4' && b === '3 of 4' && wrapped === '1 of 4' && back === '4 of 4' && active === 1, a, b, wrapped, back, active };
});
await row('Replace all with "omega" lands on the server as one save: no alpha left, four omegas', async () => {
  await page.locator(`${pane} #find-r`).fill('omega');
  await page.locator(`${pane} #find-replace-all`).click();
  const c = await count();
  const t = await waitServer(s => occurrences(s.toLowerCase(), 'alpha') === 0 && occurrences(s, 'omega') === 4);
  return { pass: occurrences(t.toLowerCase(), 'alpha') === 0 && occurrences(t, 'omega') === 4 && /No matches/.test(c), count: c, server: t };
});
await row('Ctrl+Z restores all four in ONE step, and the server follows', async () => {
  await page.locator(`${pane} #find-close`).click();
  await pm.locator('p').first().click(); await page.keyboard.press('Control+z');
  const t = await waitServer(s => occurrences(s.toLowerCase(), 'alpha') === 4);
  return { pass: occurrences(t.toLowerCase(), 'alpha') === 4 && occurrences(t, 'omega') === 0, server: t };
});
await row('Ctrl+H opens with replace; Replace (one) changes only the active match and moves on', async () => {
  await pm.locator('p').first().click(); await page.keyboard.press('Control+Home'); await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.selection.from === 1);  await page.keyboard.press('Control+h');
  await page.locator(`${pane} #find-q`).fill('alpha'); await page.waitForTimeout(200);
  await page.locator(`${pane} #find-r`).fill('beta');
  await page.locator(`${pane} #find-replace`).click();
  const c = await count();
  const t = await waitServer(s => occurrences(s, 'beta') === 1);
  return { pass: occurrences(t, 'beta') === 1 && occurrences(t.toLowerCase(), 'alpha') === 3 && c === '1 of 3', count: c, server: t };
});
await row('Esc closes the bar and clears the highlights', async () => {
  await page.locator(`${pane} #find-q`).press('Escape');
  await page.waitForTimeout(200);
  const hidden = await page.locator(`${pane} #find`).isHidden();
  const marks = await page.locator(`${pane} .bp-find-match`).count();
  return { pass: hidden && marks === 0, hidden, marks };
});

await page.screenshot({ path: 'test-results/36-find.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
