import { openFixturePaper } from './lib/paper-fixture.mjs';
// Real pictures of the real app for the README: stills and an animated GIF, with a manifest that says
// what they show and which commits they came from. `npm run shots` (live: needs the local Barkpark,
// `bp use local`, and the claude login for the assistant turn).
//
// Writes docs/images/status/*.png, docs/images/status/editing.gif and docs/images/status/manifest.json.
// The repo's `npm run check` refuses a README that embeds a status image the manifest does not list, and
// a manifest older than the last commit that touched the app's UI — so the pictures cannot go stale
// again. Run it after the UI change is committed, then commit the images with the manifest.
//
// Composition rules, so we show the product and not its worst angle: a wide window with the paper
// getting most of it; the assistant half of the product visible with a real turn on this very note
// (a seeded transcript only as a fallback, flagged in the manifest); nothing captured mid-save; the
// GIF is a short editing loop — slash menu → Quote, typing, Tab through the table, quick open.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';
import { archiveStatusManifest } from './helpers/status-history.mjs';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const repo = path.resolve(appDir, '..');
const out = path.join(repo, 'docs', 'images', 'status');
fs.mkdirSync(out, { recursive: true });
// Preserve the reviewed baseline before a new live capture. Prior hashed media stays intact.
const priorManifest = path.join(out, 'manifest.json');
if (fs.existsSync(priorManifest)) {
  archiveStatusManifest(out, JSON.parse(fs.readFileSync(priorManifest, 'utf8')));
}

const SLUG = 'barkdown-status';
const captureServer = process.env.BARKDOWN_SHOTS_SERVER || 'http://localhost:4000';
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], { ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input }), shell: true, encoding: 'utf8', maxBuffer: 20e6 }));
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const text = v => [{ type: 'text', value: v }];
for (const [id, title] of [['barkdown', 'Barkdown'], ['scratch', 'Scratch']]) { try { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); } catch (e) { console.error(`tag ${id}: ${(e.stdout || e.message).toString().slice(0, 160)}`); } }
// A showcase note: the blocks an author reaches for daily, so the picture shows the canvas doing real work.
bp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, title: 'Status: what the canvas does today', description: 'The showcase note the README pictures are taken from: a heading, a paragraph, a plain quote, a checklist, a table, a callout and a code block, all edited in the Barkpark canvas inside Barkdown. Rewritten by tests/status-shots.mjs.', tags: [{ tag: 'barkdown', strength: 95, rationale: 'the README showcase note' }, { tag: 'scratch', strength: 35, rationale: 'rewritten on every capture' }], blocks: [
  { type: 'heading', level: 1, text: 'Status: what the canvas does today' },
  { type: 'paragraph', content: text('A note in Barkdown is a Barkpark paper. This one is edited in Barkpark’s own canvas, against a local Barkpark, and every edit lands on the server as an op.') },
  { type: 'blockquote', content: text('Barkdown is a note + agent app, utilizing Barkpark.'), cite: 'Frikk, 2026-09-20' },
  { type: 'heading', level: 2, text: 'Editor parity rows' },
  { type: 'list', task: true, items: [{ content: text('Row 10 — tables: 11/11'), checked: true }, { content: text('Row 11 — multi-block edits across the ops round trip: 11/11'), checked: true }, { content: text('Table header columns and cell alignment: 6/6'), checked: true }] },
  { type: 'table', headCol: true, head: [text('Row'), text('Score'), text('Fixed in')], rows: [[text('Tables'), text('11/11'), text('Barkpark table-node, markdown.js')], [text('Multi-block'), text('11/11'), text('canvas seam, paper.js')], [text('Header and alignment'), { content: text('6/6'), align: 'right' }, text('canvas, reader and BPML')]] },
  { type: 'callout', tone: 'info', content: text('Every row goes green only by a live test that compares the canvas with the server.') },
  { type: 'code', lang: 'sh', value: 'cd app && npm run test:tables' },
] }));

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-status-'));
const app = await electron.launch({ executablePath: require('electron'), args: [appDir, `--user-data=${userData}`], env: { ...process.env } });
try {
const page = await app.firstWindow();
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1760, height: 1000 });
// The paper gets most of the width (about a thousand pixels of pane, so its 900px column is not squeezed); the chat keeps ~560px to read a turn.
const isolated = process.env.BARKDOWN_SHOTS_ISOLATED === '1';
if (isolated && !process.env.BARKPARK_API_TOKEN) throw Error('Isolated capture requires its owned server credential');
// Provider subprocesses intentionally discard ambient CLI connection variables.
// Bind the disposable fixture to its owned server through ordinary saved settings.
await page.evaluate(async connection => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, writes: true, ...connection }, chatWidth: 36, provider: 'claude' }); await window.__barkdown.refreshLibrary(); }, { server: captureServer, viaCli: !isolated, ...(isolated ? { token: process.env.BARKPARK_API_TOKEN } : {}) });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
// The chat/work split, applied the way the splitter applies it (two CSS variables on the root).
const split = w => page.evaluate(v => { const r = document.getElementById("app"); r.style.setProperty("--bw-chat", v + "fr"); r.style.setProperty("--bw-work", (100 - v) + "fr"); document.querySelector("#bw-splitter")?.setAttribute("aria-valuenow", v); }, w);
const openPaper = async () => { await openFixturePaper(page, SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); };
await split(36);
await openPaper();
const settled = async () => { await page.waitForFunction(() => !/Saving/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }); await page.waitForTimeout(500); };
const pm = () => page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const caretAtEndOf = async text => { await pm().locator(`p:has-text("${text}")`).first().click(); return page.evaluate(t => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; let end = null; ed.state.doc.descendants((node, pos) => { if (end == null && node.isTextblock && node.textContent.includes(t)) end = pos + node.nodeSize - 1; }); if (end != null) { ed.view.focus(); ed.commands.setTextSelection(end); } return end; }, text); };

