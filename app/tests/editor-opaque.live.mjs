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
  { type: 'equation', value: 'E = mc^2' },
  { type: 'video', src: 'https://example.com/v.mp4' },
  { type: 'expandable', title: 'Details', children: [{ type: 'paragraph', content: text('Hidden.') }] },
  { type: 'steps', items: [text('first'), text('second')] },
  { type: 'footnote', content: text('A footnote.') },
  { type: 'toc' },
  { type: 'embed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { type: 'pullquote', content: text('A pull quote.') },
  { type: 'section', title: 'Section', children: [{ type: 'paragraph', content: text('In a section.') }] },
  { type: 'columns', children: [{ type: 'paragraph', content: text('Left.') }, { type: 'paragraph', content: text('Right.') }] },
  { type: 'tabs', children: [{ type: 'paragraph', content: text('Tab one.') }] },
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
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
await page.waitForTimeout(800);

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
await page.screenshot({ path: 'test-results/33-opaque.png', fullPage: true });
console.log(JSON.stringify({ summary: `${passed}/${rows.length} note block types mount editable`, opaque: rows.filter(r => !r.pass).map(r => r.type), readOnlyAtoms: rows.filter(r => r.pass && r.readOnly).map(r => r.type + ':' + r.mounted), rows, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === rows.length ? 0 : 1;
