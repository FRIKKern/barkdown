// Row 11 of docs/EDITOR-PARITY.md: multi-block edits across the ops round trip. The continuous canvas gives
// cross-block selection, copy, paste and undo for free; the ops diff and the echo reconciliation are where the
// server can silently drift from what the author sees. So every step here compares the canvas's block list with
// the server's once the tab says "Saved". Live against the bp-connected server; not part of npm test.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-multiblock';
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], { ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input }), shell: true, encoding: 'utf8', maxBuffer: 20e6 }));
for (const [id, title] of [['barkdown', 'Barkdown'], ['scratch', 'Scratch']]) { try { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); } catch (e) { console.error(`tag ${id}: ${(e.stdout || e.message).toString().slice(0, 200)}`); } }
const text = value => [{ type: 'text', value }];
bp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, title: 'Multi-block probe', description: 'Scratch paper for the Barkdown multi-block parity probe; rewritten on every run of tests/editor-multiblock.live.mjs.', tags: [{ tag: 'barkdown', strength: 90, rationale: 'owned by the Barkdown editor suite' }, { tag: 'scratch', strength: 40, rationale: 'disposable test fixture' }], blocks: [
  { type: 'heading', level: 1, text: 'Multi-block probe' },
  { type: 'paragraph', content: text('First paragraph here.') },
  { type: 'paragraph', content: text('Second paragraph here.') },
  { type: 'paragraph', content: text('Third paragraph here.') },
  { type: 'list', ordered: false, items: [text('alpha item'), text('beta item')] },
  { type: 'paragraph', content: text('Closing line.') },
] }));
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-multi-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
const open = async () => { await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG); await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 }); await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 }); };
await open();

// Both sides as the same list of "kind:text" strings, so a diff reads as an author would see it.
const canvasShape = () => page.evaluate(() => {
  const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
  const inline = n => (n.content || []).map(x => x.type === 'text' ? x.text : x.content ? inline(x) : '').join('');
  const kind = t => ({ bulletList: 'list', orderedList: 'list', taskList: 'list', bpCode: 'code', bpDivider: 'divider' })[t] || t;
  return c._editor.getJSON().content.map(n => /List$/.test(n.type) ? 'list:' + (n.content || []).map(inline).join('|') : kind(n.type) + ':' + inline(n));
});
const serverShape = () => {
  const r = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); const d = r.document || r;
  const inline = a => Array.isArray(a) ? a.map(x => x.value ?? x.text ?? (x.content ? inline(x.content) : '')).join('') : typeof a === 'string' ? a : '';
  const item = it => Array.isArray(it) ? inline(it) : it && typeof it === 'object' ? inline(it.content || it.inline || []) : String(it ?? '');
  return d.blocks.map(b => b.type === 'list' ? 'list:' + (b.items || []).map(item).join('|') : b.type + ':' + (b.text != null ? b.text : inline(b.content)));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const waitSaved = async () => { await page.waitForFunction(() => /Saved · rev|Not saved|Conflict/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); return page.locator('.bw-paper-pane:not([hidden]) #save-state').innerText(); };
const settle = () => page.waitForTimeout(600);
// Compare once the UI says "Saved", then again 3s later if it differed: a later match means the save state showed
// too early; a persistent mismatch means an op was lost or mis-diffed. Either is red.
const compare = async () => { const save = await waitSaved(); await settle(); const canvas = await canvasShape(); const server = serverShape(); const pass = same(server, canvas); let serverLater, refusal; if (!pass) { refusal = (await page.locator('.bw-paper-pane:not([hidden]) #conflict').innerText().catch(() => '')).trim().slice(0, 300) || undefined; await page.waitForTimeout(3000); serverLater = serverShape(); } return { pass, save, canvas, server, ...(refusal ? { refusal } : {}), ...(serverLater ? { serverLater, lateMatch: same(serverLater, canvas) } : {}) }; };

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 200) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
// Click into the paragraph holding `t`, then make sure the caret is there (a click on the CI runner does not always
// move the caret out of a live selection): otherwise place it programmatically at the block's edge.
const clickText = async (t, where = 'End') => { await pm.locator(`p:has-text("${t}")`).first().click(); await page.keyboard.press(where); await page.evaluate(([txt, w]) => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; if (ed.state.selection.empty && ed.state.selection.$from.parent.textContent.includes(txt)) return; let found = null; ed.state.doc.descendants((node, pos) => { if (found == null && node.isTextblock && node.textContent.includes(txt)) found = { pos, node }; }); if (found) { ed.commands.setTextSelection(w === 'Home' ? found.pos + 1 : found.pos + found.node.nodeSize - 1); ed.commands.focus(); } }, [t, where]); };
const original = await canvasShape();
// Select from inside one block's text to inside another's through ProseMirror, so a row tests the ops round trip
// of a spanning edit rather than how far Shift+Arrow happens to travel in a headless window.
const selectBetween = (fromText, fromOffset, toText, toOffset) => page.evaluate(([a, ao, b, bo]) => {
  const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; let from = null, to = null;
  ed.state.doc.descendants((node, pos) => { if (!node.isText) return; if (from == null && node.text.includes(a)) from = pos + node.text.indexOf(a) + ao; if (to == null && node.text.includes(b)) to = pos + node.text.indexOf(b) + bo; });
  ed.commands.setTextSelection({ from, to }); return { from, to };
}, [fromText, fromOffset, toText, toOffset]);