// ── the assistant half: a real turn on this note (Claude Code, then Codex), or a seeded transcript ──
// A reply that is an error result (a rate limit, a sign-in problem) is not a picture of the product; try the
// next provider, and only then seed a transcript — flagged in the manifest and the caption.
let chat = { real: false };
const prompt = 'Read the paper "Status: what the canvas does today" and append one short sentence at the end, noting that table header columns and alignment now survive a reload. Keep your reply to two lines.';
const clearChat = () => page.evaluate(() => { const s = window.__barkdown.state; const c = s.chats[s.current]; c.messages = []; c.runId = null; c.workingLabel = null; window.__barkdown.render(); });
for (const provider of ['claude', 'codex']) {
  try {
    await clearChat();
    await page.evaluate(p => { const s = window.__barkdown.state; s.chats[s.current].provider = p; window.__barkdown.render(); }, provider);
    await page.locator('#bw-prompt').fill(prompt);
    await page.locator('#bw-prompt').press('Enter');
    // A finished reply has a footer without the `live` class (time · tokens · cost · provider).
    await page.waitForFunction(() => document.querySelector('#bw-working')?.hidden === true && document.querySelectorAll('.bw-user-message').length === 1 && document.querySelectorAll('.bw-reply-foot:not(.live)').length >= 1, null, { timeout: 180000 });
    const reply = await page.evaluate(() => { const s = window.__barkdown.state; const c = s.chats[s.current]; const m = c.messages.filter(x => x.role === 'assistant').pop(); return { text: (m?.text || '') + ' ' + JSON.stringify(m?.tools || []).slice(0, 400), error: !!m?.error || (m?.tools || []).some(t => t.ok === false) }; });
    if (reply.error || /error result|rate.?limit|weekly limit|not signed in|unauthori[sz]ed/i.test(reply.text)) { console.error(provider + ' replied with an error: ' + reply.text.slice(0, 90)); continue; }
    chat = { real: true, provider };
    break;
  } catch (e) { console.error(provider + ' turn did not complete (' + (e.message || e).toString().slice(0, 80) + ')'); }
}
if (!chat.real) {
  console.error('seeding a transcript instead');
  await clearChat();
  await page.evaluate(() => { const s = window.__barkdown.state; const c = s.chats[s.current]; c.provider = 'claude'; c.messages.push({ role: 'user', text: 'Read the status note and summarize the verified table features.', at: new Date().toISOString() }); c.messages.push({ role: 'assistant', text: 'Header columns and cell alignment now save and survive a reload. The live row also checks that the reader matches the canvas.', at: new Date().toISOString(), provider: 'claude', tools: [{ id: 't1', name: 'read_document', input: { id: 'bp:barkdown-status' }, output: 'heading, paragraph, blockquote, list, table, callout, code' }], parts: [{ kind: 'tool', id: 't1' }, { kind: 'text', text: 'Header columns and cell alignment now save and survive a reload. The live row also checks that the reader matches the canvas.' }], usage: { cost: 0.012, durationMs: 21000, tokens: { input: 2100, output: 90 } }, events: [{ label: 'Proposed a change to Status: what the canvas does today', target: { kind: 'doc', id: 'bp:barkdown-status', title: 'Status: what the canvas does today' }, at: new Date().toISOString() }], approvals: [] }); window.__barkdown.render(); });
  chat = { real: false, seeded: true, provider: 'claude' };
}
await page.waitForTimeout(600);
// Agent tools may select another tab. Capture the showcase, not that incidental tab.
await openPaper();
await settled();
// Dismiss incidental shell menus through the ordinary keyboard path before overview shots.
await page.keyboard.press('Escape');
await page.locator('.bw-menu:visible').waitFor({ state: 'hidden' });

