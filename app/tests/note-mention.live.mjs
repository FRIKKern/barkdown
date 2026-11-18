// Actual Electron + owned local Paper runtime + the real API SDK over a scripted fixture (not a live model):
// type "@" and part of a note's title in the composer, pick it, send; the request the provider receives holds the
// note's text in its fence, and the sent message shows a chip that opens the note. Also: "@" inside an email
// address opens nothing, Escape keeps the "@", one note mentioned twice is sent once, a long note is cut,
// Backspace removes a token whole, typing in the open note just before sending is saved first and sent (an edit
// whose save fails, here a conflict, goes with the last saved text and a toast), history Up brings a mention back,
// a deleted note is said to be unavailable, a side chat mentions too, and the chips survive a reload (main kept the
// mentions on the message).
// Run: heavy env TMPDIR=/private/tmp/ BARKDOWN_TEST_BP_SOURCE=<packaged runtime> node tests/note-mention.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required (BARKDOWN_TEST_BP_SOURCE)');
const appDir = path.resolve('.'), userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-note-mention-'));
const out = path.join(appDir, 'test-results/note-mention', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
setTimeout(() => { console.error('note-mention: stuck'); process.exit(1); }, 600000).unref();

const lastUser = body => { const c = body.messages.filter(m => m.role === 'user').at(-1).content; return typeof c === 'string' ? c : c.filter(b => b.type === 'text').map(b => b.text).join('\n'); };
const seen = [];
const transport = await createToolFixture(body => { seen.push(lastUser(body)); return { text: `Read turn ${seen.length}.` }; });
const results = [], errors = [];
let app, page;
const step = (name, ok = true) => { results.push(name); console.log((ok ? 'ok ' : '') + name); };
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', '--user-data=' + userData], timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
  page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(async source => {
    const b = window.__barkdown; b.state.settings = await window.barkdown.settings.set({ theme: 'dark', provider: 'api', apiKey: 'synthetic-fixture', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } });
    b.state.chats[b.state.current].provider = 'api'; document.documentElement.dataset.theme = 'dark'; await b.refreshLibrary(); b.render();
  }, source);
  const make = (title, markdown) => page.evaluate(input => window.barkdown.barkpark.createNoteWith(input), { requestId: crypto.randomUUID(), title, markdown });
  const plan = await make('Saffron launch plan', 'The secret word is marigold.\n\nWe ship on Friday.');
  const long = await make('Long ledger', Array.from({ length: 1200 }, (_, i) => `Ledger line ${i} keeps going.`).join(' '));
  const doomed = await make('Doomed note', 'This note will be deleted before the send.');
  await page.evaluate(() => window.__barkdown.refreshLibrary());
  await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.some(d => d.title === 'Doomed note'));

  const input = page.locator('#bw-prompt'), menu = page.locator('.bw-mention-menu:not([hidden])');
  const idle = n => page.waitForFunction(n => { const s = window.__barkdown.state; return Object.values(s.chats).every(c => !c.runId && !(c.messages || []).some(m => m.streaming)) && document.querySelectorAll('.bw-user-message').length >= n; }, n, { timeout: 120000 });
  await input.click();

  // Not a mention: "@" inside an address.
  await input.pressSequentially('write to ann@saff');
  await page.waitForTimeout(150); assert.equal(await menu.count(), 0, 'no picker inside an email address'); step('email address opens no picker');
  await input.fill('');

  // Escape closes and leaves the "@" text.
  await input.pressSequentially('Hey @saf');
  await menu.waitFor(); await page.keyboard.press('Escape');
  assert.equal(await menu.count(), 0); assert.equal(await input.inputValue(), 'Hey @saf'); step('Escape keeps the @ text');
  await input.fill('');

  // Pick with Enter, the same note again with Tab, then the long one; Backspace removes a token whole.
  await input.pressSequentially('Compare @saff');
  await menu.waitFor(); assert.match(await menu.locator('[aria-selected="true"]').innerText(), /Saffron launch plan/);
  await page.screenshot({ path: path.join(out, '01-picker.png') });
  await page.keyboard.press('Enter');
  assert.equal(await input.inputValue(), 'Compare @[Saffron launch plan] ');
  await input.pressSequentially('with @long');
  await menu.waitFor(); await page.keyboard.press('Tab');
  assert.equal(await input.inputValue(), 'Compare @[Saffron launch plan] with @[Long ledger] ');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  assert.equal(await input.inputValue(), 'Compare @[Saffron launch plan] with ', 'Backspace removes the token whole');
  step('Backspace removes a mention whole');
  await input.pressSequentially('@long'); await menu.waitFor(); await page.keyboard.press('Enter');
  await input.pressSequentially('and @launch'); await menu.waitFor(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  const words = 'Compare @[Saffron launch plan] with @[Long ledger] and @[Saffron launch plan]';
  assert.equal((await input.inputValue()).trim(), words);
  await page.keyboard.press('Enter');
  await idle(1);
  const first = seen[0];
  assert.equal((first.match(/<note /g) || []).length, 2, 'one note mentioned twice is sent once');
  // The Paper note's text starts with its locked title heading.
  assert.ok(/<note title="Saffron launch plan" id="bp:[^"]+">\n# Saffron launch plan\n\nThe secret word is marigold\.\n\nWe ship on Friday\.\n<\/note>/.test(first), 'plan fenced: ' + first.slice(0, 400));
  assert.ok(/…\(cut: the note is longer than 20,000 characters/.test(first), 'long note cut');
  assert.ok(first.endsWith('\n\n' + words), 'the person\'s words come last');
  step('dispatched prompt carries both notes, deduplicated, long one cut');
  const chips = page.locator('.bw-user-message').last().locator('.bw-mention');
  assert.equal(await chips.count(), 3);
  assert.equal(await page.locator('.bw-user-message').last().evaluate(n => n.textContent.includes('marigold')), false, 'the transcript shows the words, not the note');
  await page.screenshot({ path: path.join(out, '02-sent-with-chips.png') });
  await chips.first().click();
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes('marigold'), null, { timeout: 90000 });
  const tab = await page.evaluate(() => { const s = window.__barkdown.state, c = s.chats[s.current]; return c.tabs.find(t => t.id === c.active); });
  assert.equal(tab.path.at(-1), plan.id); assert.equal(tab.source, 'barkpark');
  await page.screenshot({ path: path.join(out, '03-chip-opened-note.png') });
  step('chip opens the note in a tab');

  // Unsaved typing in the open note: mention it, type in the note, and send in the same tick (the canvas has not
  // sent the edit yet). The send waits for the note to finish saving, so the assistant gets the just-typed words.
  const paneOf = () => page.evaluate(() => { const b = window.__barkdown, s = b.state, c = s.chats[s.current]; return b.controllers.get(c.active)?.isDirty?.(); });
  await input.click(); await input.fill(''); await input.pressSequentially('Fresh look at @saff'); await menu.waitFor(); await page.keyboard.press('Enter');
  const body = page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').last();
  await body.click(); await page.keyboard.press('End');
  await page.keyboard.type(' Typed just now: zucchini.');
  const dirtyAtSend = await page.evaluate(() => { const b = window.__barkdown, s = b.state, c = s.chats[s.current]; const dirty = b.controllers.get(c.active).isDirty(); document.querySelector('#bw-compose').requestSubmit(); return dirty; });
  assert.equal(dirtyAtSend, true, 'the note still had unsaved edits when the message was sent');
  await idle(2);
  assert.ok(/<note title="Saffron launch plan" id="bp:[^"]+">\n[^]*We ship on Friday\. Typed just now: zucchini\.\n<\/note>\n\nFresh look at @\[Saffron launch plan\]$/.test(seen[1]), 'just-typed words sent: ' + seen[1].slice(0, 400));
  assert.equal(await paneOf(), false, 'the note is saved');
  assert.equal(await page.locator('.bw-toast').filter({ hasText: 'unsaved edits' }).count(), 0, 'no unsaved notice when the save finished');
  step('unsaved typing in the open note is saved first and sent');

  // An edit whose save fails: another writer changed the note after this tab loaded it, so the tab's save meets a
  // conflict. The send does not wait for the person to resolve it: it goes with the last saved text, and a toast
  // names the note.
  await page.evaluate(async ({ id, owner }) => { const p = await window.barkdown.barkpark.get(id, undefined, owner);
    await window.barkdown.barkpark.applyOps(id, [{ op: 'append-block', block: { type: 'paragraph', content: [{ type: 'text', value: 'Another writer added this.' }] } }], p.rev, p.binding); }, { id: plan.id, owner: plan.paperOwner || null });
  await input.click(); await input.fill(''); await input.pressSequentially('Again @saff'); await menu.waitFor(); await page.keyboard.press('Enter');
  await body.click(); await page.keyboard.press('End');
  await page.keyboard.type(' Conflicting words: radish.');
  const dirtyAtConflict = await page.evaluate(() => { const b = window.__barkdown, s = b.state, c = s.chats[s.current]; const dirty = b.controllers.get(c.active).isDirty(); document.querySelector('#bw-compose').requestSubmit(); return dirty; });
  assert.equal(dirtyAtConflict, true);
  await page.locator('.bw-toast').filter({ hasText: '"Saffron launch plan" has unsaved edits; the assistant got the last saved version.' }).first().waitFor({ timeout: 15000 });
  await idle(3);
  assert.ok(/<note title="Saffron launch plan" id="bp:[^"]+">\n[^]*zucchini\.[^]*Another writer added this\.\n<\/note>\n\nAgain @\[Saffron launch plan\]$/.test(seen[2]), 'last saved version sent: ' + seen[2].slice(0, 500));
  assert.ok(!seen[2].includes('radish'), 'the edit that did not save is not claimed as sent');
  await page.screenshot({ path: path.join(out, '03b-unsaved-notice.png') });
  // Take the other writer's version so the tab is clean for what follows.
  await page.locator('.bw-paper-pane [data-act="theirs"]').click();
  await page.waitForFunction(() => { const b = window.__barkdown, s = b.state, c = s.chats[s.current]; return b.controllers.get(c.active)?.isDirty() === false; });
  step('an edit whose save fails: sent with the last saved text and a toast');

  // History Up brings the mention back, and sending it again reads the note again.
  await input.click(); await input.fill('');
  for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowUp'); // the two sends above are newer
  assert.equal(await input.inputValue(), words); await page.keyboard.press('Enter');
  await idle(4);
  assert.ok(/The secret word is marigold\./.test(seen[3]), 'resend reads the note: ' + seen[3].slice(0, 300)); step('history Up restores the mention and resends the note');

  // Mention, then the note is deleted, then send: the message says so and the send still works.
  await input.pressSequentially('What about @doom'); await menu.waitFor(); await page.keyboard.press('Enter');
  await page.evaluate(async ({ id, owner }) => { const p = await window.barkdown.barkpark.get(id, undefined, owner); await window.barkdown.barkpark.deleteNote(p.id, p.revision, p.binding); await window.__barkdown.refreshLibrary(); }, { id: doomed.id, owner: doomed.paperOwner || null });
  await page.keyboard.press('Enter');
  await page.locator('.bw-toast').filter({ hasText: 'not available' }).first().waitFor();
  await idle(5);
  assert.ok(/<note title="Doomed note" id="bp:[^"]+">\n\(note not available\)\n<\/note>\n\nWhat about @\[Doomed note\]$/.test(seen[4]), 'deleted note: ' + seen[4].slice(0, 400));
  step('deleted note sends "(note not available)" with a toast');

  // A side chat shares the composer and mentions too.
  await page.locator('#bw-plus').click(); await page.locator('#bw-new-menu [data-new="chat"]').click();
  const side = page.locator('.bw-side-compose textarea'); await side.waitFor(); await side.click();
  await side.pressSequentially('Side check @saff'); await menu.waitFor(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await idle(6);
  assert.ok(/The secret word is marigold\.[\s\S]*\n\nSide check @\[Saffron launch plan\]$/.test(seen[5]), 'side chat: ' + seen[5].slice(-300));
  assert.ok(await page.locator('.bw-mention').count() >= 4, 'the side chat message shows its chip too');
  await page.screenshot({ path: path.join(out, '04-side-chat.png') });
  step('side chat mention sends the note');

  // The stored message is the words with tokens; main kept the mentions, so chips survive a reload.
  const stored = await page.evaluate(() => { const s = window.__barkdown.state, c = s.chats[s.current]; return c.messages.filter(m => m.role === 'user').map(m => ({ text: m.text, mentions: m.mentions?.length || 0 })); });
  assert.deepEqual(stored[0], { text: words, mentions: 2 });
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.waitForFunction(() => document.querySelectorAll('.bw-user-message .bw-mention').length >= 3);
  step('mentions persist on the message across reload');
  assert.deepEqual(transport.errors, []);
  assert.deepEqual(errors, []);
  console.log(`Note mention live passed: ${results.length} checks. Shots in ${out}`);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  console.error('seen requests:', JSON.stringify(seen.map(s => s.slice(0, 400)), null, 1));
  throw error;
} finally { await app?.close().catch(() => {}); await transport.close(); }
