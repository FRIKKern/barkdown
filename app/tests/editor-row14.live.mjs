import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Row 14 (plan #10, with #22's decision): heading levels stay at three and a deeper stored level survives;
// nested checklists with Tab; editing a link in place from the bubble; the placeholder on an empty block.
// Each behaviour is compared canvas against server. Live against the bp-connected server.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para, text } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-row14';
publishFixture({ slug: SLUG, title: 'Small behaviours, row fourteen', description: 'Scratch paper for Barkdown row 14: a stored level-four heading that must survive untouched, a paragraph a nested checklist grows from, a link to edit in place, and an empty block for the placeholder. Rewritten on every run of tests/editor-row14.live.mjs.', blocks: [
  { type: 'heading', level: 1, text: 'Small behaviours, row fourteen' },
  { type: 'heading', level: 4, text: 'A level-four heading an agent wrote' },
  para('Tasks start after this line:'),
  { type: 'paragraph', content: [{ type: 'text', value: 'Edit ' }, { type: 'link', href: 'https://old.example.org/page', children: text('the link') }, { type: 'text', value: ' in place.' }] },
  para('The last paragraph.'),
] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-row14-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug, paperOwner: window.__barkdown.state.barkparkDocs.find(d => d.id === slug)?.paperOwner }), SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
await page.waitForTimeout(500);

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const blocks = () => getPaper(SLUG).blocks;
const inl = a => (a || []).map(x => x.type === 'text' ? x.value : inl(x.children)).join('');
const waitBlocks = async (pred) => { for (let k = 0; k < 20; k++) { const b = blocks(); if (pred(b)) return b; await page.waitForTimeout(1000); } return blocks(); };
const caretEnd = async sel => {
  const target = pm.locator(sel).first(); await target.click();
  const expected = await target.evaluate(element => {
    const ed = element.closest('bp-paper-canvas')._editor;
    const end = ed.view.posAtDOM(element, element.childNodes.length);
    ed.view.focus(); ed.commands.setTextSelection(end); return end;
  });
  await page.waitForFunction(expected => {
    const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;
    return ed.view.hasFocus() && ed.state.selection.empty && ed.state.selection.from === expected && ed.state.selection.$from.parentOffset === ed.state.selection.$from.parent.content.size;
  }, expected);
};

await row('headings: the canvas offers three levels; a stored level-4 heading shows at the nearest level, a text edit keeps level 4 on the server; "#### " stays text', async () => {
  const levels = await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c._editor.extensionManager.extensions.find(e => e.name === 'heading')?.options?.levels; });
  const mounted = await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const h = c._editor.getJSON().content.filter(n => n.type === 'heading')[1]; return h && h.attrs.level; });
  // The deeper level is shown at the nearest of the three, and an edit to its text keeps it.
  await caretEnd('h3:has-text("level-four heading")');
  await page.keyboard.type(', edited');
  await caretEnd('p:has-text("The last paragraph")');
  await page.keyboard.press('Enter'); await page.keyboard.type('#### four hashes stay text');
  const b = await waitBlocks(x => x.some(y => y.type === 'paragraph' && /#### four hashes stay text/.test(inl(y.content))) && x.some(y => y.type === 'heading' && /, edited$/.test(y.text || '')));
  const h4 = b.find(x => x.type === 'heading' && /level-four heading/.test(x.text || ''));
  const literal = b.find(x => x.type === 'paragraph' && /#### four hashes stay text/.test(inl(x.content)));
  const noH4Made = !b.some(x => x.type === 'heading' && /four hashes/.test(x.text || ''));
  return { pass: JSON.stringify(levels) === '[1,2,3]' && mounted === 3 && !!h4 && h4.level === 4 && h4.text === 'A level-four heading an agent wrote, edited' && !!literal && noH4Made, levels, mounted, h4, literal: literal ? inl(literal.content) : null };
});
await row('nested checklist: "[ ] first", Enter, "second", Tab nests it; the server holds the nested task list; ticking the nested box lands checked:true', async () => {
  await caretEnd('p:has-text("Tasks start after")');
  await page.keyboard.press('Enter'); await page.keyboard.type('[ ] first'); await page.keyboard.press('Enter'); await page.keyboard.type('second'); await page.keyboard.press('Tab');
  let b = await waitBlocks(x => x.some(y => y.type === 'list' && y.task === true && Array.isArray(y.items?.[0]?.children)));
  const list = b.find(y => y.type === 'list' && y.task === true);
  const nested = list?.items?.[0]?.children?.[0];
  const nestedText = nested ? inl(nested.items?.[0]?.content || nested.items?.[0]) : null;
  await pm.locator('li[data-type="taskItem"] li[data-type="taskItem"] input[type="checkbox"], ul[data-type="taskList"] ul[data-type="taskList"] input[type="checkbox"]').first().click();
  b = await waitBlocks(x => { const l = x.find(y => y.type === 'list' && y.task === true); return l?.items?.[0]?.children?.[0]?.items?.[0]?.checked === true; });
  const after = b.find(y => y.type === 'list' && y.task === true);
  return { pass: !!nested && nested.task === true && nestedText === 'second' && after?.items?.[0]?.children?.[0]?.items?.[0]?.checked === true && after?.items?.[0]?.checked !== true, list: after };
});
await row('link edit-in-place: the bubble’s link button opens seeded with the current href; a new href lands on the server', async () => {
  await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const ed = c._editor; let from = null, to = null; ed.state.doc.descendants((n, pos) => { if (n.isText && n.marks.some(m => m.type.name === 'link') && from == null) { from = pos; to = pos + n.nodeSize; } }); ed.commands.setTextSelection({ from, to }); ed.commands.focus(); });
  await page.waitForTimeout(300);
  await page.locator('body .bp-paper-format__btn--link, body .bp-paper-format [data-mark="link"], body .bp-paper-format__btn[title="Link"]').first().click();
  const input = page.locator('body .bp-paper-format__link-input').first();
  await input.waitFor({ timeout: 3000 });
  const seeded = await input.inputValue();
  await input.fill('https://new.example.org/page'); await input.press('Enter');
  const b = await waitBlocks(x => JSON.stringify(x).includes('https://new.example.org/page'));
  const linkPara = b.find(y => y.type === 'paragraph' && (y.content || []).some(n => n.type === 'link'));
  const link = (linkPara?.content || []).find(n => n.type === 'link');
  return { pass: seeded === 'https://old.example.org/page' && link?.href === 'https://new.example.org/page' && inl(link?.children) === 'the link', seeded, link };
});
await row('placeholder: a new empty block shows a placeholder, an empty heading its own; text removes it', async () => {
  await caretEnd('p:has-text("The last paragraph")');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const para = await page.evaluate(() => { const sel = window.getSelection(); const el = sel?.anchorNode?.nodeType === 1 ? sel.anchorNode : sel?.anchorNode?.parentElement; const p = el?.closest?.('p'); return p ? { empty: p.classList.contains('is-empty'), placeholder: p.getAttribute('data-placeholder') } : null; });
  await page.keyboard.type('# '); await page.waitForTimeout(200);
  const heading = await page.evaluate(() => { const sel = window.getSelection(); const el = sel?.anchorNode?.nodeType === 1 ? sel.anchorNode : sel?.anchorNode?.parentElement; const h = el?.closest?.('h1,h2,h3'); return h ? { empty: h.classList.contains('is-empty'), placeholder: h.getAttribute('data-placeholder') } : null; });
  await page.keyboard.type('Filled'); await page.waitForTimeout(200);
  const filled = await page.evaluate(() => { const sel = window.getSelection(); const el = sel?.anchorNode?.nodeType === 1 ? sel.anchorNode : sel?.anchorNode?.parentElement; const h = el?.closest?.('h1,h2,h3'); return h ? h.classList.contains('is-empty') : null; });
  const b = await waitBlocks(x => x.some(y => y.type === 'heading' && y.text === 'Filled'));
  return { pass: !!para?.empty && !!para.placeholder && !!heading?.empty && !!heading.placeholder && heading.placeholder !== para.placeholder && filled === false && b.some(y => y.type === 'heading' && y.text === 'Filled' && y.level === 1), para, heading, filled };
});

await page.screenshot({ path: 'test-results/39-row14.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