// Fold the tool steps (their summaries still say what was read and edited) and scroll the transcript.
const tidyChat = (where = 'top') => page.evaluate(w => { document.querySelectorAll('details.bw-step').forEach(d => { d.open = false; }); const t = document.querySelector('#bw-transcript'); if (t) t.scrollTop = w === 'bottom' ? t.scrollHeight : 0; }, where);
await tidyChat('top');
const shots = [];
const shot = async (file, caption, fn, check) => { await split(36); if (fn) await fn(); await settled(); if (check) await check(); await page.screenshot({ path: path.join(out, file) }); shots.push({ file, caption }); console.log('shot', file); };
await shot('paper-light.png', `A Barkpark paper edited live in the canvas inside Barkdown, beside ${chat.real ? `a real ${chat.provider === 'codex' ? 'Codex' : 'Claude Code'} turn on it` : 'the assistant transcript'}: quote, checklist, table, callout and code, saved as ops to a local Barkpark.`, async () => { await pm().locator('p').first().hover(); });
await shot('paper-dark.png', 'The same paper and conversation in dark mode.', async () => { await page.emulateMedia({ colorScheme: 'dark' }); });
await page.emulateMedia({ colorScheme: 'light' });
await shot('slash-menu.png', 'The slash menu inside the paper, with the plain Quote row beside Callout and Code.', async () => { await caretAtEndOf('A note in Barkdown'); await page.keyboard.press('Enter'); await settled(); await page.keyboard.type('/'); }, async () => { await page.locator('body .bp-slash-menu').waitFor({ state: 'visible' }); });
await page.keyboard.press('Escape'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await settled();
await shot('quick-open.png', 'Quick open (Ctrl+K) over tabs, papers, chats and actions.', async () => { await page.evaluate(() => window.__barkdown.openPalette()); await page.waitForTimeout(300); await page.keyboard.type('stat'); });
await page.keyboard.press('Escape');
await shot('settings-barkpark.png', 'Settings › Barkpark: the connection Barkdown edits through — here the local server.', async () => { await page.locator('#bw-settings').click(); await page.locator('.bw-settings-nav [data-pane="barkpark"]').click(); });
await page.locator('.bw-settings [data-act="cancel"]').click().catch(() => {});

// ── the GIF: a short editing loop, frames captured while it happens ──
await page.setViewportSize({ width: 1760, height: 900 });
await split(36);
await page.waitForTimeout(500); await settled(); await tidyChat('bottom');
const frames = []; let last = 0; let keystrokes = 0;
const frame = async (holdMs = 0) => { const png = PNG.sync.read(await page.screenshot({ type: 'png' })); frames.push({ data: png.data, width: png.width, height: png.height, delay: Math.max(120, holdMs || Date.now() - last || 120) }); last = Date.now(); };
const typeSlow = async (s, per = 40) => { for (const ch of s) { await page.keyboard.type(ch); if ((keystrokes++ % 2) === 0) await frame(); await page.waitForTimeout(per); } };
await caretAtEndOf('A note in Barkdown'); await frame(900);
await page.keyboard.press('Enter'); await frame(300);
await typeSlow('/quo'); await frame(800);
await page.keyboard.press('Enter'); await frame(400);
await typeSlow('Notes are papers; the canvas is Tiptap.'); await frame(900);
const cell = pm().locator('.bp-table__td').first(); await cell.click(); await page.keyboard.press('End'); await frame(500);
await page.keyboard.press('Tab'); await frame(400); await typeSlow('11/11'); await frame(700);
await page.evaluate(() => window.__barkdown.openPalette());
// Keep the motion proof readable: the palette's short CSS entrance transition
// paints several intermediate shadow bounds that GIF's 256-colour frames turn
// into false concentric bands. Let the real transition settle, then record the
// user's query appearing in the stable modal.
await page.waitForTimeout(350); await frame(600); await typeSlow('stat'); await frame(1200);
await page.keyboard.press('Escape'); await settled(); await frame(1500);
// GIF has only 256 colours per frame. ImageMagick's Floyd-Steinberg conversion
// preserves the modal shadow as a smooth visual texture; gifenc has no dithering
// and rendered the same gradient as broad false concentric bands. Keep the lossless
// source frames in the retained capture directory and pass each real frame delay.
const gifFramesDir = path.join(userData, 'status-gif-frames');
fs.mkdirSync(gifFramesDir, { recursive: true });
const gifArgs = [];
for (const [i, f] of frames.entries()) {
  const file = path.join(gifFramesDir, `${String(i).padStart(3, '0')}.png`);
  fs.writeFileSync(file, PNG.sync.write({ width: f.width, height: f.height, data: f.data }));
  gifArgs.push('-delay', String(Math.max(1, Math.round((i === frames.length - 1 ? 2000 : f.delay) / 10))), file);
}
gifArgs.push('-dither', 'FloydSteinberg', '-colors', '256', '-loop', '0', path.join(out, 'editing.gif'));
execFileSync('magick', gifArgs, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20e6 });
shots.push({ file: 'editing.gif', caption: 'An editing loop in the canvas: slash menu → Quote, typing, Tab through the table, quick open.' });
console.log('gif', frames.length, 'frames,', Math.round(fs.statSync(path.join(out, 'editing.gif')).size / 1024), 'KB');

