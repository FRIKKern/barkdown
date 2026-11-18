// A Paper note's Outline, in real Electron on the carried runtime. A note with a title and three headings
// opens; the Outline button in its path bar shows them nested (Gear, Tent under it, Food) with the word count
// below. Choosing Food scrolls the note until Food is near the top, highlights it and marks it as the current
// section, without touching the caret. A heading typed into the note, and one an agent edit adds, appear in
// the list. The shortcut toggles it; the open state survives a reload. Narrow, the panel lies over the note.
// Edge scenes: a note with no headings, a note with 300 headings, heading text that looks like HTML, two
// note tabs, and a profile switch with the panel open.
// Run: TMPDIR=/private/tmp/ BARKDOWN_TEST_BP_RELEASE=$PWD/../runtime/barkpark-<pin>-darwin-arm64 heavy node tests/note-outline.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { countWords } from '../renderer/src/note-outline-model.js';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { releaseOf } = require('../main/local-barkpark-source');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
if (!releaseOf(release)?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const out = process.env.BARKDOWN_OUTLINE_OUT || path.resolve('../docs/cycles/evidence/note-outline/live', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(process.env.BARKDOWN_OUTLINE_DATA || os.tmpdir(), 'bd-outline-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One Mac, from source under Electron on the carried runtime. The agent edit is applied through the same ops call and announced the way a finished agent edit is (controller.refresh), not by a provider run.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Outline desk' }), dir = registry.storeFor(profile.id).storeDir;
const other = registry.createProfile({ name: 'Other desk' });
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(registry.storeFor(other.id).storeDir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: false } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const errors = [];
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const pane = () => page.locator('.bw-paper-pane:not([hidden])');
const panel = () => pane().locator('.bw-outline');
const rows = () => pane().locator('.bw-outline-row').evaluateAll(list => list.map(b => [b.textContent, Number(b.dataset.depth)]));
const words = n => Array.from({ length: n }, (_, i) => ['river', 'stone', 'pine', 'ridge', 'camp', 'trail', 'lake', 'moss'][i % 8]).join(' ');
const paragraphs = (count, n) => Array.from({ length: count }, (_, i) => `Day ${i + 1}: ${words(n)}.`).join('\n\n');
const make = (title, markdown) => page.evaluate(input => window.barkdown.barkpark.createNoteWith({ requestId: crypto.randomUUID(), ...input }), { title, markdown });
const open = async (note, text) => {
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), note);
  await pane().locator('.ProseMirror', { hasText: text }).waitFor();
  await page.waitForTimeout(600);
};
// The heading's top edge relative to the note's scroller, once a smooth scroll has come to rest.
const headingTop = async text => { let last = NaN; for (let i = 0; i < 40; i++) { const now = await headingTopNow(text); if (now === last) return now; last = now; await page.waitForTimeout(100); } return last; };
const headingTopNow = text => pane().evaluate((node, text) => {
  const h = [...node.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3')].find(x => x.textContent === text);
  return h.getBoundingClientRect().top - node.querySelector('#current').getBoundingClientRect().top;
}, text);
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1400, height: 900 });
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await new Promise(r => setTimeout(r, 200)); }

  const body = { gear: paragraphs(6, 40), tent: paragraphs(6, 40), food: paragraphs(10, 40) };
  const trip = await make('Trip plan', `${words(12)}\n\n## Gear\n\n${body.gear}\n\n### Tent\n\n${body.tent}\n\n## Food\n\n${body.food}\n`);
  const tripWords = countWords([words(12), 'Gear', body.gear, 'Tent', body.tent, 'Food', body.food].join('\n'));
  await open(trip, 'Day 10');
  // A wide work area: the work tab fills the window beside a collapsed chat.
  await page.evaluate(() => { window.__barkdown.state.chats[window.__barkdown.state.current].editorExpanded = true; window.__barkdown.render(); });
  await page.waitForTimeout(300);

  // 1. Closed by default; the button sits next to Export.
  const order = await pane().locator('.bw-doc-actions > button').evaluateAll(list => list.map(b => b.dataset.act || b.title));
  assert.equal(order[order.indexOf('export') + 1], 'outline', 'Outline follows Export: ' + order.join(', '));
  assert.equal(await panel().isHidden(), true, 'closed by default');
  await pane().locator('[data-act="outline"]').click();
  await panel().waitFor();
  assert.deepEqual(await rows(), [['Gear', 0], ['Tent', 1], ['Food', 0]]);
  assert.equal(await panel().locator('.bw-outline-title').innerText(), 'Trip plan');
  const footer = await panel().locator('.bw-outline-footer').innerText();
  assert.equal(footer, `${tripWords.toLocaleString('en-US')} words · ${Math.max(1, Math.round(tripWords / 230))} min read`);
  const geometry = await pane().evaluate(node => { const r = e => e.getBoundingClientRect(); const p = r(node.querySelector('.bw-outline')), s = r(node.querySelector('#current')); return { panelLeft: p.left, panelWidth: p.width, scrollerRight: s.right, paneRight: r(node).right, position: getComputedStyle(node.querySelector('.bw-outline')).position }; });
  assert.equal(geometry.position, 'static'); assert(geometry.scrollerRight <= geometry.panelLeft + 1 && Math.abs(geometry.panelLeft + geometry.panelWidth - geometry.paneRight) <= 1, JSON.stringify(geometry));
  await shot('01-outline-open');
  check('Outline (next to Export) opens beside the note: Gear, Tent nested under it, Food; title on top; word count and reading time below', { footer, geometry });

  // 2. Choose Food: the note scrolls to it, it is highlighted and marked; the caret stays where it was.
  await pane().locator('.ProseMirror p').first().click();
  const caretBefore = await page.evaluate(() => { const s = window.getSelection(); return [s.anchorNode?.textContent?.slice(0, 20), s.anchorOffset]; });
  const scrollBefore = await pane().locator('#current').evaluate(s => s.scrollTop);
  await panel().locator('.bw-outline-row', { hasText: 'Food' }).click();
  assert.equal(await page.evaluate(() => CSS.highlights.get('bw-outline-flash')?.values().next().value?.startContainer?.textContent), 'Food', 'Food is highlighted');
  await page.waitForFunction(() => { const p = document.querySelector('.bw-paper-pane:not([hidden])'); return p.querySelector('.bw-outline-row[data-index="2"][aria-current]'); }, null, { timeout: 5000 });
  await page.waitForTimeout(500);
  const top = await headingTop('Food');
  assert(top >= 0 && top <= 60, 'Food sits near the top of the note: ' + top);
  assert(await pane().locator('#current').evaluate(s => s.scrollTop) > scrollBefore + 200);
  const caretAfter = await page.evaluate(() => { const s = window.getSelection(); return [s.anchorNode?.textContent?.slice(0, 20), s.anchorOffset]; });
  assert.deepEqual(caretAfter, caretBefore, 'the caret did not move');
  await shot('02-jumped-to-food');
  check('choosing Food scrolls the note so Food is near the top, highlights it and marks it current; the caret stays put', { top });
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => CSS.highlights.has('bw-outline-flash')), false, 'the highlight fades');

  // Scrolling by hand moves the mark; back at the top the title is current.
  await pane().locator('#current').evaluate(s => { s.scrollTop = 0; });
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) .bw-outline-title[aria-current]'));
  check('scrolling back to the top marks the title as current');

  // 3. Type a heading at the end of the note: it appears in the list and is saved.
  // Keys pressed before ProseMirror has seen the caret land in the old spot: wait for it.
  await pane().locator('.ProseMirror p').last().click();
  await page.keyboard.press(MOD === 'Meta' ? 'Meta+ArrowDown' : 'Control+End');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.type('## Camp');
  await page.waitForFunction(() => [...document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-outline-row')].some(b => b.textContent === 'Camp'), null, { timeout: 3000 });
  assert.deepEqual(await rows(), [['Gear', 0], ['Tent', 1], ['Food', 0], ['Camp', 0]]);
  await pane().locator('#save-state', { hasText: 'Saved' }).waitFor({ timeout: 30000 });
  const saved = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), trip);
  assert(saved.blocks.some(b => b.type === 'heading' && /Camp/.test(JSON.stringify(b))), 'the typed heading is saved');
  await shot('03-typed-heading');
  check('a heading typed into the note appears in the outline within the debounce, and the note saves it');

  // 4. An agent edit that adds a heading shows up too.
  const agentRev = saved.rev;
  const applied = await page.evaluate(({ id, rev, binding }) => window.barkdown.barkpark.applyOps(id, [{ op: 'append-block', block: { type: 'heading', level: 3, text: 'Water' } }], rev, binding), { id: trip.id, rev: agentRev, binding: saved.binding });
  assert(applied.ok);
  // A focused editor holds a server update back until it is idle; the person has stepped away from it.
  await page.evaluate(id => { document.activeElement?.blur?.(); for (const c of window.__barkdown.controllers.values()) if (!c.el.hidden) c.refresh('bp:' + id); }, trip.id);
  await page.waitForFunction(() => [...document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-outline-row')].some(b => b.textContent === 'Water'), null, { timeout: 15000 });
  assert.deepEqual((await rows()).at(-1), ['Water', 1]);
  check('a heading added by an edit from outside the editor (agent path) appears in the outline');

  // 5. The shortcut toggles it; the open state is the tab's and survives a reload.
  await pane().locator('.ProseMirror p').first().click();
  await page.keyboard.press(`${MOD}+Shift+KeyO`);
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) .bw-outline').hidden);
  assert.equal(await pane().locator('[data-act="outline"]').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press(`${MOD}+Shift+KeyO`);
  await panel().waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.closest?.('.ProseMirror') !== null), true, 'the shortcut leaves focus in the note');
  // Markdown source mode hides the Paper view: the outline says so instead of "No headings yet", and
  // comes back with the headings when the note returns to the Paper view.
  const sourceNote = `The outline follows the Paper view. Press ${MOD === 'Meta' ? '⌘⇧M' : 'Ctrl+Shift+M'} to return to it.`;
  await page.keyboard.press(`${MOD}+Shift+KeyM`);
  await pane().locator('bp-paper-canvas > textarea').waitFor();
  await page.waitForFunction(text => document.querySelector('.bw-paper-pane:not([hidden]) .bw-outline-empty')?.textContent === text, sourceNote, { timeout: 5000 });
  const inSource = await panel().evaluate(node => ({ rows: node.querySelectorAll('.bw-outline-row').length, footer: node.querySelector('.bw-outline-footer').textContent, shown: !node.querySelector('.bw-outline-empty').hidden }));
  assert.deepEqual(inSource, { rows: 0, footer: '', shown: true }, 'source mode: no stale rows or count');
  await page.keyboard.press(`${MOD}+Shift+KeyM`);
  await pane().locator('bp-paper-canvas > textarea').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-outline-row').length === 5, null, { timeout: 5000 });
  assert.match(await panel().locator('.bw-outline-footer').textContent(), /words/);
  check(`Markdown source mode (${MOD}+Shift+M): the outline says it follows the Paper view, then lists the headings again on return`);
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await pane().locator('.ProseMirror', { hasText: 'Day 10' }).waitFor();
  await panel().waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-outline-row').length === 5);
  check(`${MOD}+Shift+O closes and opens the outline without taking focus from the note; open stays open after a reload`);

  // 6. Narrow: the panel lies over the note's right edge and steps aside after a choice.
  await page.evaluate(() => { window.__barkdown.state.chats[window.__barkdown.state.current].editorExpanded = false; window.__barkdown.render(); });
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  const narrow = await pane().evaluate(node => { const r = e => e.getBoundingClientRect(); const p = r(node.querySelector('.bw-outline')), s = r(node.querySelector('#current')); return { pane: r(node).width, scroller: s.width, panel: p.width, position: getComputedStyle(node.querySelector('.bw-outline')).position, overlap: s.right > p.left }; });
  assert.equal(narrow.position, 'absolute', JSON.stringify(narrow)); assert(Math.abs(narrow.scroller - narrow.pane) <= 1, 'the note keeps its whole width: ' + JSON.stringify(narrow));
  await shot('04-narrow-overlay');
  await panel().locator('.bw-outline-row', { hasText: 'Tent' }).click();
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) .bw-outline').hidden);
  await page.waitForTimeout(600);
  const tentTop = await headingTop('Tent');
  assert(tentTop >= 0 && tentTop <= 60, 'Tent near the top: ' + tentTop);
  check('narrow work area: the outline lies over the note (the note keeps its width) and steps aside after choosing Tent, which is then near the top', narrow);
  await pane().locator('[data-act="outline"]').click();
  await panel().waitFor();

  // Edge: a note with no headings, in a second tab: "No headings yet" and its own word count; the first tab keeps its list.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => { window.__barkdown.state.chats[window.__barkdown.state.current].editorExpanded = true; window.__barkdown.render(); });
  const plain = await make('Shopping', `${words(25)}\n\n${words(5)}\n`);
  await open(plain, 'river');
  await pane().locator('[data-act="outline"]').click();
  await panel().waitFor();
  assert.equal(await panel().locator('.bw-outline-empty').innerText(), 'No headings yet');
  assert.equal(await pane().locator('.bw-outline-row').count(), 0);
  const plainFooter = await panel().locator('.bw-outline-footer').innerText();
  assert.equal(plainFooter, '30 words · 1 min read', plainFooter);
  await shot('05-no-headings');
  const tabs = await page.evaluate(() => window.__barkdown.state.chats[window.__barkdown.state.current].tabs.filter(t => t.type === 'doc').map(t => t.id));
  // An edit lands in the first note while its tab is in the background.
  const behind = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), trip);
  assert((await page.evaluate(({ id, rev, binding }) => window.barkdown.barkpark.applyOps(id, [{ op: 'append-block', block: { type: 'heading', level: 2, text: 'Maps' } }], rev, binding), { id: trip.id, rev: behind.rev, binding: behind.binding })).ok);
  await page.evaluate(({ tab, id }) => window.__barkdown.controllers.get(tab).refresh('bp:' + id), { tab: tabs[0], id: trip.id });
  await page.waitForTimeout(800);
  await page.evaluate(id => { const s = window.__barkdown.state, chat = s.chats[s.current]; chat.active = id; window.__barkdown.render(); }, tabs[0]);
  await pane().locator('.ProseMirror', { hasText: 'Day 10' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-outline-row').length === 6, null, { timeout: 5000 });
  assert.deepEqual((await rows()).map(r => r[0]), ['Gear', 'Tent', 'Food', 'Camp', 'Water', 'Maps'], 'the first tab shows its own note, with the edit that came while it was in the background');
  check('edge: a note without headings says "No headings yet" with its own count (30 words · 1 min read); switching tabs shows each note its own outline', { plainFooter });

  // Edge: heading text that looks like HTML stays text.
  const tricky = await make('Tricky', 'Text.\n');
  const trickyPaper = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), tricky);
  assert((await page.evaluate(({ id, rev, binding }) => window.barkdown.barkpark.applyOps(id, [{ op: 'append-block', block: { type: 'heading', level: 2, text: '<img src=x onerror="window.__outlineXss=1"> & <b>bold</b>' } }], rev, binding), { id: tricky.id, rev: trickyPaper.rev, binding: trickyPaper.binding })).ok);
  await open(tricky, 'Text.');
  await pane().locator('[data-act="outline"]').click();
  await panel().waitFor();
  const trickyRow = await pane().locator('.bw-outline-row').first().evaluate(b => ({ text: b.textContent, html: b.innerHTML, images: b.querySelectorAll('img, b').length }));
  await page.waitForTimeout(300);
  assert.equal(trickyRow.images, 0); assert.equal(await page.evaluate(() => window.__outlineXss), undefined);
  assert(trickyRow.text.includes('<img src=x'), JSON.stringify(trickyRow));
  check('edge: a heading that looks like HTML shows as text, with no element made and nothing run', trickyRow);

  // Edge: 300 headings. The panel opens at once, typing stays quick, the list scrolls with the note.
  const many = Array.from({ length: 300 }, (_, i) => `## Section ${i + 1}\n\n${words(30)}`).join('\n\n');
  const big = await make('Big', `${many}\n`);
  await open(big, 'Section 300');
  const openMs = await pane().evaluate(node => { const t = performance.now(); node.querySelector('[data-act="outline"]').click(); return performance.now() - t; });
  assert.equal(await pane().locator('.bw-outline-row').count(), 300);
  const typing = await page.evaluate(async () => {
    const pane = document.querySelector('.bw-paper-pane:not([hidden])'), c = pane.querySelector('bp-paper-canvas');
    c._editor.commands.focus('end');
    let worst = 0; const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) worst = Math.max(worst, e.duration); }); obs.observe({ type: 'longtask' });
    const t = performance.now();
    for (let i = 0; i < 20; i++) { c._editor.commands.insertContent('x'); await new Promise(r => requestAnimationFrame(r)); }
    const typed = performance.now() - t; await new Promise(r => setTimeout(r, 600)); obs.disconnect();
    return { typedMs: Math.round(typed), longestTaskMs: Math.round(worst) };
  });
  await pane().locator('#current').evaluate(s => { s.scrollTop = s.scrollHeight; });
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) .bw-outline-row[data-index="299"][aria-current]'));
  const listScroll = await panel().locator('.bw-outline-list').evaluate(l => ({ scrollTop: l.scrollTop, scrollable: l.scrollHeight > l.clientHeight }));
  assert(listScroll.scrollable && listScroll.scrollTop > 0, JSON.stringify(listScroll));
  assert(openMs < 500, 'opening the outline of 300 headings took ' + openMs + ' ms');
  await shot('06-300-headings');
  check('edge: 300 headings: the outline opens in ' + Math.round(openMs) + ' ms, 20 typed characters take ' + typing.typedMs + ' ms (longest task ' + typing.longestTaskMs + ' ms), and the list follows the note to Section 300', { openMs: Math.round(openMs), ...typing, listScroll });

  // Edge: profile switch with the panel open. The other profile's workspace has no outline; coming back the note's tab has it open again.
  await page.waitForTimeout(800);
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); }, other.id);
  await page.reload();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, other.id);
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.bw-outline:not([hidden])').count(), 0, 'no outline in the other profile');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); }, profile.id);
  await page.reload();
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, profile.id);
  await pane().locator('.ProseMirror', { hasText: 'Section 300' }).waitFor({ timeout: 120000 });
  await panel().waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-outline-row').length === 300);
  check('edge: switching profiles with the panel open shows no outline in the other profile; back again, the note\'s tab shows its own outline');

  assert.deepEqual(errors, []);
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ status: report.status, out }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1;
  if (page) await shot('failure').catch(() => {});
} finally { if (app) await app.close().catch(() => {}); fs.rmSync(userData, { recursive: true, force: true }); }
