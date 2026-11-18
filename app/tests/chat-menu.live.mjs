// The chat list's menu in real Electron on the carried runtime: right-click a chat -> Rename (sidebar and header
// change; an empty name is refused; a renamed new chat keeps its name after the first message); Pin -> the chat
// lists first with a pin, two pins keep pin order, Unpin puts it back, and pins and names survive a restart;
// Save as a note -> a Paper note with every message, in Pages and open beside the chat, one note for two quick
// presses, disabled for an empty chat and without the library; Export as Markdown writes the chosen file;
// the menu works from the keyboard; deleting a pinned chat removes it.
// Run: TMPDIR=/private/tmp/ heavy node tests/chat-menu.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { releaseOf } = require('../main/local-barkpark-source');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
if (!releaseOf(release)?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const out = process.env.BARKDOWN_CHAT_MENU_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chat-menu-out-'));
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chat-menu-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['Seeded chats stand in for real conversations (no provider runs); the save dialog is answered by the test; one Mac, from source under Electron on the carried runtime.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };

const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Chat desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
const t = minutes => new Date(Date.UTC(2026, 10, 18, 9, minutes)).toISOString();
const seed = (id, title, messages, minutes) => ({ id, title, createdAt: t(minutes), updatedAt: t(minutes), folder: null, messages, apiHistory: [], events: [], tabs: [], active: null, draft: '', following: true, editorExpanded: false, chatScroll: 0, side: false, parent: null, runId: null, closedTargets: [] });
const ws = createStore(dir).readJson('workspace.json');
ws.chats = {
  badger: seed('badger', 'Badger plans', [
    { role: 'user', text: 'Where do badgers sleep?', at: t(1), images: [{ id: 'i1', name: 'burrow.png', url: 'barkdown-attachment://none/burrow.png' }] },
    { role: 'assistant', text: 'In a **sett** under old oaks.\n\n- tunnels\n  - sleeping chambers\n\n```js\nconst sett = dig();\n```', at: t(2), provider: 'claude' }], 3),
  otter: seed('otter', 'Otter notes', [{ role: 'user', text: 'Otters hold hands.', at: t(4), images: [] }, { role: 'assistant', text: 'They do, while sleeping.', at: t(5) }], 6),
  heron: seed('heron', 'Heron watch', [{ role: 'user', text: 'Herons wait.', at: t(7), images: [] }], 8),
  blank: seed('blank', 'Empty chat', [], 9),
};
ws.order = ['blank', 'heron', 'otter', 'badger']; ws.current = 'badger';
createStore(dir).writeJson('workspace.json', ws);
registry.selectProfile(profile.id);

let app, page;
const errors = [];
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await new Promise(r => setTimeout(r, 200)); }
  await page.locator('#bw-recent-chats [data-context]').first().waitFor();
};
const rows = () => page.locator('#bw-recent-chats [data-context]').evaluateAll(list => list.map(b => ({ id: b.dataset.context, title: b.querySelector('span').firstChild.textContent, pinned: Boolean(b.querySelector('.bw-chat-pin')) })));
const menu = page_ => page_.locator('.bw-chat-menu:not([hidden])');
const openMenu = async id => { await page.locator(`#bw-recent-chats [data-context="${id}"]`).click({ button: 'right' }); await menu(page).waitFor(); };
const act = async (id, name) => { await openMenu(id); await menu(page).locator(`[data-chat-act="${name}"]`).click(); };
const toast = async text => { await page.locator('.bw-toast', { hasText: text }).last().waitFor({ timeout: 60000 }); return page.locator('.bw-toast', { hasText: text }).last().innerText(); };
const clearToasts = () => page.evaluate(() => document.querySelectorAll('.bw-toast').forEach(n => n.remove()));
const notes = () => page.evaluate(async () => { await window.__barkdown.refreshLibrary(); return window.__barkdown.state.barkparkDocs.map(d => ({ id: d.id, title: d.title, paperOwner: d.paperOwner })); });
const inPages = note => page.evaluate(n => { const p = window.__barkdown.state.pages; const keys = [...p.roots, ...Object.values(p.children).flat()]; return keys.some(k => k.includes(n.id)); }, note);
const rename = async (id, value) => { await act(id, 'rename'); await page.locator('.bw-ask input').fill(value); await page.locator('.bw-ask input').press('Enter'); };
try {
  await launch();

  // 1. Rename from the right-click menu.
  await openMenu('badger');
  assert.deepEqual(await menu(page).locator('[data-chat-act]').evaluateAll(b => b.map(x => x.textContent.trim())), ['Rename…', 'Pin to top', 'Save as a note', 'Export as Markdown…', 'Delete…']);
  await shot('01-chat-menu');
  await menu(page).locator('[data-chat-act="rename"]').click();
  await page.locator('.bw-ask input').fill('Sett survey'); await page.locator('.bw-ask input').press('Enter');
  await page.locator('#bw-recent-chats [data-context="badger"]', { hasText: 'Sett survey' }).waitFor();
  assert.equal(await page.locator('#bw-chat-title').innerText(), 'Sett survey');
  check('Rename… from the right-click menu changes the title in the sidebar and the chat header');

  // 2. An empty name is refused.
  await clearToasts();
  await rename('badger', '   ');
  await toast('A chat needs a name');
  assert.equal((await rows()).find(r => r.id === 'badger').title, 'Sett survey');
  check('renaming to an empty name is refused and the old name stays');

  // 3. A renamed new chat keeps its name after the first message.
  await page.locator('#bw-new-chat').click();
  const fresh = await page.evaluate(() => window.__barkdown.state.current);
  await rename(fresh, 'Named first');
  await page.locator('#bw-prompt').fill('This first message would have named the chat');
  await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.length > 0, fresh);
  await new Promise(r => setTimeout(r, 800));
  assert.equal(await page.evaluate(id => window.__barkdown.state.chats[id].title, fresh), 'Named first');
  // A name the person confirmed that happens to be the default one is still theirs (the old code replaced it).
  await page.locator('#bw-new-chat').click();
  const second = await page.evaluate(() => window.__barkdown.state.current);
  await rename(second, 'New chat');
  await page.locator('#bw-prompt').fill('Second chat first message');
  await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.length > 0, second);
  await new Promise(r => setTimeout(r, 800));
  assert.equal(await page.evaluate(id => window.__barkdown.state.chats[id].title, second), 'New chat');
  check('a renamed chat keeps its name when the first message is sent, even a name equal to the default');

  // 4. Pin two chats, then unpin one.
  await act('heron', 'pin');
  let list = await rows();
  assert.equal(list[0].id, 'heron'); assert(list[0].pinned, 'the pinned chat shows a pin');
  await act('badger', 'pin');
  list = await rows();
  assert.deepEqual(list.slice(0, 2).map(r => r.id), ['heron', 'badger'], 'two pins keep the order they were pinned in');
  await shot('02-pinned');
  await openMenu('heron'); assert.equal((await menu(page).locator('[data-chat-act="pin"]').innerText()).trim(), 'Unpin');
  await menu(page).locator('[data-chat-act="pin"]').click();
  list = await rows();
  assert.equal(list[0].id, 'badger'); assert(!list.find(r => r.id === 'heron').pinned);
  check('Pin moves a chat to the top with a pin icon; two pins keep pin order; Unpin returns it to its recent place', { order: list.map(r => r.id) });

  // 5. Names and pins survive a restart.
  await page.evaluate(() => window.__barkdown.state && new Promise(r => setTimeout(r, 900)));
  await app.close();
  await launch();
  list = await rows();
  assert.equal(list[0].id, 'badger'); assert(list[0].pinned); assert.equal(list[0].title, 'Sett survey');
  const kept = await page.evaluate(id => window.__barkdown.state.chats[id], fresh);
  assert.equal(kept.title, 'Named first'); assert.equal(kept.named, true);
  check('after a restart the pinned chat is still first with its new name, and the renamed chat keeps its name');

  // 6. Save as a note, twice quickly: one note with every message, placed in Pages, open beside the chat.
  const before = (await notes()).length;
  await openMenu('badger');
  await menu(page).locator('[data-chat-act="note"]').evaluate(b => { b.click(); b.click(); });
  const saved = await toast('Saved as a note: Sett survey');
  await new Promise(r => setTimeout(r, 1500));
  const after = await notes();
  assert.equal(after.length, before + 1, 'two quick presses make one note');
  const note = after.find(n => n.title === 'Sett survey');
  assert(note, 'the note carries the chat title');
  const paper = await page.evaluate(n => window.barkdown.barkpark.get(n.id, undefined, n.paperOwner), note);
  const body = JSON.stringify(paper.blocks);
  for (const want of ['You', 'Barkdown', 'Where do badgers sleep?', 'Image: burrow.png', 'sett', 'sleeping chambers', 'const sett = dig();', 'saved from Barkdown on']) assert(body.toLowerCase().includes(want.toLowerCase()), `note lacks ${want}: ${body.slice(0, 1500)}`);
  assert(body.indexOf('Where do badgers sleep?') < body.indexOf('sleeping chambers'), 'messages keep their order');
  assert(await inPages(note), 'the note is placed in Pages');
  const tab = await page.evaluate(() => { const s = window.__barkdown.state, chat = s.chats[s.current]; return { chat: s.current, tab: chat.tabs.find(x => x.id === chat.active) }; });
  assert.equal(tab.chat, 'badger'); assert.equal(tab.tab.type, 'doc'); assert.equal(tab.tab.path.at(-1), note.id);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror', { hasText: 'Where do badgers sleep?' }).waitFor();
  await shot('03-saved-note');
  check('Save as a note makes one Paper note (two quick presses) with every message in order, in Pages and open beside the chat', { toast: saved, id: note.id });

  // 7. An empty chat and a profile without its library cannot save; the reason is on the item.
  await openMenu('blank');
  assert(await menu(page).locator('[data-chat-act="note"]').isDisabled()); assert(await menu(page).locator('[data-chat-act="export"]').isDisabled());
  assert.match(await menu(page).locator('[data-chat-act="note"]').innerText(), /No messages/);
  await shot('04-empty-chat-menu');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__barkdown.state.settings.barkpark.local.enabled = false; });
  await openMenu('otter');
  assert(await menu(page).locator('[data-chat-act="note"]').isDisabled()); assert.match(await menu(page).locator('[data-chat-act="note"]').innerText(), /Library off/);
  assert(!await menu(page).locator('[data-chat-act="export"]').isDisabled());
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__barkdown.state.settings.barkpark.local.enabled = true; });
  check('Save as a note is disabled for a chat with no messages (title-only notes are not made) and without the local library, with the reason shown');

  // 8. Export as Markdown writes the chosen file.
  const file = path.join(userData, 'exported-otter.md');
  await app.evaluate(({ dialog }, chosen) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: chosen }); }, file);
  await clearToasts();
  await act('otter', 'export');
  await toast('Exported to exported-otter.md');
  const md = fs.readFileSync(file, 'utf8');
  assert(md.startsWith('# Otter notes\n'), md.slice(0, 80));
  assert(md.indexOf('Otters hold hands.') < md.indexOf('They do, while sleeping.'));
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  await act('otter', 'export');
  await new Promise(r => setTimeout(r, 500));
  check('Export as Markdown… writes the chat to the chosen file; Cancel writes nothing', { file: path.basename(file) });

  // 9. Keyboard: the … button is focusable, Enter opens, arrows move, Escape closes back to the button.
  const more = page.locator('#bw-recent-chats [data-chat-menu="otter"]');
  await more.focus();
  assert(await more.evaluate(b => getComputedStyle(b).opacity === '1'), 'the … button shows on keyboard focus');
  await page.keyboard.press('Enter');
  await menu(page).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.chatAct), 'rename');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.chatAct), 'pin');
  await shot('05-keyboard-menu');
  await page.keyboard.press('Escape');
  assert.equal(await menu(page).count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.chatMenu), 'otter');
  check('the … button is reachable by keyboard: Enter opens the menu on its first item, arrows move, Escape closes and returns focus');

  // 10. Delete a pinned chat.
  await act('badger', 'delete');
  await page.locator('.bw-ask[role="alertdialog"] [data-ok]').click();
  await page.waitForFunction(() => !window.__barkdown.state.chats.badger);
  list = await rows();
  assert(!list.some(r => r.id === 'badger')); assert(!list.some(r => r.pinned));
  check('Delete… removes a pinned chat after the confirm', { order: list.map(r => r.id) });

  assert.deepEqual(errors, [], 'no page errors');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error);
  try { await shot('failure'); } catch {}
  throw error;
} finally {
  persist();
  await app?.close().catch(() => {});
  console.log('result: ' + path.join(out, 'result.json'));
}
