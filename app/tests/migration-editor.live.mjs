import { openFixturePaper } from './lib/paper-fixture.mjs';
// Staged legacy corpus through the real server-supplied Paper editor and persistence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import { cases } from '../../docs/migration/corpus.mjs';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const { stageMigration } = require('../main/migration-staging');
const { inspectContent } = require('../main/migration-preflight');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-migrated-editor-'));
const profileId = crypto.randomUUID(), sourceDir = path.join(temporary, profileId), destinationDir = path.join(temporary, 'backup'), userData = path.join(temporary, 'electron');
fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true });
const safe = cases.filter(sample => inspectContent(sample.source).length === 0);
assert.equal(safe.length, 21);
const source = { id: 'corpus', title: 'Migrated notes remain editable and recoverable in Paper', rev: 4, content: { type: 'doc', content: safe.flatMap(sample => sample.source.content) }, revisions: [{ rev: 1, title: 'Retained original history' }], proposals: [{ id: 'retained-proposal' }] };
const sourceBytes = JSON.stringify(source, null, 2) + '\n';
fs.writeFileSync(path.join(sourceDir, 'documents/corpus.json'), sourceBytes);
const workspaceBytes = JSON.stringify({ pages: { roots: ['corpus'], children: {}, archived: {} }, chats: { main: { draft: 'Keep my unfinished message' }, side: { parent: 'main', draft: 'Keep side chat too' } }, favorites: [{ kind: 'doc', id: 'corpus' }] });
fs.writeFileSync(path.join(sourceDir, 'workspace.json'), workspaceBytes);
async function request(method, route, body) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  return { status: response.status, data: await response.json() };
}
const tag = 'migrated-editor-proof';
assert.equal((await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: tag, _type: 'tag', title: 'Migrated editor proof' } }, { publish: { id: tag, type: 'tag' } }] })).status, 200);
const options = { profileId, sourceDir, destinationDir, quiesced: true, metadata: { corpus: { description: 'Disposable migrated corpus proves actual Paper editing, exact saved Undo and reopen without source authority changes', tags: [{ tag, strength: 95, rationale: 'Registered private migrated editor rehearsal category' }] } } };
const target = { profileId, runtimeId: 'private-editor-' + profileId, server, dataset: 'production', token, assertOwned: binding => binding.profileId === profileId && binding.server === server };
const staged = await stageMigration(options, target), id = staged.documents[0].targetId;
const read = async () => { const r = await request('GET', `/v1/data/doc/production/paper/${id}?perspective=published`); assert.equal(r.status, 200); return r.data.result || r.data; };
const expected = safe.flatMap(sample => sample.expected.blocks).map((block, i) => ({ ...block, id: 'migration-' + i }));
const original = await read(); assert.deepEqual(original.blocks, expected);
const out = path.resolve(appDir, '../docs/visual/migration/runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
let app, page, video, editorBundle;
const results = [], frames = [], errors = [];
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  page = await app.firstWindow(); video = page.video(); page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('#bw-pages .bw-page-row'); await page.setViewportSize({ width: 1400, height: 900 });
};
const close = async name => { await app.close(); app = null; if (video) fs.renameSync(await video.path(), path.join(out, name + '.webm')); };
const canvas = () => page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas');
const ready = async () => { await canvas().locator('.ProseMirror').waitFor({ timeout: 60000 }); await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent.includes('Editing live')); };
const blocks = () => canvas().evaluate(c => c.recoverySnapshot().blocks);
const saved = async previous => {
  await page.waitForFunction(rev => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const host = [...window.__barkdown.controllers.values()].find(x => x.el?.contains(c)); const status = document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''; return c && host && !host.isDirty() && !c.hasPendingChanges() && Number(status.match(/Saved · rev (\d+)/)?.[1]) > rev; }, previous, { timeout: 45000 });
  const value = await read(); assert.deepEqual(await blocks(), value.blocks, 'acknowledged canvas and server agree'); return value;
};
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); frames.push(name + '.png'); };
// Bring the whole target into the frame, not merely the caret at its first line.
const revealParagraph = async text => {
  const paragraph = canvas().locator('.ProseMirror p').filter({ hasText: text }).first();
  await paragraph.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const geometry = await paragraph.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: innerWidth, height: innerHeight };
  });
  assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.height && geometry.left >= 0 && geometry.right <= geometry.width,
    'entire target paragraph is visible for evidence');
  return geometry;
};
const firstText = value => { if (Array.isArray(value)) { for (const v of value) { const found = firstText(v); if (found) return found; } } else if (value && typeof value === 'object') { if (value.type === 'text') return value.value; for (const [k, v] of Object.entries(value)) { if (!['id', 'type'].includes(k)) { const found = firstText(v); if (found) return found; } } } return null; };
function changeFirstText(block, needle) {
  const copy = structuredClone(block);
  if (copy.type === 'code') { copy.value = copy.value.slice(0, 1) + 'X' + copy.value.slice(1); return copy; }
  if (copy.type === 'heading' && typeof copy.text === 'string') { copy.text = copy.text.slice(0, 1) + 'X' + copy.text.slice(1); return copy; }
  let changed = false;
  const visit = value => { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') { if (!changed && value.type === 'text' && value.value === needle) { value.value = value.value.slice(0, 1) + 'X' + value.value.slice(1); changed = true; } else Object.values(value).forEach(visit); } };
  visit(copy); assert.equal(changed, true); return copy;
}
// Native DOM input may split one literal-LF carrier into three marked runs.
// Compare that edited inline value semantically, while requiring exact source
// carriers on Undo and exact untouched blocks throughout the document.
function inlineRuns(nodes) {
  const runs = [];
  function walk(items, marks = []) {
    for (const node of items) {
      if (node.type === 'text') {
        assert.deepEqual(Object.keys(node).sort(), ['type', 'value']);
        const key = JSON.stringify(marks);
        if (runs.at(-1)?.marks === key) runs.at(-1).text += node.value;
        else runs.push({ marks: key, text: node.value });
      } else {
        assert.ok(['strong', 'em', 'underline', 'strikethrough', 'link'].includes(node.type));
        assert.deepEqual(Object.keys(node).sort(), (node.type === 'link' ? ['children', 'href', 'type'] : ['children', 'type']));
        walk(node.children, [...marks, { type: node.type, ...(node.type === 'link' ? { href: node.href } : {}) }]);
      }
    }
  }
  walk(nodes); return runs;
}
async function presentation() {
  const shown = await canvas().evaluate(c => {
    const nodes = [...c._editor.view.dom.querySelectorAll('p,h1,h2,h3')];
    const aligned = ['Centered', 'Right paragraph', 'Right heading'].map(text => {
      const el = nodes.find(n => n.textContent === text);
      return { text, tag: el?.tagName, align: el ? getComputedStyle(el).textAlign : null };
    });
    const heading = nodes.find(n => n.textContent === 'Rich heading');
    return { aligned, richHeading: { tag: heading?.tagName, link: heading?.querySelector('a')?.getAttribute('href'), boldItalic: !!heading?.querySelector('strong em,em strong') } };
  });
  assert.deepEqual(shown, { aligned: [
    { text: 'Centered', tag: 'P', align: 'center' },
    { text: 'Right paragraph', tag: 'P', align: 'right' },
    { text: 'Right heading', tag: 'H3', align: 'right' },
  ], richHeading: { tag: 'H1', link: 'https://example.invalid/heading', boldItalic: true } });
  const nested = await canvas().evaluate(c => {
    const dom = c._editor.view.dom;
    const leaf = [...dom.querySelectorAll('p')].find(p => p.textContent === 'Deep leaf');
    const parents = []; for (let el = leaf?.parentElement; el && el !== dom; el = el.parentElement) {
      if (['UL','OL'].includes(el.tagName)) parents.push(el.tagName);
    }
    const quote = [...dom.querySelectorAll('[data-bp-type="blockquote"]')].find(q => q.textContent === 'Rich quotation');
    return { parents, quote: !!quote, richQuote: !!quote?.querySelector('strong em,em strong') };
  });
  assert.deepEqual(nested, { parents: ['UL','UL','OL'], quote: true, richQuote: true }, 'nested marker hierarchy and genuine rich quote remain rendered');
  return shown;
}
try {
  await launch();
  await page.evaluate(async connection => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, writes: true, viaCli: false, ...connection } }); await window.__barkdown.refreshLibrary(); }, { server, token });
  await openFixturePaper(page, id); await ready();
  editorBundle = JSON.parse(fs.readFileSync(path.join(userData, 'canvas-bundle/current.json'))); assert.equal(editorBundle.source, 'server'); assert.equal(editorBundle.server, server);
  const selectedBundle = path.join(process.env.BARKDOWN_TEST_BP_SOURCE, 'api/priv/static/assets/bp-paper-editor.bundle.js');
  assert.equal(editorBundle.sha, crypto.createHash('sha1').update(fs.readFileSync(selectedBundle)).digest('hex'),
    'private runtime must serve the selected checkout editor; refresh stale built assets before claiming native proof');
  assert.deepEqual(await blocks(), expected);
  const originalPresentation = await presentation();
  const titleGeometry = await page.locator('.bw-paper-pane:not([hidden]) #title').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, lineHeight: parseFloat(getComputedStyle(el).lineHeight) }));
  assert.ok(titleGeometry.height > titleGeometry.lineHeight * 1.5, 'long title wraps');
  assert.ok(titleGeometry.scrollWidth <= titleGeometry.width + 1 && titleGeometry.scrollHeight <= titleGeometry.height + 1, 'title has no hidden text');
  await shot('01-staged-original');
  await canvas().evaluate(c => { window.__migrationInputs = []; const e = c._editor; for (const plugin of e.state.plugins) { const filter = plugin.spec.filterTransaction; if (filter) plugin.spec.filterTransaction = function(tr, state) { const allowed = filter.call(this, tr, state); if (tr.docChanged) window.__migrationInputs.push({ event: 'filter', plugin: plugin.key, allowed, before: state.doc.toJSON(), after: tr.doc.toJSON(), steps: tr.steps.map(s => s.toJSON()) }); return allowed; }; } for (const name of ['keydown', 'beforeinput', 'input']) e.view.dom.addEventListener(name, event => window.__migrationInputs.push({ event: name, key: event.key, data: event.data, ctrl: event.ctrlKey, shift: event.shiftKey, selection: e.state.selection.toJSON(), text: e.state.doc.textContent, dom: e.view.dom.textContent }), true); e.on('transaction', ({ transaction }) => { if (transaction.docChanged) window.__migrationInputs.push({ event: 'transaction', text: e.state.doc.textContent, after: transaction.doc.toJSON(), steps: transaction.steps.map(s => s.toJSON()) }); }); });
  let revision = original.rev;
  for (const [index, sample] of safe.entries()) {
    const block = expected[index], needle = block.type === 'heading' && typeof block.text === 'string' ? block.text : firstText(block);
    if (block.type === 'code') {
      const area = canvas().locator('.bp-canvas-code-area'); await area.click(); await area.evaluate(el => el.setSelectionRange(1, 1));
    } else {
      // Literal LF may already be projected as a hardBreak after another native
      // DOM edit. Locate its first line; saved expectations still cover every
      // original character, mark and exact Undo carrier.
      await canvas().evaluate((c, needle) => { const e = c._editor; let at; e.state.doc.descendants((node, pos) => { if (at === undefined && node.isText && node.text.includes(needle)) at = pos + node.text.indexOf(needle) + 1; }); if (at === undefined) throw Error('Missing editable corpus text: ' + needle); e.view.focus(); e.commands.setTextSelection(at); }, needle.split('\n')[0]);
      await page.waitForFunction(() => document.activeElement === document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor.view.dom);
    }
    await page.keyboard.type('X');
    await page.waitForFunction(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c?._editor?.getText().includes('X') || c?.querySelector('.bp-canvas-code-area')?.value.includes('X'); }, null, { timeout: 3000 });
    const edited = await saved(revision);
    const changed = structuredClone(expected); changed[index] = changeFirstText(block, needle);
    if (sample.id === 'paragraph-literal-break') {
      assert.deepEqual(edited.blocks.filter((_, i) => i !== index), changed.filter((_, i) => i !== index), 'literal LF edit leaves all other blocks exact');
      assert.deepEqual({ ...edited.blocks[index], content: inlineRuns(edited.blocks[index].content) },
        { ...changed[index], content: inlineRuns(changed[index].content) }, 'literal LF edit preserves text, newline, marks and metadata across native carrier segmentation');
    } else assert.deepEqual(edited.blocks, changed, sample.id + ': only the intended text changes');
    await shot('edit-' + sample.id);
    // The code island records its edit in the owning Paper history. Focus the
    // real PM surface without another transaction before the native Undo key.
    if (block.type === 'code') await canvas().evaluate(c => c._editor.view.focus());
    await page.keyboard.press(`${MOD}+z`); const undone = await saved(edited.rev);
    assert.deepEqual(undone.blocks, expected, sample.id + ': Undo restores exact staged structure');
    results.push({ case: sample.id, beforeRev: revision, editedRev: edited.rev, undoneRev: undone.rev }); revision = undone.rev;
    if (sample.id === 'nested-mixed-task') {
      await canvas().evaluate(c => {
        const e=c._editor; let at;
        e.state.doc.descendants((n,pos)=>{if(n.isText && n.text === 'Deep leaf') at=pos+1;});
        if(at === undefined) throw Error('Missing deepest nested list body');
        e.view.focus(); e.commands.setTextSelection(at);
      });
      await page.keyboard.type('X'); const nestedEdit=await saved(revision);
      const changed=structuredClone(expected); changed[index]=changeFirstText(block,'Deep leaf');
      assert.deepEqual(nestedEdit.blocks,changed,'deep child edit preserves sibling order, parent marks and checked state');
      await shot('edit-deep-list-child');
      await page.keyboard.press(`${MOD}+z`); const restored=await saved(nestedEdit.rev);
      assert.deepEqual(restored.blocks,expected,'deep child Undo restores exact nested source');
      Object.assign(results.at(-1),{nestedEditedRev:nestedEdit.rev,nestedUndoneRev:restored.rev}); revision=restored.rev;
    }
    if (sample.id === 'list-break') {
      await canvas().evaluate(c => {
        const e=c._editor; let at;
        e.state.doc.descendants((n,pos)=>{if(n.isText && n.text === 'List first') at=pos+n.text.length;});
        if(at === undefined) throw Error('Missing list break insertion point');
        e.view.focus(); e.commands.setTextSelection(at);
      });
      await page.keyboard.press('Shift+Enter'); const inserted=await saved(revision);
      const item=inserted.blocks[index].items[0];
      assert.ok(Array.isArray(item),'list break retains inline-array item carrier');
      assert.deepEqual(inlineRuns(item),[{marks:'[]',text:'List first\n\nList second'}]);
      assert.deepEqual({...inserted.blocks[index],items:[]},{...block,items:[]});
      assert.equal(inserted.blocks[index].items.length,1);
      assert.deepEqual(inserted.blocks.filter((_,i)=>i!==index),expected.filter((_,i)=>i!==index));
      await revealParagraph('List first');
      await shot('native-list-break-inserted');
      await page.keyboard.press(`${MOD}+z`); const restored=await saved(inserted.rev);
      assert.deepEqual(restored.blocks,expected,'native list break Undo restores exact source carriers');
      Object.assign(results.at(-1),{breakInsertedRev:inserted.rev,breakUndoneRev:restored.rev}); revision=restored.rev;
    }
    if (sample.id === 'heading-rich-external') {
      await canvas().evaluate((c, text) => {
        const e = c._editor; let at;
        e.state.doc.descendants((node, pos) => { if (node.isText && node.text === text) at = pos + 1; });
        if (at === undefined) throw Error('Missing marked heading');
        e.view.focus(); e.commands.setTextSelection(at);
      }, needle);
      await page.keyboard.press('Shift+Enter');
      const inserted = await saved(revision), [originalRun] = inlineRuns(block.content);
      // Tiptap inserts an unmarked hardBreak; both existing text runs must keep
      // their link/emphasis. Do not invent link marks on the new break itself.
      const desiredRuns = [{ ...originalRun, text: needle.slice(0, 1) }, { marks: '[]', text: '\n' }, { ...originalRun, text: needle.slice(1) }];
      assert.deepEqual({ ...inserted.blocks[index], content: inlineRuns(inserted.blocks[index].content) },
        { ...block, content: desiredRuns }, 'native heading break preserves existing link, emphasis and level');
      assert.deepEqual(inserted.blocks.filter((_, i) => i !== index), expected.filter((_, i) => i !== index));
      await shot('native-heading-break-inserted');
      await page.keyboard.press(`${MOD}+z`); const restored = await saved(inserted.rev);
      assert.deepEqual(restored.blocks, expected, 'native heading break Undo restores exact source carriers');
      Object.assign(results.at(-1), { breakInsertedRev: inserted.rev, breakUndoneRev: restored.rev });
      revision = restored.rev;
    }
    if (sample.id === 'hard-break') {
      await canvas().evaluate((c, text) => {
        const e = c._editor; let at;
        e.state.doc.descendants((n, pos) => { if (n.isText && n.text.startsWith(text)) at = pos + text.length; });
        if (at === undefined) throw Error('Missing native break insertion point');
        e.view.focus(); e.commands.setTextSelection(at);
      }, needle);
      await page.keyboard.press('Shift+Enter');
      const inserted = await saved(revision);
      const content = inserted.blocks[index].content;
      assert.ok(content.every(n => n.type === 'text' && typeof n.value === 'string'), 'new break keeps plain inline text');
      assert.equal(content.map(n => n.value).join(''), 'Line one\n\nLine two', 'native Shift Enter adds exactly one newline');
      assert.deepEqual(inserted.blocks.filter((_, i) => i !== index), expected.filter((_, i) => i !== index), 'native break leaves every other block exact');
      await shot('native-break-inserted');
      await page.keyboard.press(`${MOD}+z`);
      const restored = await saved(inserted.rev);
      assert.deepEqual(restored.blocks, expected, 'native break Undo restores exact staged carriers');
      Object.assign(results.at(-1), { breakInsertedRev: inserted.rev, breakUndoneRev: restored.rev });
      revision = restored.rev;
    }
  }
  await shot('02-all-undo-saved');
  await canvas().evaluate(c => { c.__migrationBeforeReload = true; });
  await page.locator('.bw-paper-pane:not([hidden]) button[title="Reload from server"]').click();
  await page.waitForFunction(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return c && !c.__migrationBeforeReload && c._editor; });
  assert.deepEqual(await blocks(), expected); await presentation(); await shot('03-reloaded');
  await page.setViewportSize({ width: 760, height: 900 }); await shot('04-narrow');
  const geometry = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth })); assert.ok(geometry.page <= geometry.viewport);
  const nestedGeometry = await revealParagraph('Deep leaf');
  await presentation(); await shot('04-narrow-nested-lists');
  await close('editing-and-undo');
  await launch(); await ready(); assert.deepEqual(await blocks(), expected); assert.deepEqual((await read()).blocks, expected); await presentation(); await shot('05-restarted');
  assert.equal(fs.readFileSync(path.join(sourceDir, 'documents/corpus.json'), 'utf8'), sourceBytes);
  assert.equal(fs.readFileSync(path.join(sourceDir, 'workspace.json'), 'utf8'), workspaceBytes);
  assert.equal(fs.readFileSync(path.join(destinationDir, 'source/documents/corpus.json'), 'utf8'), sourceBytes);
  await assert.rejects(stageMigration(options, target), { code: 'journal_changed' }); // Undo restores content, not an old revision identity.
  assert.deepEqual((await read()).blocks, expected); assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'server.json'), JSON.stringify(await read(), null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'geometry.json'), JSON.stringify({ title: titleGeometry, narrow: geometry, narrowNested: nestedGeometry, presentation: originalPresentation }, null, 2) + '\n');
  console.log(`PASS ${safe.length} migrated cases including native inline breaks: keyboard edit, exact saved Undo, reload and Electron restart; source/navigation unchanged`);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  if (page) {
    const state = await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); return { active: document.activeElement?.outerHTML.slice(0, 500), focused: document.hasFocus(), inputs: window.__migrationInputs, selection: c?._editor?.state.selection.toJSON(), editor: c?._editor?.getJSON(), blocks: c?.recoverySnapshot().blocks, status: document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent, notices: [...(c?.querySelectorAll('[role=status], [data-bp-text-boundary]') || [])].map(n => n.textContent), html: c?._editor?.view.dom.innerHTML }; }).catch(() => null);
    fs.writeFileSync(path.join(out, 'failure-state.json'), JSON.stringify({ state, server: await read().catch(() => null) }, null, 2));
  }
  fs.writeFileSync(path.join(out, 'failure.txt'), error.stack); throw error;
} finally {
  if (app) await close(results.length === safe.length ? 'restart' : 'failed-rehearsal');
  const artifacts = Object.fromEntries(fs.readdirSync(out).filter(f => /\.(png|webm|json|txt)$/.test(f)).map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), barkdownCommit: process.env.BARKDOWN_SHOTS_HOST_COMMIT, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, isolatedRuntime: true, editorBundle, cases: results, frames, artifacts, authority: 'legacy', motion: 'Real keyboard editing and native Paper history with acknowledged private server writes; actual Electron video, no model turn.', limits: ['No navigation activation or real-library migration', `${safe.length} structured corpus cases; media and internal references remain separate gates`, 'Clean Electron restart, not database/power loss', 'Legacy edit receipts remain legacy; staging refuses later revisions even after Undo restores content'] }, null, 2) + '\n');
  console.log('Migration editor evidence:', out);
}