// ── the manifest: what each picture shows, and which code it came from ──
const rows = {};
const resultsDir = path.join(appDir, 'test-results');
for (const t of ['tables', 'multiblock', 'tablehead']) {
  try { const files = fs.readdirSync(resultsDir).filter(f => new RegExp(`^${t}(-[a-z0-9]+)?\\.json$`).test(f)).map(f => path.join(resultsDir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs); if (files.length) rows[t] = JSON.parse(fs.readFileSync(files[0], 'utf8')).summary; } catch {}
}
const readme = fs.readFileSync(path.join(appDir, 'README.md'), 'utf8');
const manifest = {
  capturedAt: new Date().toISOString(),
  barkdownCommit: git(['rev-parse', 'HEAD']),
  barkdownTreeDirty: git(['status', '--porcelain', '--', 'app/renderer', 'app/main', 'app/shared']) !== '',
  barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT || /commit `([0-9a-f]{7,})`/.exec(readme)?.[1] || null,
  barkparkTreeDirty: process.env.BARKDOWN_SHOTS_BP_DIRTY == null ? null : process.env.BARKDOWN_SHOTS_BP_DIRTY === 'true',
  isolatedRuntime: process.env.BARKDOWN_SHOTS_ISOLATED === '1',
  server: await (async () => { try { const r = await fetch(captureServer + '/status.json'); const j = await r.json(); return { url: captureServer, version: j.version }; } catch { return null; } })(),
  chat,
  split: await page.evaluate(() => getComputedStyle(document.getElementById("app")).getPropertyValue("--bw-chat").trim()),
  rows,
  shots,
};
// Content-hashed filenames: GitHub (camo) caches README images by URL, so a picture with the same name as
// last time is served stale for hours after a push. Each capture writes <name>.<8-hex>.<ext>, retains the
// previous versions, and points the README's image links at the new names. npm run check still requires every
// embedded status image to be listed in the manifest.
const crypto = await import('node:crypto');
const readmePath = path.join(repo, 'README.md');
let rootReadme = fs.readFileSync(readmePath, 'utf8');
for (const shotEntry of manifest.shots) {
  const ext = shotEntry.file.split('.').pop();
  const base = shotEntry.file.slice(0, -(ext.length + 1));
  const bytes = fs.readFileSync(path.join(out, shotEntry.file));
  const hash = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 8);
  const hashed = base + '.' + hash + '.' + ext;
  // Never remove prior evidence; README references advance only after the new capture.
  fs.writeFileSync(path.join(out, hashed), bytes);
  rootReadme = rootReadme.replace(new RegExp('docs/images/status/' + base + '(\\.[0-9a-f]{8})?\\.' + ext, 'g'), () => 'docs/images/status/' + hashed);
  shotEntry.file = hashed;
}
fs.writeFileSync(readmePath, rootReadme);
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
archiveStatusManifest(out, manifest);
// Retain temporary capture data for diagnosis; shutdown always runs below.
console.log(`wrote ${shots.length} pictures + manifest to ${out}`);

} finally { await app.close(); }
