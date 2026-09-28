import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture, paperFixtureScope } from './lib/paper-fixture.mjs';
// Plan #27: code blocks highlight in the canvas and on the reader page from ONE tokenizer. A JavaScript
// and an Elixir block: the canvas paints hljs-* tokens in the code node's highlight layer; the server
// renders `<pre data-lang>` and ships /assets/bp-paper-code.js, which paints the same tokens on the
// reader page — the row runs that very asset over the fetched page (jsdom) and compares token
// signatures with the canvas. Editing the code or its lang repaints; an unknown lang paints nothing.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { JSDOM } from 'jsdom';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
import { DOC_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-codehl';
const JS = 'const total = items.reduce((n, x) => n + x.price, 0); // sum\nif (total > 10) console.log("big");';
const EX = 'defmodule Demo do\n  @moduledoc "a demo"\n  def add(a, b), do: a + b\nend';
publishFixture({ slug: SLUG, title: 'Two code blocks, one tokenizer', description: 'Scratch paper for the Barkdown code-highlighting row: a JavaScript block and an Elixir block whose tokens must match between the canvas and the reader page, plus a block with an unknown language that stays plain. Rewritten on every run of tests/editor-codehl.live.mjs.', blocks: [
  { type: 'heading', level: 1, text: 'Two code blocks, one tokenizer' },
  para('A JavaScript block:'),
  { type: 'code', lang: 'js', value: JS },
  para('An Elixir block:'),
  { type: 'code', lang: 'elixir', value: EX },
  para('An unknown language:'),
  { type: 'code', lang: 'klingon', value: 'def hello, do: "nuqneH" # <tokens only once the lang is known>' },
] });

const server = paperFixtureScope().server.replace(/\/$/, '');
const base = server.replace(/\/$/, '');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-codehl-'));
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
// The token signature: (class, text) pairs, the same walk on both sides.
const signatureOf = (root) => { const out = []; const walk = (el, cls) => { for (const child of Array.from(el.childNodes)) { if (child.nodeType === 3) { if (child.nodeValue) out.push([cls, child.nodeValue]); } else if (child.nodeType === 1) walk(child, child.getAttribute('class') || cls); } }; walk(root, ''); return out; };
const canvasSignatures = () => page.evaluate(sigSrc => { const sig = new Function('root', `return (${sigSrc})(root)`); return Array.from(document.querySelectorAll('.bw-paper-pane:not([hidden]) bp-paper-canvas pre.bp-canvas-code')).map(pre => ({ lang: pre.querySelector('.bp-canvas-code-lang')?.value || '', text: pre.querySelector('.bp-canvas-code-area')?.value || '', layerText: pre.querySelector('.bp-canvas-code-hl')?.textContent || '', sig: sig(pre.querySelector('.bp-canvas-code-hl')), classes: Array.from(pre.querySelectorAll('.bp-canvas-code-hl [class]')).map(e => e.className) })); }, signatureOf.toString());
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const norm = sig => sig.map(([cls, text]) => [cls.replace(/^hljs\s+|\s+hljs$|^hljs$/, ''), text]).filter(([, t]) => t !== '');

// The reader page, run through the asset the server ships, in jsdom.
const readerSignatures = async () => {
  const html = await (await fetch(`${base}/papers/${SLUG}`)).text();
  const asset = await (await fetch(`${base}/assets/bp-paper-code.js`)).text();
  const dom = new JSDOM(html, { url: `${base}/papers/${SLUG}`, runScripts: 'outside-only' });
  dom.window.eval(asset);
  const api = dom.window.BarkparkPaperCode;
  const painted = api.run(dom.window.document);
  return { painted, pres: Array.from(dom.window.document.querySelectorAll('pre[data-lang], pre.bp-code, .bp-paper-surface pre')).map(pre => ({ lang: pre.getAttribute('data-lang'), hl: pre.getAttribute('data-hl'), text: pre.textContent, sig: signatureOf(pre) })), hasAsset: /BarkparkPaperCode/.test(asset), scriptTag: /bp-paper-code\.js/.test(html) };
};

await row('the canvas paints hljs tokens for the JavaScript and Elixir blocks and nothing for an unknown language; the layer text is the code', async () => {
  const c = await canvasSignatures();
  const js = c.find(x => x.lang === 'js'), ex = c.find(x => x.lang === 'elixir'), kl = c.find(x => x.lang === 'klingon');
  const has = (x, cls) => !!x && x.classes.some(k => k.includes(cls));
  return { pass: has(js, 'hljs-keyword') && has(js, 'hljs-comment') && has(ex, 'hljs-keyword') && !!kl && kl.classes.length === 0 && js.layerText === JS && ex.layerText === EX, blocks: c.map(x => ({ lang: x.lang, classes: x.classes.length, layerOk: x.layerText === x.text })) };
});
await row('the reader page carries data-lang and the tokenizer asset; run there it paints the SAME token signatures as the canvas', async () => {
  const r = await readerSignatures();
  const c = await canvasSignatures();
  const pick = (arr, lang) => arr.find(x => x.lang === lang);
  const jsMatch = pick(r.pres, 'js') && same(norm(pick(r.pres, 'js').sig), norm(pick(c, 'js').sig));
  const exMatch = pick(r.pres, 'elixir') && same(norm(pick(r.pres, 'elixir').sig), norm(pick(c, 'elixir').sig));
  const kl = pick(r.pres, 'klingon');
  return { pass: r.scriptTag && r.hasAsset && r.painted >= 2 && jsMatch && exMatch && !!kl && kl.sig.every(([cls]) => !/hljs-/.test(cls)), scriptTag: r.scriptTag, hasAsset: r.hasAsset, painted: r.painted, jsMatch, exMatch, readerLangs: r.pres.map(p => p.lang), sample: pick(r.pres, 'js')?.sig.slice(0, 6) };
});
await row('typing into the JavaScript block repaints the layer at once and the server holds the new value', async () => {
  const area = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas pre.bp-canvas-code .bp-canvas-code-area').first();
  await area.click();
  await page.keyboard.press('End');
  await page.keyboard.press(DOC_END);
  await page.keyboard.type('\nreturn total;');
  await page.waitForTimeout(100);
  const c = await canvasSignatures();
  const js = c.find(x => x.lang === 'js');
  const repainted = !!js && js.layerText === JS + '\nreturn total;' && js.classes.some(k => k.includes('hljs-keyword'));
  await settled();
  let server = null; for (let i = 0; i < 15; i++) { const b = getPaper(SLUG).blocks.find(x => x.type === 'code' && x.lang === 'js'); server = b?.value; if (server === JS + '\nreturn total;') break; await page.waitForTimeout(1000); }
  return { pass: repainted && server === JS + '\nreturn total;', repainted, server: (server || '').slice(-14) };
});
await row('changing the lang from klingon to elixir paints tokens; the server holds the new lang', async () => {
  const pre = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas pre.bp-canvas-code').nth(2);
  await pre.hover();
  const lang = pre.locator('.bp-canvas-code-lang');
  await lang.click({ force: true });
  await lang.fill('elixir');
  await page.waitForTimeout(150);
  const c = await canvasSignatures();
  const third = c[2];
  const painted = !!third && third.lang === 'elixir' && third.classes.length > 0;
  await settled();
  let serverLang = null; for (let i = 0; i < 15; i++) { serverLang = (getPaper(SLUG).blocks.filter(x => x.type === 'code')[2] || {}).lang; if (serverLang === 'elixir') break; await page.waitForTimeout(1000); }
  return { pass: painted && serverLang === 'elixir', painted, serverLang };
});

await page.screenshot({ path: 'test-results/45-codehl.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
