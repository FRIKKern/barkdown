import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Row 12 of docs/EDITOR-PARITY.md: the opaque set for note content. Barkdown mounts the WHOLE paper in the
// canvas, so any block the canvas projector cannot dispatch shows the author a read-only bpOpaque chip. This row
// publishes a paper holding every block type a note can plausibly contain (the server registers them; agents,
// Studio and markdown import write them) and asserts each mounts as an editable or purpose-built node, never as
// bpOpaque, and that the server still holds the same block list after a save. Red by design until the canvas
// learns the missing types. Live against the bp-connected server; not part of npm test.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-opaque';
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], { ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input }), shell: true, encoding: 'utf8', maxBuffer: 20e6 }));
for (const [id, title] of [['barkdown', 'Barkdown'], ['scratch', 'Scratch']]) { try { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); } catch (e) { console.error(`tag ${id}: ${(e.stdout || e.message).toString().slice(0, 200)}`); } }
const text = value => [{ type: 'text', value }];

// Every block type a note can contain, with the minimal shape the server accepts. The expectation is the canvas
// node it should mount as; "editable" means any node that is not bpOpaque and not a read-only atom.
const NOTE_BLOCKS = [
  { type: 'heading', level: 2, text: 'Heading' },
  { type: 'paragraph', content: text('Paragraph.') },
  { type: 'list', ordered: false, items: [text('bullet')] },
  { type: 'list', ordered: true, items: [text('numbered')] },
  { type: 'list', task: true, items: [{ content: text('todo'), checked: false }] },
  { type: 'blockquote', content: text('A plain quote.') },
  { type: 'callout', tone: 'info', content: text('A callout.') },
  { type: 'code', lang: 'js', value: 'const x = 1;' },
  { type: 'divider' },
  { type: 'table', head: [text('a'), text('b')], rows: [[text('1'), text('2')]] },
  { type: 'image', src: 'https://example.com/x.png', alt: 'An image' },
  { type: 'figure', children: [{ type: 'paragraph', content: text('Figure caption.') }] },
  { type: 'diagram', value: 'graph TD; a-->b' },
  { type: 'equation', tex: 'E = mc^2' },
  { type: 'video', src: 'https://example.com/v.mp4' },
  { type: 'expandable', summary: 'Details', blocks: [{ type: 'paragraph', content: text('Hidden.') }] },
  { type: 'steps', steps: [{ title: 'First', blocks: [{ type: 'paragraph', content: text('Do this.') }] }, { title: 'Second', blocks: [{ type: 'paragraph', content: text('Then that.') }] }] },
  { type: 'footnote', notes: [{ text: 'A footnote.' }] },
  { type: 'toc', items: [{ text: 'Heading', level: 1 }] },
  { type: 'embed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { type: 'pullquote', content: text('A pull quote.') },
  { type: 'section', title: 'Section', children: [{ type: 'paragraph', content: text('In a section.') }] },
  { type: 'columns', children: [{ type: 'paragraph', content: text('Left.') }, { type: 'paragraph', content: text('Right.') }] },
  { type: 'tabs', tabs: [{ label: 'One', blocks: [{ type: 'paragraph', content: text('Tab one.') }] }, { label: 'Two', blocks: [{ type: 'paragraph', content: text('Tab two.') }] }] },
];
let published;
try {
  // The server's dedup wall refuses a publish that near-duplicates another paper; this one must read differently
  // from the other scratch papers, so its description and lead say what it holds.
  published = bp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, title: 'Every block a note can hold', description: 'A census fixture: one instance of every PortableDoc block type a note can contain, from blockquote and image to equation, steps, footnote and tabs, so the Barkdown canvas can be checked for read-only chips. Rewritten by tests/editor-opaque.live.mjs.', tags: [{ tag: 'barkdown', strength: 90, rationale: 'owned by the Barkdown editor suite' }, { tag: 'scratch', strength: 40, rationale: 'disposable census fixture' }], blocks: [{ type: 'heading', level: 1, text: 'Every block a note can hold' }, { type: 'paragraph', content: text('Twenty-four block types follow, one of each, so the canvas can be checked for the read-only chip that marks a type it cannot edit.') }, ...NOTE_BLOCKS] }));
} catch (e) {
  // A type the server refuses is itself a finding: report it and publish without it.
  console.error('publish refused: ' + (e.stdout || e.message).toString().slice(0, 400));
  process.exit(2);
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-opaque-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
await page.waitForTimeout(800);

// Plan #2: the editor running here is the connected server's bundle, not the vendored copy — the stamp is the
// sha1 of the bytes the server serves, compared with what the app says it loaded.
const bundle = await (async () => {
  try {
    const info = await page.evaluate(() => window.__barkdown.state.canvasBundle);
    const server = (JSON.parse(execFileSync('bp', ['use', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })).active || {}).server || 'http://localhost:4000';
    const bytes = Buffer.from(await (await fetch(server.replace(/\/$/, '') + '/assets/bp-paper-editor.bundle.js')).arrayBuffer());
    const sha = (await import('crypto')).createHash('sha1').update(bytes).digest('hex');
    return { pass: info?.source === 'server' && info?.sha === sha, source: info?.source, appSha: info?.sha?.slice(0, 8), serverSha: sha.slice(0, 8), version: info?.version };
  } catch (e) { return { pass: false, error: e.message.slice(0, 200) }; }
})();
// What the canvas mounted for each server block, by id order.
const mounted = await page.evaluate(() => {
  const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
  return c._editor.getJSON().content.map(n => ({ node: n.type, bpType: n.attrs?.bpType || null, bpId: n.attrs?.bpId || null }));
});
const server = (() => { const r = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); const d = r.document || r; return d.blocks.map(b => ({ id: b.id, type: b.type })); })();
const READ_ONLY = new Set(['bpOpaque', 'bpFleet', 'bpSheet', 'bpEmbed']);
const results = [];
for (let i = 0; i < server.length; i++) {
  const s = server[i]; const m = mounted[i];
  if (!m) { results.push({ type: s.type, pass: false, mounted: '(missing)' }); continue; }
  const opaque = m.node === 'bpOpaque';
  const readOnly = READ_ONLY.has(m.node);
  results.push({ type: s.type, pass: !opaque, mounted: m.node, readOnly, note: opaque ? 'read-only chip: the author cannot edit this block' : readOnly ? 'read-only atom (server-painted); acceptable for embeds, red for note content' : '' });
}
// Duplicates (two list variants, two figures) collapse to one line per server type for the summary.
const byType = new Map(); for (const r of results) if (!byType.has(r.type) || !r.pass) byType.set(r.type, r);
const rows = [...byType.values()];
const passed = rows.filter(r => r.pass).length;
// Editability is more than mounting: for each type that stopped being opaque, one edit that the server must
// hold. image (2026-09-20): alt typed into the node's alt input, a url pasted into its url input.
const edits = [];
const serverBlock = (type) => { const r = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); const d = r.document || r; return d.blocks.find(b => b.type === type) || null; };
// Wait for the NEXT save, not the last one: the state text must move on from what it said before the edit
// (an instant fill() would otherwise read the server before the batch went out), then settle.
const saveState = () => page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || '');
const waitSavedFrom = async (before) => { await page.waitForFunction((prev) => { const t = document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''; return t !== prev && /Saved · rev|Not saved|Conflict/.test(t); }, before, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(600); };
try {
  const img = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas figure[data-bp-type="image"]').first();
  if (await img.count()) {
    await img.hover();
    const alt = img.locator('input.bp-canvas-image-alt');
    const s1 = await saveState(); await alt.click(); await alt.fill('A described image'); await alt.press('Enter'); await waitSavedFrom(s1);
    const afterAlt = serverBlock('image');
    edits.push({ type: 'image', edit: 'alt', pass: afterAlt?.alt === 'A described image', server: afterAlt });
    const src = img.locator('input.bp-canvas-image-src');
    const s2 = await saveState(); await src.click(); await src.fill('https://example.com/y.png'); await src.press('Enter'); await waitSavedFrom(s2);
    const afterSrc = serverBlock('image');
    const shown = await img.locator('img').getAttribute('src');
    edits.push({ type: 'image', edit: 'src', pass: afterSrc?.src === 'https://example.com/y.png' && shown === 'https://example.com/y.png' && afterSrc?.alt === 'A described image', server: afterSrc, shown });
  } else {
    edits.push({ type: 'image', edit: 'mount', pass: false, note: 'no bpImage figure in the canvas' });
  }
} catch (e) { edits.push({ type: 'image', edit: 'error', pass: false, error: e.message.slice(0, 200) }); }
// expandable (2026-09-20): the summary typed in its island, a word typed into the body paragraph.
try {
  const tog = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas [data-bp-type="expandable"]').first();
  if (await tog.count()) {
    const summary = tog.locator('.bp-expandable__summary').first();
    const s3 = await saveState(); await summary.click(); await summary.fill('Details and more'); await summary.press('Enter'); await waitSavedFrom(s3);
    const afterSummary = serverBlock('expandable');
    edits.push({ type: 'expandable', edit: 'summary', pass: afterSummary?.summary === 'Details and more', server: afterSummary });
    const para = tog.locator('.bp-expandable__body p').first();
    const s4 = await saveState(); await para.click(); await page.keyboard.press('End'); await page.keyboard.type(' Shown.'); await waitSavedFrom(s4);
    const afterBody = serverBlock('expandable');
    const bodyText = ((afterBody?.blocks || afterBody?.children || [])[0]?.content || []).map(x => x.value || '').join('');
    edits.push({ type: 'expandable', edit: 'body', pass: bodyText === 'Hidden. Shown.' && afterBody?.summary === 'Details and more', server: afterBody });
  } else {
    edits.push({ type: 'expandable', edit: 'mount', pass: false, note: 'no bpExpandable node in the canvas' });
  }
} catch (e) { edits.push({ type: 'expandable', edit: 'error', pass: false, error: e.message.slice(0, 200) }); }
// steps / tabs (2026-09-20): a step title typed into its input, a word typed into a tab's body.
try {
  const stepTitle = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas [data-bp-type="steps"] input.bp-canvas-row__title').first();
  if (await stepTitle.count()) {
    const s5 = await saveState(); await stepTitle.click(); await stepTitle.fill('First, renamed'); await stepTitle.press('Enter'); await waitSavedFrom(s5);
    const after = serverBlock('steps');
    edits.push({ type: 'steps', edit: 'title', pass: after?.steps?.[0]?.title === 'First, renamed' && after?.steps?.[1]?.title === 'Second', server: after });
  } else edits.push({ type: 'steps', edit: 'mount', pass: false, note: 'no step title input in the canvas' });
  const tabBody = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas [data-bp-type="tabs"] .bp-canvas-row__body p').first();
  if (await tabBody.count()) {
    const s6 = await saveState(); await tabBody.click(); await page.keyboard.press('End'); await page.keyboard.type(' Edited.'); await waitSavedFrom(s6);
    const after = serverBlock('tabs');
    const t0 = ((after?.tabs?.[0]?.blocks || [])[0]?.content || []).map(x => x.value || '').join('');
    edits.push({ type: 'tabs', edit: 'body', pass: t0 === 'Tab one. Edited.' && after?.tabs?.[0]?.label === 'One' && after?.tabs?.[1]?.label === 'Two', server: after });
  } else edits.push({ type: 'tabs', edit: 'mount', pass: false, note: 'no tab body in the canvas' });
} catch (e) { edits.push({ type: 'steps/tabs', edit: 'error', pass: false, error: e.message.slice(0, 200) }); }
// equation / footnote / toc / video (2026-09-20): one field each, committed with Enter (Ctrl+Enter in a textarea).
const island = async (type, key, value, expect) => {
  try {
    const node = page.locator(`.bw-paper-pane:not([hidden]) bp-paper-canvas [data-bp-type="${type}"]`).first();
    if (!(await node.count())) { edits.push({ type, edit: 'mount', pass: false, note: 'no ' + type + ' node in the canvas' }); return; }
    await node.hover();
    const input = node.locator(`[data-test-id="paper-${type}-${key}"]`).first();
    const s0 = await saveState(); await input.click(); await input.fill(value); await input.press('Control+Enter'); await waitSavedFrom(s0);
    const after = serverBlock(type);
    edits.push({ type, edit: key, pass: expect(after), server: after });
  } catch (e) { edits.push({ type, edit: key, pass: false, error: e.message.slice(0, 200) }); }
};
await island('equation', 'tex', 'a^2 + b^2 = c^2', (b) => b?.tex === 'a^2 + b^2 = c^2');
await island('footnote', 'notes', 'A footnote.\nA second one.', (b) => Array.isArray(b?.notes) && b.notes.length === 2 && b.notes[1]?.text === 'A second one.');
await island('toc', 'items', 'Heading\n  Sub-heading | sub', (b) => Array.isArray(b?.items) && b.items.length === 2 && b.items[1]?.level === 2 && b.items[1]?.anchor === 'sub');
await island('video', 'src', 'https://example.com/w.mp4', (b) => b?.src === 'https://example.com/w.mp4');
// The second half of the acceptance: each type that stopped being opaque can be INSERTED through the slash
// menu, and the server gains a block of that type. Each insert starts from a fresh paragraph after the intro.
const inserts = [];
const countOnServer = (type) => { const r = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); const d = r.document || r; return d.blocks.filter(b => b.type === type).length; };
// Top-level canvas nodes of a portable-doc type (the projector stamps bpType on every node).
const countInCanvas = (type) => page.evaluate((t) => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c._editor.getJSON().content.filter(n => (n.attrs?.bpType || n.type) === t).length; }, type);
// The typed "/label" is itself an edit that saves, so the save state moving on says nothing about the insert;
// the server is polled until it holds one more block of the type (or 20 s pass).
const waitServerCount = async (type, expected) => { for (let i = 0; i < 20; i++) { if (countOnServer(type) === expected) return true; await page.waitForTimeout(1000); } return false; };
const slashInsert = async (label, type) => {
  try {
    const before = countOnServer(type);
    const inCanvasBefore = await countInCanvas(type);
    const intro = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror p:has-text("block types follow")').first();
    // A field island may still hold focus from the edit steps; the click must land the caret in prose.
    await page.keyboard.press('Escape').catch(() => {});
    await intro.click(); await page.waitForTimeout(150);
    const inProse = await page.evaluate(() => !!document.activeElement?.closest?.('.ProseMirror'));
    if (!inProse) { await intro.click(); await page.waitForTimeout(150); }
    await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const ed = c._editor; const { state } = ed; const $from = state.selection.$from; ed.commands.setTextSelection($from.end($from.depth)); ed.commands.focus(); });
    await page.keyboard.press('Enter'); await page.keyboard.type('/' + label); await page.waitForTimeout(500);
    const menu = page.locator('body .bp-slash-menu'); const menuText = (await menu.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80);
    await page.keyboard.press('Enter');
    await page.waitForFunction(([t, n]) => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c._editor.getJSON().content.filter(x => (x.attrs?.bpType || x.type) === t).length >= n; }, [type, inCanvasBefore + 1], { timeout: 5000 }).catch(() => {});
    const inCanvasAfter = await countInCanvas(type);
    const landed = await waitServerCount(type, before + 1);
    const after = countOnServer(type);
    inserts.push({ type, label, pass: landed, before, after, inCanvasBefore, inCanvasAfter, menu: menuText });
  } catch (e) { inserts.push({ type, label, pass: false, error: e.message.slice(0, 200) }); }
};
await slashInsert('Quote', 'blockquote');
await slashInsert('Image', 'image');
await slashInsert('Toggle', 'expandable');
await slashInsert('Steps', 'steps');
await slashInsert('Tabs', 'tabs');
await slashInsert('Equation', 'equation');
await slashInsert('Footnotes', 'footnote');
await slashInsert('Contents', 'toc');
await slashInsert('Video', 'video');
const insertsPassed = inserts.filter(i => i.pass).length;
const editsPassed = edits.filter(e => e.pass).length;
await page.screenshot({ path: 'test-results/33-opaque.png', fullPage: true });
console.log(JSON.stringify({ summary: `${passed}/${rows.length} note block types mount editable; ${editsPassed}/${edits.length} edits held by the server; ${insertsPassed}/${inserts.length} slash inserts land on the server; editor bundle ${bundle.pass ? 'from the server' : 'NOT from the server'}`, bundle, edits, inserts, opaque: rows.filter(r => !r.pass).map(r => r.type), readOnlyAtoms: rows.filter(r => r.pass && r.readOnly).map(r => r.type + ':' + r.mounted), rows, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === rows.length && editsPassed === edits.length && insertsPassed === inserts.length && bundle.pass ? 0 : 1;
