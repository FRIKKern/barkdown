// Quick open › In chats, in real Electron on two profiles: typing a word finds it in a side chat's
// assistant reply; choosing the hit opens that chat with the message in view and highlighted. A word that
// only another profile's chat holds is not found, and HTML in chat text stays text.
// Run: TMPDIR=/private/tmp/ heavy node tests/chat-search.live.mjs
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const { createProfileRegistry } = require('../main/profile-registry');
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chat-search-')));
const shots = path.resolve('test-results/chat-search'); fs.mkdirSync(shots, { recursive: true });
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const errors = [];
const open = async () => { const app = await launch(), page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message)); await page.waitForFunction(() => window.__barkdown?.state.loaded); await page.setViewportSize({ width: 1400, height: 900 }); return { app, page }; };
setTimeout(() => { console.error('chat-search: stuck'); process.exit(1); }, 240000).unref();

// First launch makes profile A; B is created beside it. Both are then seeded on disk while the app is closed.
let { app, page } = await open();
const a = await page.evaluate(() => window.__barkdown.state.profileId);
await page.evaluate(() => window.barkdown.profiles.create('Second profile'));
await app.close();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const b = registry.load().profiles.find(p => p.id !== a).id;
const iso = minutesAgo => new Date(Date.now() - minutesAgo * 60000).toISOString();
const chat = (id, title, extra, messages) => ({ id, title, createdAt: iso(90), updatedAt: iso(extra.ago), folder: null, messages, apiHistory: [], events: [], tabs: [], active: null, draft: '', following: true, editorExpanded: false, chatScroll: 0, side: Boolean(extra.parent), parent: extra.parent || null, runId: null, closedTargets: [] });
const filler = n => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `Filler line ${i}. `.repeat(30), at: iso(50 - i) }));
function seed(profileId, chats, current) {
  const file = path.join(registry.storeFor(profileId).storeDir, 'workspace.json');
  const ws = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { version: 1, chats: {}, order: [] };
  Object.assign(ws.chats, Object.fromEntries(chats.map(c => [c.id, c])));
  ws.order = [...chats.map(c => c.id), ...ws.order.filter(id => !chats.some(c => c.id === id))]; ws.current = current; ws.mode = 'chat';
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(ws));
}
seed(a, [
  chat('bergen', 'Trip to Bergen', { ago: 5 }, [{ role: 'user', text: 'Plan a weekend in Bergen.', at: iso(60) }, ...filler(6)]),
  chat('rain', 'Rain plan', { ago: 2, parent: 'bergen' }, [
    { role: 'user', text: 'Is Fløyen worth it in rain?', at: iso(59) },
    { role: 'assistant', text: 'Yes. The funicular runs in any weather <img src=x onerror="window.__xss=1">, and the café stays open.', at: iso(58) },
    ...filler(24),
  ]),
], 'bergen');
seed(b, [chat('secret', 'Profile B only', { ago: 1 }, [{ role: 'user', text: 'The zeppelin code is 4411.', at: iso(3) }, { role: 'assistant', text: 'Noted, zeppelin.', at: iso(2) }])], 'secret');

({ app, page } = await open());
try {
  assert.equal(await page.evaluate(() => window.__barkdown.state.profileId), a, 'profile A is active');
  const list = page.locator('#bw-palette-list');
  const search = async (words, settled) => {
    await page.keyboard.press(`${MOD}+k`); await page.locator('#bw-palette-input').fill(words);
    await page.waitForFunction(settled, words);
  };
  // B's word is not found from A.
  await search('zeppelin', () => document.querySelector('#bw-palette-list')?.textContent.includes('Nothing matches'));
  assert.equal(await list.locator('.bw-palette-group', { hasText: 'In chats' }).count(), 0);
  await page.keyboard.press('Escape');

  await search('funicular', () => document.querySelector('#bw-palette-list')?.textContent.includes('In chats'));
  const hit = list.locator('[data-palette]', { hasText: 'Rain plan' });
  assert.equal(await hit.count(), 1);
  assert.equal(await hit.locator('mark').innerText(), 'funicular');
  assert.match(await hit.innerText(), /<img src=x onerror=/, 'chat HTML shows as text');
  assert.equal(await list.locator('img').count(), 0, 'no element made from chat text');
  assert.match(await hit.locator('small').innerText(), /Reply · side chat/);
  await page.screenshot({ path: path.join(shots, 'palette-hit.png') });
  await hit.click();

  await page.waitForFunction(() => window.__barkdown.state.current === 'rain');
  const view = await page.evaluate(() => {
    const t = document.querySelector('#bw-transcript'), m = t.querySelector('[data-message="1"]'), r = t.getBoundingClientRect(), e = m.getBoundingClientRect();
    return { inView: e.top >= r.top && e.bottom <= r.bottom, found: m.classList.contains('bw-found'), notAtBottom: t.scrollHeight - t.scrollTop - t.clientHeight > 200, text: m.nextElementSibling?.textContent || '' };
  });
  assert.ok(view.inView, 'the reply is in view'); assert.ok(view.found, 'the reply is highlighted'); assert.ok(view.notAtBottom, 'the transcript scrolled to it, not to the end');
  assert.match(view.text, /funicular/);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  await page.screenshot({ path: path.join(shots, 'message-found.png') });
  await page.waitForFunction(() => !document.querySelector('#bw-transcript .bw-found'), null, { timeout: 5000 });

  // In B, B's chat is found and A's is not.
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, b);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b);
  await search('funicular', () => document.querySelector('#bw-palette-list')?.textContent.includes('Nothing matches'));
  await page.keyboard.press('Escape');
  await search('zeppelin', () => document.querySelector('#bw-palette-list')?.textContent.includes('In chats'));
  assert.equal(await list.locator('[data-palette]', { hasText: 'Profile B only' }).count(), 2);
  assert.deepEqual(errors, []);
  console.log('Chat search passed: side-chat reply found and opened in view with a highlight, HTML kept as text, each profile finds only its own chats.');
} finally { await app.close(); }