await row('baseline: canvas and server agree on open', async () => { const server = serverShape(); return { pass: same(server, original) && original.length === 6, canvas: original, server }; });

await row('select across two paragraphs and type: they merge; server matches', async () => {
  await clickText('First paragraph', 'End'); for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.type('joined'); await settle();
  const r = await compare(); return { ...r, pass: r.pass && r.canvas.length === 5 && r.canvas.some(s => s.includes('joined')) };
});
await row('undo the merge; server follows', async () => { await page.keyboard.press('Control+z'); await settle(); const r = await compare(); return { ...r, pass: r.pass && same(r.canvas, original) }; });

await row('select three whole blocks, copy, paste at the end: three blocks appended; server matches', async () => {
  await pm.click(); const sel = await selectBetween('First paragraph', 0, 'Third paragraph here.', 'Third paragraph here.'.length);
  // Capture what ProseMirror puts on the clipboard (its own copy handler fills the event), so the
  // paste can be replayed from that payload if the OS clipboard is not there (a bare X server in CI).
  await page.evaluate(() => { window.__clip = null; document.addEventListener('copy', e => { window.__clip = { html: e.clipboardData.getData('text/html'), text: e.clipboardData.getData('text/plain') }; }); });
  await page.keyboard.press('Control+c');
  await clickText('Closing line', 'End');
  const caret = await page.evaluate(() => { const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; return ed.state.selection.$from.parent.textContent.slice(0, 20); });
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+v'); await settle();
  let clipboard = 'os';
  let r = await compare();
  if (r.canvas.length !== 9) {
    // Replay ProseMirror's own payload through a synthetic paste event.
    clipboard = 'synthetic';
    const had = await page.evaluate(() => { const c = window.__clip; if (!c || !(c.html || c.text)) return false; const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; const dt = new DataTransfer(); if (c.html) dt.setData('text/html', c.html); if (c.text) dt.setData('text/plain', c.text); ed.view.dom.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; });
    await settle(); r = await compare(); clipboard = had ? 'synthetic' : 'none';
  }
  const tail = r.canvas.slice(-3);
  return { ...r, sel, caret, clipboard, pass: r.pass && r.canvas.length === 9 && same(tail, original.slice(1, 4)) };
});
await row('undo the paste; server follows', async () => { await page.keyboard.press('Control+z'); await settle(); await page.keyboard.press('Control+z'); await settle(); const r = await compare(); return { ...r, pass: r.pass && same(r.canvas, original) }; });

await row('delete a selection spanning a paragraph and a list: server matches', async () => {
  await pm.click(); const sel = await selectBetween('Third paragraph', 5, 'beta item', 4); await page.keyboard.press('Backspace'); await settle();
  const r = await compare(); return { ...r, sel, pass: r.pass && r.canvas.length < original.length && r.canvas.some(s => s.startsWith('paragraph:Third') && s.includes('item')) };
});
await row('undo the spanning delete; server follows', async () => { await page.keyboard.press('Control+z'); await settle(); const r = await compare(); return { ...r, pass: r.pass && same(r.canvas, original) }; });

// Barkpark vetoes a write that would leave a published paper with no content block, so cut-all cannot save. Parity
// here means: the author keeps what they see, the tab says why, and the very next edit saves and matches again.
await row('cut everything: the server vetoes an empty paper and the tab says so; paste back restores and matches', async () => {
  await clickText('Closing line'); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+x'); await settle(); const cutSave = await waitSaved();
  const refusal = (await page.locator('.bw-paper-pane:not([hidden]) #conflict').innerText().catch(() => '')).trim().slice(0, 200); const emptied = await canvasShape();
  await page.keyboard.press('Control+v'); await settle(); const r = await compare();
  return { ...r, cutSave, refusal, emptied, pass: r.pass && same(r.canvas, original) && emptied.length <= 1 && /last content block|hollow/i.test(refusal) };
});

await row('select all and type replaces the paper with one paragraph; server matches', async () => {
  await page.keyboard.press('Control+a'); await page.keyboard.type('fresh start'); await settle();
  const r = await compare(); return { ...r, pass: r.pass && r.canvas.length === 1 && r.canvas[0].includes('fresh start') };
});
await row('undo the replacement; server follows', async () => { await page.keyboard.press('Control+z'); await settle(); const r = await compare(); return { ...r, pass: r.pass && same(r.canvas, original) }; });

await row('reload: the paper comes back from the server as the canvas last showed it', async () => {
  await waitSaved(); const before = await canvasShape();
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(500); await open(); await settle();
  const after = await canvasShape(); return { pass: same(before, after) && same(after, serverShape()), before, after };
});

await page.screenshot({ path: 'test-results/32-multiblock.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
