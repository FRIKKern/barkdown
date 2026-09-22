// Actual keyboard/paste assertions; an observational shape log is not a passing row.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { publishFixture, getPaper } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' && process.env.CI !== 'true') throw new Error('Use status-shots-isolated.mjs with a disposable Barkpark; this fixture replaces its scratch paper.');
const SLUG = 'barkdown-editor-test';
const capture = process.env.BARKDOWN_EDITOR_CAPTURE === '1';
const out = path.resolve((capture ? '../docs/visual/editor-gap-assertions/runs/' : 'test-results/editor-gap-assertions/') + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-gaps-'));
const results = [], errors = [];
let app, page, video, editorBundle;
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
const snapshot = () => page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const recovery = c.recoverySnapshot(); if (recovery.serialization_error || !Array.isArray(recovery.blocks)) throw new Error('Cannot serialize current canvas: ' + JSON.stringify(recovery)); return { doc: c._editor.getJSON(), blocks: recovery.blocks };  });
const read = () => getPaper(SLUG);
async function acknowledged(previousRev) {
  let current, server, save;
  for (let i = 0; i < 40; i++) {
    current = await snapshot(); server = read(); save = await page.locator('.bw-paper-pane:not([hidden]) #save-state').innerText();
    if (/Saved · rev/.test(save) && server.rev !== previousRev && isDeepStrictEqual(current.blocks, server.blocks)) return { ...current, server, save };
    if (/Not saved|Conflict/.test(save)) throw new Error('Save refused: ' + save);
    await page.waitForTimeout(250);
  }
  assert.deepEqual(current.blocks, server.blocks, 'server must acknowledge the full canvas snapshot, not just block counts');
  assert.notEqual(server.rev, previousRev, 'interaction must produce a newly acknowledged revision');
  assert.match(save, /Saved · rev/, 'save acknowledgement is visible');
  return { ...current, server, save };
}
async function step(name, action, check) {
  const before = await snapshot(), rev = read().rev;
  try {
    const extra = await action(before);
    const current = await snapshot(); check(current.doc, before.doc);
    const ack = await acknowledged(rev);
    check(ack.doc, before.doc);
    results.push({ name, pass: true, beforeRev: rev, afterRev: ack.server.rev, doc: ack.doc, serverBlocks: ack.server.blocks, ...(extra || {}) });
  } catch (error) {
    results.push({ name, pass: false, error: error.stack, before, observed: await snapshot().catch(() => null), server: (() => { try { return read(); } catch (e) { return { error: e.message }; } })() });
  }
  await page.screenshot({ path: path.join(out, String(results.length).padStart(2, '0') + '.png') });
}
try {
  publishFixture({ slug: SLUG, title: 'Gap probe, the long tail', description: 'Disposable asserted Barkdown native editor checks for input rules, rich paste, links, list and quote transforms, native history and full acknowledged server content.', blocks: [{ type: 'heading', level: 1, text: 'Gap probe' }, { type: 'paragraph', content: [{ type: 'text', value: 'Start here.' }] }] });
  for (const block of read().blocks) if (block.id) seededIds.add(block.id);
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow(); video = page.video();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('#bw-pages .bw-page-row');
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(async server => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true, ...(server ? { server } : {}) } }); await window.__barkdown.refreshLibrary(); }, process.env.BARKDOWN_SHOTS_SERVER);
  await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
  await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
  editorBundle = JSON.parse(fs.readFileSync(path.join(userData, 'canvas-bundle/current.json'), 'utf8'));
  assert.equal(editorBundle.source, 'server', 'native gap proof must consume the connected editor');
  const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
  const paste = (text, html = '') => page.evaluate(([text, html]) => { const dt = new DataTransfer(); dt.setData('text/plain', text); if (html) dt.setData('text/html', html); document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, [text, html]);
  await pm.locator('p').last().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await step('inline markdown marks', async () => { await page.keyboard.type('**bold** and *em* and ~~gone~~ and `mono` end'); }, doc => { for (const [text, mark] of [['bold', 'bold'], ['em', 'italic'], ['gone', 'strike'], ['mono', 'code']]) assert.ok(hasMark(doc, text, mark), `${text} must have ${mark}`); });
  await step('blockquote shorthand', async () => { await page.keyboard.press('Enter'); await page.keyboard.type('> quoted'); }, doc => assert.ok(has(doc, n => (n.type === 'blockquote' || n.attrs?.bpType === 'blockquote') && textOf(n) === 'quoted')));
  await step('task shorthand and checked item', async () => { await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.type('[ ] todo'); await page.keyboard.press('Enter'); await page.keyboard.type('second todo'); await pm.locator('ul[data-type="taskList"] li input').first().click(); await pm.locator('ul[data-type="taskList"] li p').last().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); }, doc => { assert.ok(has(doc, n => n.type === 'taskItem' && n.attrs?.checked === true && textOf(n) === 'todo')); assert.ok(has(doc, n => n.type === 'taskItem' && n.attrs?.checked === false && textOf(n) === 'second todo')); });
  await step('typed URL autolinks', async () => { await page.keyboard.press('Enter'); await page.keyboard.type('see https://example.com/x now'); }, doc => assert.ok(hasMark(doc, 'https://example.com/x', 'link', 'https://example.com/x')));
  await step('URL paste preserves selected link label', async () => { await page.keyboard.press('Enter'); await page.keyboard.type('linked words'); await page.keyboard.press('Shift+Home'); await paste('https://example.org/'); }, doc => assert.ok(hasMark(doc, 'linked words', 'link', 'https://example.org/')));
  await step('Markdown paste keeps heading, list and tail', async () => { await page.keyboard.press('End'); await page.keyboard.press('Enter'); await paste('## Pasted heading\n\n- one\n- two\n\nTail paragraph'); }, doc => { assert.ok(has(doc, n => n.type === 'heading' && n.attrs?.level === 2 && textOf(n) === 'Pasted heading')); assert.ok(has(doc, n => n.type === 'bulletList' && n.content?.map(textOf).join('|') === 'one|two')); assert.ok(paragraph(doc, 'Tail paragraph')); });
  let beforeHtml, afterHtml;
  await step('HTML list paste preserves two items', async () => { const priorRev = read().rev; await page.keyboard.press('Enter'); beforeHtml = (await acknowledged(priorRev)).doc; await paste('a b', '<ul><li>html one</li><li>html two</li></ul>'); afterHtml = (await snapshot()).doc; }, doc => assert.ok(has(doc, n => n.type === 'bulletList' && n.content?.map(textOf).join('|') === 'html one|html two')));
  await step('native Undo removes HTML paste', async () => { await page.keyboard.press('Control+z'); }, doc => assert.deepEqual(withoutIdentity(doc), withoutIdentity(beforeHtml)));
  await step('native Redo restores exact rich HTML state', async () => { await page.keyboard.press('Control+Shift+z'); }, doc => assert.deepEqual(withoutIdentity(doc), withoutIdentity(afterHtml)));
  await step('Backspace lifts quote to paragraph', async () => { await pm.locator('blockquote[data-bp-type="blockquote"], p[data-bp-type="blockquote"], p.bp-role-blockquote').first().click(); await page.keyboard.press('Home'); await page.keyboard.press('Backspace'); }, doc => assert.ok(paragraph(doc, 'quoted')));
  await step('Backspace lifts first bullet to paragraph', async () => { await pm.locator('ul:not([data-type="taskList"]) li p').first().click(); await page.keyboard.press('Home'); await page.keyboard.press('Backspace'); }, doc => { assert.ok(paragraph(doc, 'one')); assert.ok(has(doc, n => n.type === 'bulletList' && textOf(n).includes('two'))); });
  await step('warning callout shorthand', async () => { await pm.locator('p:has-text("Tail paragraph")').first().click(); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('> [!warning] careful'); }, doc => assert.ok(has(doc, n => n.type === 'callout' && n.attrs?.tone === 'warning' && textOf(n) === 'careful')));
  await step('select all replacement and native Undo preserve rich document', async before => { const rev = read().rev; await pm.click(); await page.keyboard.press('Control+a'); await page.keyboard.type('fresh'); const replaced = await snapshot(); assert.equal(replaced.doc.content.length, 1); assert.ok(paragraph(replaced.doc, 'fresh')); const ack = await acknowledged(rev); await page.keyboard.press('Control+z'); return { replacementRev: ack.server.rev }; }, (doc, before) => assert.deepEqual(withoutIdentity(doc), withoutIdentity(before)));
  assert.equal(results.length, 13);
  assert.deepEqual(errors, [], 'renderer must not throw');
} catch (error) {
  results.push({ name: 'fixture execution', pass: false, error: error.stack });
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  if (app) { try { await app.close(); } catch (error) { results.push({ name: 'owned Electron cleanup', pass: false, error: error.stack }); } }
  if (video) { const recorded = await video.path(); if (fs.existsSync(recorded)) fs.renameSync(recorded, path.join(out, 'editor-gaps.webm')); }
  const passed = results.filter(r => r.pass).length;
  const report = { summary: `${passed}/${results.length} green`, results, errors };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  const artifacts = Object.fromEntries(fs.readdirSync(out).filter(f => /\.(png|webm|json)$/.test(f)).map(f => [f, createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sourceCommit, sourceDirty, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, server: process.env.BARKDOWN_SHOTS_SERVER, editorBundle, artifacts, userData, motion: 'Native keyboard and production ClipboardEvent handlers, actual server acknowledgement; no model turn.' }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 1));
  console.log('Evidence: ' + out);
  process.exitCode = results.length === 13 && passed === 13 && errors.length === 0 ? 0 : 1;
}
