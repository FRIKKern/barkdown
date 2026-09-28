import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture, paperFixtureScope } from './lib/paper-fixture.mjs';
// Row for the highlight mark (plan #15, the pipeline proof): ==text== and the bubble's H make a highlight in
// the canvas; the server stores a `highlight` inline wrapper; the reader renders <mark class="bp-highlight">.
// Live against the bp-connected server; not part of npm test. Red until every layer is in.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-highlight';
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], { ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input }), shell: true, encoding: 'utf8', maxBuffer: 20e6 }));
for (const [id, title] of [['barkdown', 'Barkdown'], ['scratch', 'Scratch']]) { try { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); } catch (e) { console.error(`tag ${id}: ${(e.stdout || e.message).toString().slice(0, 160)}`); } }
const text = v => [{ type: 'text', value: v }];
bp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, title: 'Highlight mark round trip', description: 'Scratch paper for the Barkdown highlight-mark parity probe: a marked run typed with ==, toggled from the bubble, stored as a highlight inline wrapper and rendered as <mark>. Rewritten on every run of tests/editor-highlight.live.mjs.', tags: [{ tag: 'barkdown', strength: 88, rationale: 'owned by the Barkdown editor suite' }, { tag: 'scratch', strength: 33, rationale: 'disposable fixture for one mark' }], blocks: [{ type: 'heading', level: 1, text: 'Highlight mark round trip' }, { type: 'paragraph', content: text('The first paragraph is plain prose where the row types a marked run.') }, { type: 'paragraph', content: text('Nothing in this one carries a mark, so the shapes compare cleanly around it.') }, { type: 'paragraph', content: [{ type: 'text', value: 'Already ' }, { type: 'highlight', children: text('marked') }, { type: 'text', value: ' on the server.' }] }] }));

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-highlight-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await openFixturePaper(page, SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });

// Each paragraph as "text with <h>…</h> around highlighted runs", canvas and server alike.
const canvasShape = () => page.evaluate(() => {
  const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
  return c._editor.getJSON().content.filter(n => n.type === 'paragraph').map(n => (n.content || []).map(x => (x.marks || []).some(m => m.type === 'highlight') ? `<h>${x.text}</h>` : x.text).join(''));
});
const serverShape = () => { const r = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); const d = r.document || r; const inline = a => (a || []).map(x => x.type === 'highlight' ? `<h>${inline(x.children)}</h>` : x.type === 'text' ? x.value : inline(x.children)).join(''); return d.blocks.filter(b => b.type === 'paragraph').map(b => inline(b.content)); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const waitSaved = async () => { await page.waitForFunction(() => /Saved · rev|Not saved|Conflict/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); return page.locator('.bw-paper-pane:not([hidden]) #save-state').innerText(); };
const settle = () => page.waitForTimeout(600);
const compare = async () => { const save = await waitSaved(); await settle(); const canvas = await canvasShape(); const server = serverShape(); return { pass: same(server, canvas), save, canvas, server }; };
const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 200) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
// End targets a visual line, not the paragraph. Pin this mark probe to its
// intended text so wrapping cannot turn a correct toggle into a false failure.
const selectFirstParagraph = async (word = null) => {
  await pm.locator('p:has-text("first paragraph")').first().click();
  await page.evaluate(word => {
    const editor = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;
    let range;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== 'paragraph' || !node.textContent.includes('first paragraph')) return;
      const offset = word == null ? node.content.size : node.textContent.lastIndexOf(word);
      if (offset < 0) throw Error(`Missing selection text: ${word}`);
      range = { from: pos + 1 + offset, to: pos + 1 + offset + (word?.length || 0) };
    });
    if (!range) throw Error('Missing fixture paragraph');
    editor.commands.setTextSelection(range);
    editor.view.focus();
  }, word);
  await page.waitForFunction(word => {
    const editor = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;
    const { from, to } = editor.state.selection;
    return editor.view.hasFocus() && editor.state.doc.textBetween(from, to) === (word || '');
  }, word);
};

await row('a highlight stored on the server mounts as a highlight mark in the canvas', async () => { const c = await canvasShape(); return { pass: c.some(s => s.includes('<h>marked</h>')), canvas: c }; });
await row('==text== makes a highlight; the server stores the highlight wrapper', async () => {
  await selectFirstParagraph(); await page.keyboard.type(' and ==bright== words'); await settle();
  const r = await compare(); return { ...r, pass: r.pass && r.canvas.some(s => s.includes('<h>bright</h>')) };
});
await row('the bubble’s H toggles a highlight on a selection; server follows', async () => {
  await selectFirstParagraph('words');
  await page.locator('body .bp-paper-format__btn--highlight').first().click(); await settle();
  const r = await compare(); return { ...r, pass: r.pass && r.canvas.some(s => s.includes('<h>words</h>')) };
});
await row('Ctrl+Shift+H removes it again; server follows', async () => {
  await page.keyboard.press(`${MOD}+Shift+h`); await settle();
  const r = await compare(); return { ...r, pass: r.pass && !r.canvas.some(s => s.includes('<h>words</h>')) };
});
await row('the reader renders the highlight as <mark class="bp-highlight">', async () => {
  const server = paperFixtureScope().server.replace(/\/$/, '');
  const html = await (await fetch(`${server.replace(/\/$/, '')}/papers/${SLUG}`)).text();
  return { pass: /<mark class="bp-highlight">bright<\/mark>/.test(html), sample: (html.match(/.{0,60}bright.{0,60}/) || [''])[0] };
});
await row('reload: highlights come back from the server as shown', async () => {
  const before = await canvasShape();
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(500);
  await openFixturePaper(page, SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await settle();
  const after = await canvasShape(); return { pass: same(before, after) && same(after, serverShape()), before, after };
});

await page.screenshot({ path: 'test-results/34-highlight.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
