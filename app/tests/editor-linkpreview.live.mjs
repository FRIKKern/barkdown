// Plan #23: the link hover preview — resting on a link shows its address; on a wikilink the target paper's
// title and first line, fetched through Barkdown's Barkpark adapter; Open goes to a paper tab (wikilink) or
// the system browser (address); Edit opens the bubble's link row seeded with the href. Live against the
// bp-connected server: two fixture papers, one linking to the other.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const TARGET = 'barkdown-linkpreview-target';
const SLUG = 'barkdown-editor-linkpreview';
publishFixture({ slug: TARGET, title: 'Where the wikilink lands', description: 'The paper a wikilink in the link-preview fixture points at: its title and first line must show in the hover card. Rewritten on every run of tests/editor-linkpreview.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Where the wikilink lands' }, para('The first line of the target paper, shown in the hover card.'), para('A second line that the card does not need.')] });
publishFixture({ slug: SLUG, title: 'Links under the pointer', description: 'Scratch paper for the Barkdown link-preview row: one address and one wikilink in a paragraph, hovered in the canvas; the card shows the address, then the target paper resolved through the adapter; Open and Edit act. Rewritten on every run of tests/editor-linkpreview.live.mjs.', blocks: [
  { type: 'heading', level: 1, text: 'Links under the pointer' },
  { type: 'paragraph', content: [{ type: 'text', value: 'Read ' }, { type: 'link', href: 'https://example.org/docs/page', children: [{ type: 'text', value: 'the docs' }] }, { type: 'text', value: ' and then ' }, { type: 'wikilink', target: 'Where the wikilink lands', docId: TARGET, children: [{ type: 'text', value: 'Where the wikilink lands' }] }, { type: 'text', value: '.' }] },
] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-linkpreview-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async slug => { await page.evaluate(s => window.__barkdown.openTarget({ kind: 'doc', id: s, source: 'barkpark', title: s }), slug); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); await page.waitForTimeout(500); };
await open(SLUG);

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const card = page.locator('body .bp-link-preview');
const cardVisible = () => page.evaluate(() => { const c = document.querySelector('body .bp-link-preview'); return !!c && c.style.display !== 'none'; });
const cardText = sel => page.evaluate(s => document.querySelector('body .bp-link-preview ' + s)?.textContent || '', sel);
const hoverAway = async () => { await page.mouse.move(700, 850); await page.waitForTimeout(500); };

await row('resting on an address shows its host and the address, with Open and Edit', async () => {
  await pm.locator('a[href]').first().hover();
  await page.waitForTimeout(700);
  const visible = await cardVisible();
  const title = await cardText('.bp-link-preview__title'); const addr = await cardText('.bp-link-preview__addr');
  const edit = await page.evaluate(() => document.querySelector('body .bp-link-preview .bp-link-preview__edit')?.style.display !== 'none');
  return { pass: visible && title === 'example.org' && addr === 'https://example.org/docs/page' && edit, title, addr, edit };
});
await row('moving away hides the card', async () => { await hoverAway(); return { pass: !(await cardVisible()) }; });
await row('resting on a wikilink shows the target paper’s title and first line, fetched through the adapter', async () => {
  await pm.locator('span[data-wikilink]').first().hover();
  await page.waitForFunction(() => (document.querySelector('body .bp-link-preview .bp-link-preview__excerpt')?.textContent || '').length > 0, null, { timeout: 15000 }).catch(() => {});
  const title = await cardText('.bp-link-preview__title'); const excerpt = await cardText('.bp-link-preview__excerpt'); const addr = await cardText('.bp-link-preview__addr');
  return { pass: title === 'Where the wikilink lands' && excerpt === 'The first line of the target paper, shown in the hover card.' && addr === '[[Where the wikilink lands]]', title, excerpt, addr };
});
await row('Edit on the address selects the link and opens the bubble’s link row seeded with the href', async () => {
  await hoverAway();
  await pm.locator('a[href]').first().hover();
  await page.waitForTimeout(700);
  await card.locator('.bp-link-preview__edit').click();
  await page.waitForTimeout(300);
  const seeded = await page.evaluate(() => document.querySelector('body .bp-paper-format__link-input')?.value || null);
  const selected = await page.evaluate(() => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; const { from, to } = ed.state.selection; return ed.state.doc.textBetween(from, to); });
  await page.keyboard.press('Escape');
  return { pass: seeded === 'https://example.org/docs/page' && selected === 'the docs', seeded, selected };
});
await row('Open on an address asks the shell to open it externally (no in-app navigation)', async () => {
  const before = await page.evaluate(() => document.querySelectorAll('.bw-tab').length);
  // The renderer's bridge is read-only (contextBridge), so the hook sits in the main process on Electron's shell.
  await app.evaluate(({ shell }) => { globalThis.__lpOpened = []; globalThis.__lpOrig = shell.openExternal; shell.openExternal = url => { globalThis.__lpOpened.push(url); return Promise.resolve(); }; });
  await hoverAway();
  await pm.locator('a[href]').first().hover();
  await page.waitForTimeout(700);
  await card.locator('.bp-link-preview__open').click();
  await page.waitForTimeout(600);
  const opened = await app.evaluate(({ shell }) => { const o = globalThis.__lpOpened; shell.openExternal = globalThis.__lpOrig; return o; });
  const after = await page.evaluate(() => document.querySelectorAll('.bw-tab').length);
  return { pass: JSON.stringify(opened) === JSON.stringify(['https://example.org/docs/page']) && after === before, opened, before, after };
});

await row('Open on the wikilink opens the target paper in a tab', async () => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await hoverAway();
  await pm.locator('span[data-wikilink]').first().hover();
  await page.waitForTimeout(700);
  await card.locator('.bp-link-preview__open').click();
  await page.waitForFunction(t => Array.from(document.querySelectorAll('.bw-paper-pane:not([hidden]) #meta, .bw-paper-pane:not([hidden]) .bw-kicker')).some(e => (e.textContent || '').includes(t)) || Array.from(document.querySelectorAll('.bw-tab')).some(t2 => (t2.textContent || '').includes('Where the wikilink lands')), TARGET, { timeout: 20000 }).catch(() => {});
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.bw-tab')).map(t => t.textContent.trim().slice(0, 60)));
  const heading = await page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror h1')?.textContent || '');
  return { pass: heading === 'Where the wikilink lands', heading, tabs };
});
await page.screenshot({ path: 'test-results/42-linkpreview.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
