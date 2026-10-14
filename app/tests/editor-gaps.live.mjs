import { openFixturePaper } from './lib/paper-fixture.mjs';
import { waitForPaperCaret } from './helpers/native-paper-caret.mjs';
import { expectedQuoteBackspace, quoteBackspaceContract } from './lib/quote-backspace-contract.mjs';
// Actual keyboard/paste assertions; an observational shape log is not a passing row.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { publishFixture, getPaper, connectPaperFixture } from './lib/paper-fixture.mjs';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const quoteContract = quoteBackspaceContract(process.env);
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' && process.env.CI !== 'true') throw new Error('Use status-shots-isolated.mjs with a disposable Barkpark; this fixture replaces its scratch paper.');
const SLUG = 'barkdown-editor-test';
const capture = process.env.BARKDOWN_EDITOR_CAPTURE === '1';
const out = path.resolve((capture ? '../docs/visual/editor-gap-assertions/runs/' : 'test-results/editor-gap-assertions/') + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-gaps-'));
const results = [], errors = [], entry = [];
let app, page, video, editorBundle, actionProbe;
const seededIds = new Set();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim());
// Native history may recreate generated block IDs; retain seeded identities and
// every non-bpId field, including reference IDs and structural attributes.
const withoutIdentity = value => Array.isArray(value) ? value.map(withoutIdentity) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key, child]) => !(key === 'bpId' && (child == null || typeof child === 'string' && /^c-/.test(child) && !seededIds.has(child)))).map(([key, child]) => [key, withoutIdentity(child)])) : value;
const nodes = root => [root, ...(root.content || []).flatMap(nodes)];
const textOf = root => root.text || (root.content || []).map(textOf).join('');
const has = (doc, predicate) => nodes(doc).some(predicate);
const hasMark = (doc, text, mark, href) => has(doc, n => n.type === 'text' && n.text === text && n.marks?.some(m => m.type === mark && (!href || m.attrs?.href === href)));
const paragraph = (doc, text) => has(doc, n => n.type === 'paragraph' && textOf(n) === text && (!n.attrs?.bpType || n.attrs.bpType === 'paragraph'));
const snapshot = () => page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const recovery = c.recoverySnapshot(); if (recovery.serialization_error || !Array.isArray(recovery.blocks)) throw new Error('Cannot serialize current canvas: ' + JSON.stringify(recovery)); const e = c._editor, h = e.state.plugins.find(p => p.key.startsWith('history$'))?.getState(e.state); return { doc: e.getJSON(), blocks: recovery.blocks, diagnostic: { documentFocus: document.hasFocus(), editorFocus: e.isFocused, activeElement: document.activeElement?.outerHTML.slice(0, 350), selection: e.state.selection.toJSON(), selectionPath: Array.from({ length: e.state.selection.$from.depth + 1 }, (_, depth) => ({ depth, type: e.state.selection.$from.node(depth).type.name, index: e.state.selection.$from.index(depth) })), parentOffset: e.state.selection.$from.parentOffset, done: h?.done.eventCount, undone: h?.undone.eventCount, canUndo: e.can().undo(), keys: window.__gapKeys || [] } };  });
const read = () => getPaper(SLUG);
async function acknowledged(previousRev) {
  let current, server, save;
  for (let i = 0; i < 40; i++) {
    current = await snapshot(); server = read(); save = await page.locator('.bw-paper-pane:not([hidden]) #save-state').innerText();
    if (/Saved \u00b7 rev/.test(save) && server.rev !== previousRev && isDeepStrictEqual(current.blocks, server.blocks)) return { ...current, server, save };
    if (/Not saved|Conflict/.test(save)) throw new Error('Save refused: ' + save);
    await page.waitForTimeout(250);
  }
  assert.deepEqual(current.blocks, server.blocks, 'server must acknowledge the full canvas snapshot, not just block counts');
  assert.notEqual(server.rev, previousRev, 'interaction must produce a newly acknowledged revision');
  assert.match(save, /Saved \u00b7 rev/, 'save acknowledgement is visible');
  return { ...current, server, save };
}
async function step(name, action, check) {
  const before = await snapshot(), rev = read().rev;
  let beforeAction; actionProbe = null;
  try {
    beforeAction = await snapshot();
    const extra = await action(before);
    const current = await snapshot(); check(current.doc, before.doc, { acknowledged: false });
    assert.ok(has(current.doc, n => n.type === 'heading' && n.attrs?.level === 1 && textOf(n) === 'Gap probe'), 'seed heading must survive every completed interaction');
    assert.ok(paragraph(current.doc, 'Start here.'), 'unrelated starting paragraph must survive');
    const ack = await acknowledged(rev);
    check(ack.doc, before.doc, { acknowledged: true });
    results.push({ name, pass: true, beforeRev: rev, afterRev: ack.server.rev, doc: ack.doc, serverBlocks: ack.server.blocks, ...(extra || {}) });
  } catch (error) {
    results.push({ name, pass: false, error: error.stack, saveText: await page.locator('.bw-paper-pane:not([hidden]) #save-state').textContent().catch(() => null), before, beforeAction, actionProbe, observed: await snapshot().catch(() => null), server: (() => { try { return read(); } catch (e) { return { error: e.message }; } })() });
  }
  await page.screenshot({ path: path.join(out, String(results.length).padStart(2, '0') + '.png') });
}
try {
  publishFixture({ slug: SLUG, title: 'Gap probe, the long tail', description: 'Disposable asserted Barkdown native editor checks for input rules, rich paste, links, list and quote transforms, native history and full acknowledged server content.', blocks: [{ type: 'heading', level: 1, text: 'Gap probe' }, { type: 'paragraph', content: [{ type: 'text', value: 'Start here.' }] }] });
  for (const block of read().blocks) if (block.id) seededIds.add(block.id);
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow(); video = page.video();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('#bw-pages .bw-page-row');
  await page.setViewportSize({ width: 1400, height: 900 });
  await connectPaperFixture(page);
  await openFixturePaper(page, SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
  await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
  editorBundle = JSON.parse(fs.readFileSync(path.join(userData, 'canvas-bundle/current.json'), 'utf8'));
  assert.equal(editorBundle.source, 'server', 'native gap proof must consume the connected editor');
  await page.evaluate(() => { window.__gapKeys = []; document.addEventListener('keydown', event => { window.__gapKeys.push({ key: event.key, ctrl: event.ctrlKey, shift: event.shiftKey, target: event.target?.tagName, focus: document.hasFocus() }); window.__gapKeys = window.__gapKeys.slice(-15); }, true); });
  const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
  const blockStart = async () => { await page.keyboard.press('Home'); await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.selection.$from.parentOffset === 0, null, { timeout: 3000 }); };
  const paste = (text, html = '') => page.evaluate(([text, html]) => { const dt = new DataTransfer(); dt.setData('text/plain', text); if (html) dt.setData('text/html', html); document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [text, html]);
  // Prove each native setup action before typing the first destructive input.
  // Otherwise one misplaced initial caret cascades into thirteen misleading failures.
  await pm.locator('p').filter({ hasText: /^Start here\.$/ }).click();
  entry.push({ action: 'click starting paragraph', caret: await waitForPaperCaret(page, { text: 'Start here.', type: 'paragraph' }) });
  const beforeRefusal = await snapshot();
  await assert.rejects(waitForPaperCaret(page, { text: 'not the fixture paragraph' }, 100), /Timeout/);
  const afterRefusal = await snapshot();
  assert.deepEqual(afterRefusal.doc, beforeRefusal.doc, 'a failed caret observation cannot repair content');
  assert.deepEqual(afterRefusal.diagnostic.selection, beforeRefusal.diagnostic.selection, 'a failed caret observation cannot move selection');
  entry.push({ action: 'wrong-target observation refuses without mutation', pass: true });
  await page.keyboard.press('End');
  entry.push({ action: 'End', caret: await waitForPaperCaret(page, { text: 'Start here.', type: 'paragraph', edge: 'end' }) });
  await page.keyboard.press('Enter');
  entry.push({ action: 'Enter', caret: await waitForPaperCaret(page, { text: '', type: 'paragraph', edge: 'start' }) });
  const initial = await snapshot();
  assert.equal(initial.doc.content.length, 3, 'setup appends exactly one paragraph');
  assert.equal(textOf(initial.doc.content[0]), 'Gap probe');
  assert.equal(textOf(initial.doc.content[1]), 'Start here.');
  assert.equal(initial.diagnostic.selectionPath[0].index, 2, 'native caret is in the appended paragraph');
  await step('inline markdown marks', async () => { await page.keyboard.type('**bold** and *em* and ~~gone~~ and `mono` end'); }, doc => { for (const [text, mark] of [['bold', 'bold'], ['em', 'italic'], ['gone', 'strike'], ['mono', 'code']]) assert.ok(hasMark(doc, text, mark), `${text} must have ${mark}`); });
  await step('blockquote shorthand', async () => { await page.keyboard.press('Enter'); await page.keyboard.type('> quoted'); }, doc => assert.ok(has(doc, n => (n.type === 'blockquote' || n.attrs?.bpType === 'blockquote') && textOf(n) === 'quoted')));
  await step('task shorthand and checked item', async () => { await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.type('[ ] todo'); await page.keyboard.press('Enter'); await page.keyboard.type('second todo'); await pm.locator('ul[data-type="taskList"] li input').first().click(); await pm.locator('ul[data-type="taskList"] li p').last().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); }, doc => { assert.ok(has(doc, n => n.type === 'taskItem' && n.attrs?.checked === true && textOf(n) === 'todo')); assert.ok(has(doc, n => n.type === 'taskItem' && n.attrs?.checked === false && textOf(n) === 'second todo')); });
  await step('typed URL autolinks', async () => { await page.keyboard.press('Enter'); await page.keyboard.type('see https://example.com/x now'); }, doc => assert.ok(hasMark(doc, 'https://example.com/x', 'link', 'https://example.com/x')));
  await step('URL paste preserves selected link label', async () => { await page.keyboard.press('Enter'); await page.keyboard.type('linked words'); await page.keyboard.press('Shift+Home'); await page.waitForFunction(() => {const e=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;return e.state.doc.textBetween(e.state.selection.from,e.state.selection.to)==='linked words';},null,{timeout:3000}); await paste('https://example.org/'); }, doc => assert.ok(hasMark(doc, 'linked words', 'link', 'https://example.org/')));
  await step('Markdown paste keeps heading, list and tail', async () => { await page.keyboard.press('End'); await page.keyboard.press('Enter'); await paste('## Pasted heading\n\n- one\n- two\n\nTail paragraph'); }, doc => { assert.ok(has(doc, n => n.type === 'heading' && n.attrs?.level === 2 && textOf(n) === 'Pasted heading')); assert.ok(has(doc, n => n.type === 'bulletList' && n.content?.map(textOf).join('|') === 'one|two')); assert.ok(paragraph(doc, 'Tail paragraph')); });
  let beforeHtml, afterHtml;
  await step('HTML list paste preserves two items', async () => {
    const priorRev = read().rev; await page.keyboard.press('Enter'); beforeHtml = (await acknowledged(priorRev)).doc;
    // This row checks Undo of the paste alone. A human pause separates it from
    // the preparatory Enter; a fast Windows acknowledgement is not that pause.
    const boundary = await page.evaluate(() => {
      const e = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;
      const h = e.state.plugins.find(p => p.key.startsWith('history$'))?.getState(e.state);
      return { delay: e.extensionManager.extensions.find(x => x.name === 'undoRedo')?.options.newGroupDelay, done: h?.done.eventCount, began: Date.now() };
    });
    assert.ok(Number.isFinite(boundary.delay) && boundary.delay >= 0 && boundary.delay <= 5000, 'Mounted history must declare a bounded group interval');
    assert.ok(Number.isSafeInteger(boundary.done));
    await page.waitForTimeout(boundary.delay + 50);
    await paste('a b', '<ul><li>html one</li><li>html two</li></ul>');
    const after = await page.evaluate(() => { const e = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor; return { done: e.state.plugins.find(p => p.key.startsWith('history$')).getState(e.state).done.eventCount, now: Date.now() }; });
    assert.ok(after.now - boundary.began > boundary.delay, 'Native paste follows the declared human idle');
    assert.equal(after.done, boundary.done + 1, 'Paste creates one separate native history event');
    return { historyBoundary: { ...boundary, elapsed: after.now - boundary.began, afterDone: after.done } };
  }, doc => assert.ok(has(doc, n => n.type === 'bulletList' && n.content?.map(textOf).join('|') === 'html one|html two')));
  afterHtml = (await snapshot()).doc;
  await step('native Undo removes HTML paste', async () => { await page.keyboard.press(`${MOD}+z`); }, doc => assert.deepEqual(withoutIdentity(doc), withoutIdentity(beforeHtml)));
  await step('native Redo restores exact rich HTML state', async () => { await page.keyboard.press(`${MOD}+Shift+z`); }, doc => assert.deepEqual(withoutIdentity(doc), withoutIdentity(afterHtml)));
  let paragraphAttrs;
  await step(`Backspace uses declared ${quoteContract} quote contract preserving full content`, async () => {
    await pm.locator('blockquote[data-bp-type="blockquote"]').first().click(); await blockStart();
    const caret = await waitForPaperCaret(page, { text: 'quoted', type: 'blockquote', edge: 'start' });
    paragraphAttrs = await page.evaluate(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.schema.nodes.paragraph.create({ bpType: 'paragraph' }).attrs);
    actionProbe = await snapshot();
    actionProbe.caret = caret;
    assert.equal(actionProbe.diagnostic.selectionPath.at(-1).type, 'blockquote');
    assert.equal(actionProbe.diagnostic.parentOffset, 0);
    await page.keyboard.press('Backspace');
  }, (doc, before) => {
    const { expected, index, quoteId } = expectedQuoteBackspace(before, quoteContract, paragraphAttrs);
    if (quoteContract === 'paragraph') assert.equal(doc.content[index].attrs.bpId, quoteId, 'conversion retains the quote identity');
    assert.deepEqual(withoutIdentity(doc), withoutIdentity(expected), 'declared operation retains every mark, link, sibling and seeded identity');
  });
  await step('Backspace lifts first bullet without losing heading or second item', async () => { await pm.locator('ul:not([data-type="taskList"]) li p').first().click(); await blockStart(); actionProbe = await snapshot(); await page.keyboard.press('Backspace'); }, (doc, before, phase) => {
    const expected = structuredClone(before), index = expected.content.findIndex(n => n.type === 'bulletList' && n.content?.map(textOf).join('|') === 'one|two');
    assert.ok(index > 0); const list = expected.content[index], first = list.content.shift();
    assert.equal(first.content.length, 1); assert.equal(first.content[0].type, 'paragraph');
    // A nested paragraph has no persistence carrier type. Its new top-level
    // carrier is materialized on save; retain every other field and sibling.
    if (phase.acknowledged) first.content[0].attrs = { ...first.content[0].attrs, bpType: 'paragraph' };
    expected.content.splice(index, 0, first.content[0]);
    assert.deepEqual(withoutIdentity(doc), withoutIdentity(expected), 'native lift preserves heading level, marks, remaining list item and unrelated siblings');
  });
  await step('warning callout shorthand', async () => { const tail=pm.locator('p:has-text("Tail paragraph")').first();await tail.click();await tail.evaluate(el=>{const e=el.closest('bp-paper-canvas')._editor;e.view.focus();e.commands.setTextSelection(e.view.posAtDOM(el,el.childNodes.length));});await page.waitForFunction(()=>{const s=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.selection;return s.empty&&s.$from.parent.textContent==='Tail paragraph'&&s.$from.parentOffset===s.$from.parent.content.size;});await page.keyboard.press('Enter');await page.waitForFunction(()=>{const s=document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.state.selection;return s.empty&&s.$from.parent.type.name==='paragraph'&&s.$from.parent.content.size===0;});await page.keyboard.type('> [!warning] careful'); }, doc => assert.ok(has(doc, n => n.type === 'callout' && n.attrs?.tone === 'warning' && textOf(n) === 'careful')));
  await step('select all replacement and native Undo preserve rich document', async before => { const rev = read().rev; await pm.click(); await page.keyboard.press(`${MOD}+a`); await page.keyboard.type('fresh'); const replaced = await snapshot(); assert.equal(replaced.doc.content.length, 1); assert.ok(paragraph(replaced.doc, 'fresh')); const ack = await acknowledged(rev); await page.keyboard.press(`${MOD}+z`); return { replacementRev: ack.server.rev }; }, (doc, before) => assert.deepEqual(withoutIdentity(doc), withoutIdentity(before)));
  assert.equal(results.length, 13);
  assert.deepEqual(errors, [], 'renderer must not throw');
} catch (error) {
  results.push({ name: 'fixture execution', pass: false, error: error.stack });
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  if (app) { try { await app.close(); } catch (error) { results.push({ name: 'owned Electron cleanup', pass: false, error: error.stack }); } }
  if (video) { try { const recorded = await video.path(); if (fs.existsSync(recorded)) fs.renameSync(recorded, path.join(out, 'editor-gaps.webm')); } catch (error) { results.push({ name: 'video evidence finalization', pass: false, error: error.stack }); } }
  const passed = results.filter(r => r.pass).length;
  const report = { summary: `${passed}/${results.length} green`, quoteContract, entry, results, errors };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  const artifacts = Object.fromEntries(fs.readdirSync(out).filter(f => /\.(png|webm|json)$/.test(f)).map(f => [f, createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sourceCommit, sourceDirty, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, server: process.env.BARKDOWN_SHOTS_SERVER, editorBundle, artifacts, userData, motion: 'Native keyboard and production ClipboardEvent handlers, actual server acknowledgement; no model turn.' }, null, 2) + '\n');
  console.log(JSON.stringify({ summary: report.summary, failures: results.filter(r => !r.pass).map(r => ({ name: r.name, error: r.error, diagnostic: r.observed?.diagnostic })), errors }, null, 1));
  console.log('Evidence: ' + out);
  process.exitCode = results.length === 13 && passed === 13 && errors.length === 0 ? 0 : 1;
}
