import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture, paperFixtureScope } from './lib/paper-fixture.mjs';
// Row 13 (plan #9, with #14): a picture pasted or dropped onto the canvas becomes an image block whose
// src is a media asset on the connected Barkpark; alt and width round-trip; a reload shows the same.
// Live against the bp-connected server; not part of npm test. Red until the paste/drop + upload path is in.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { bp, publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
import { tinyPng } from './png.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-images';
publishFixture({ slug: SLUG, title: 'Pictures on the canvas', description: 'Scratch paper for the Barkdown image row: a picture pasted or dropped onto the canvas uploads to Barkpark media and lands as an image block; alt and width round-trip. Rewritten on every run of tests/editor-images.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Pictures on the canvas' }, para('Paste a picture after this paragraph.'), para('Drop a picture onto this paragraph.')] });

const server = paperFixtureScope().server.replace(/\/$/, '');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-images-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
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
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const images = () => getPaper(SLUG).blocks.filter(b => b.type === 'image');
const waitImages = async (n, pred = () => true) => { for (let i = 0; i < 30; i++) { const list = images(); if (list.length >= n && pred(list)) return list; await page.waitForTimeout(1000); } return images(); };
const pngB64 = (rgb) => Buffer.from(tinyPng(48, 32, rgb)).toString('base64');
const isMedia = b => typeof b.src === 'string' && /\/media\/(files|renditions)\//.test(b.src) && b.src.startsWith('http');
// A synthetic clipboard / drop with a real File: Chromium lets a page build a DataTransfer with files.
const pasteImage = async (b64, name) => page.evaluate(([b64, name]) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const file = new File([bytes], name, { type: 'image/png' });
  const dt = new DataTransfer(); dt.items.add(file);
  const target = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
}, [b64, name]);
const dropImage = async (b64, name, selector) => page.evaluate(([b64, name, selector]) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const file = new File([bytes], name, { type: 'image/png' });
  const dt = new DataTransfer(); dt.items.add(file);
  const el = document.querySelector(selector); const r = el.getBoundingClientRect();
  const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + r.height / 2 });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}, [b64, name, selector]);

await row('a pasted picture lands as an image block whose src is a media asset on the server', async () => {
  await pm.locator('p:has-text("Paste a picture")').first().click(); await page.keyboard.press('End');
  const handled = await pasteImage(pngB64([200, 40, 40]), 'red-square.png');
  const shown = await page.waitForFunction(() => !!document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas figure[data-bp-type="image"] img[src]'), null, { timeout: 5000 }).then(() => true).catch(() => false);
  const list = await waitImages(1, l => l.some(isMedia));
  const b = list.find(isMedia);
  return { pass: handled && shown && !!b && b.alt === 'red-square', handled, shownAtOnce: shown, block: b || list };
});
await row('a dropped picture lands where it was dropped, with its src on the server', async () => {
  const handled = await dropImage(pngB64([40, 40, 200]), 'blue-square.png', '.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror p:nth-of-type(2)');
  const list = await waitImages(2, l => l.filter(isMedia).length >= 2);
  const blue = list.find(b => b.alt === 'blue-square');
  const order = getPaper(SLUG).blocks.map(b => b.type + (b.alt ? ':' + b.alt : ''));
  return { pass: handled && !!blue && isMedia(blue), handled, blue, order };
});
await row('the uploaded picture is served by the Barkpark (200, image/png)', async () => {
  const b = images().find(x => x.alt === 'red-square');
  // A failure names the address and the cause: "fetch failed" alone does not say where the picture was looked for.
  let r; try { r = await fetch(b.src); } catch (error) { return { pass: false, src: b.src, error: `${error.message}: ${error.cause?.code || error.cause?.message || ''}` }; }
  return { pass: r.ok && /image\/png/.test(r.headers.get('content-type') || ''), src: b.src, status: r.status, type: r.headers.get('content-type') };
});
await row('alt and width typed on the node land on the server', async () => {
  const img = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas figure[data-bp-type="image"]').first();
  await img.hover();
  const alt = img.locator('input.bp-canvas-image-alt'); await alt.click(); await alt.fill('A red square'); await alt.press('Enter');
  await page.waitForTimeout(400);
  const width = img.locator('input.bp-canvas-image-width'); await width.click(); await width.fill('120'); await width.press('Enter');
  const list = await waitImages(2, l => l.some(b => b.alt === 'A red square' && b.width === 120));
  const b = list.find(x => x.alt === 'A red square');
  const rendered = await img.locator('img').evaluate(el => el.style.width);
  return { pass: !!b && b.width === 120 && isMedia(b) && rendered === '120px', block: b, rendered };
});
await row('reload: both pictures come back from the server with their srcs, alt and width', async () => {
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await open();
  const canvas = await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c._editor.getJSON().content.filter(n => n.type === 'bpImage').map(n => ({ src: n.attrs.src, alt: n.attrs.alt, width: n.attrs.width })); });
  const server = images().map(b => ({ src: b.src, alt: b.alt, width: b.width ?? null }));
  return { pass: JSON.stringify(canvas) === JSON.stringify(server) && canvas.length === 2, canvas, server };
});
await row('without writes the upload fails on the node, not in a toast', async () => {
  await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { writes: false } }); });
  await pm.locator('p:has-text("Paste a picture")').first().click(); await page.keyboard.press('End');
  await pasteImage(pngB64([40, 200, 40]), 'green-square.png');
  const badge = await page.waitForFunction(() => { const b = [...document.querySelectorAll('.bw-paper-pane:not([hidden]) .bp-canvas-image-badge--error')]; return b.length ? b[0].textContent : null; }, null, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => null);
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.bw-toast')].map(t => t.textContent).join(' | '));
  await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { writes: true } }); });
  return { pass: !!badge && /writes are off|Upload failed/.test(badge) && !/upload/i.test(toasts), badge, toasts };
});

await page.screenshot({ path: 'test-results/35-images.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
