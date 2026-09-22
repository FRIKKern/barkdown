// Explicit serialized UI grant required. No Paper/Barkpark runtime is needed.
// Optional C029_NATIVE_PROVIDERS=claude,codex exercises installed real CLIs.
// SDK routing tests are separate; this fixture never replaces provider transports.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-missing-reference-'));
const userData = path.join(root, 'user'), folderA = path.join(root, 'A'), folderB = path.join(root, 'missing-B');
const out = process.env.C029_OUT || path.join(root, 'evidence'); fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(folderA); fs.writeFileSync(path.join(folderA, 'same.txt'), 'A private reference');
const providers = (process.env.C029_NATIVE_PROVIDERS || '').split(',').filter(Boolean);
assert(providers.every(p => ['claude', 'codex'].includes(p)), 'Only explicit native provider names are supported');
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), root, providers, results: [], frames: [], passed: false, stopped: false };
let app, page; const pageErrors = [];
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow(); page.on('pageerror', e => pageErrors.push(e.message)); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1400, height: 900 });
}
async function shot(name) { await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); }
try {
  await launch();
  const seed = async (folder, title, draft) => page.evaluate(async ({ folder, title, draft }) => {
    const ui = window.__barkdown, api = window.barkdown;
    const chat = ui.createChat({ folder, title }); chat.draft = draft; chat.provider = 'codex'; ui.render();
    const ws = await api.state.load(); Object.assign(ws, { chats: ui.state.chats, order: ui.state.order, current: chat.id, mode: 'chat' });
    await api.state.save(ws); return { profileId: (await api.profiles.status()).profileId, chatId: chat.id };
  }, { folder, title, draft });
  const first = await seed(folderA, 'A existing folder', 'A draft'), a = first.profileId;
  const b = await page.evaluate(async () => { const created = await window.barkdown.profiles.create('B missing reference'); return created.id || created.profileId; });
  assert(b, 'created profile identity must be explicit');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, b);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b);
  const second = await seed(folderB, 'B unavailable folder', 'B retained draft'), bChat = second.chatId;
  const visible = await page.evaluate(() => { const s = window.__barkdown.state; return { current: s.current, folder: s.chats[s.current].folder, draft: document.querySelector('#bw-prompt').value }; });
  assert.deepEqual(visible, { current: bChat, folder: folderB, draft: 'B retained draft' });
  assert.deepEqual(pageErrors, []);
  await app.close(); app = null; await launch();
  const state = await page.evaluate(async () => ({ profile: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load() }));
  assert.equal(state.profile.profileId, b); assert.equal(state.ws.current, bChat); assert.equal(state.ws.chats[bChat].folder, folderB); assert.equal(state.ws.chats[bChat].draft, 'B retained draft');
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'project', path: 'same.txt' }));
  await page.getByText('This file or its working folder is no longer available.', { exact: true }).waitFor();
  assert.equal(await page.locator('.bw-pane:not([hidden]) .cm-content').count(), 0);
  await shot('01-selected-B-unavailable-after-restart');
  report.results.push({ name: 'selected B restart preserves exact unavailable folder and draft; same-path A content is not substituted', passed: true });
  for (const provider of providers) {
    const prompt = `C029 ${provider}: identify only the selected working folder. Do not run tools or change files.`;
    await page.evaluate(async provider => {
      const s = window.__barkdown.state, chat = s.chats[s.current];
      chat.provider = provider; chat.sessions = {}; chat.draft = ''; window.__barkdown.render();
      const ws = await window.barkdown.state.load(); ws.chats[chat.id].provider = provider; await window.barkdown.state.save(ws);
    }, provider);
    await page.locator('#bw-prompt').fill(prompt); await page.locator('#bw-prompt').press('Enter');
    await page.waitForFunction(prompt => {
      const s = window.__barkdown.state, c = s.chats[s.current];
      return c.messages.some(m => m.role === 'user' && m.text === prompt) && !c.runId && !c.messages.at(-1)?.streaming;
    }, prompt, { timeout: 90000 });
    const observed = await page.evaluate(async () => {
      const ws = await window.barkdown.state.load(); return { chat: ws.chats[ws.current], attempts: ws.ownership?.attempts || {} };
    });
    report.results.push({ name: provider + ' actual native missing-folder attempt', observed });
    assert.equal(observed.chat.folder, folderB);
    assert(observed.chat.messages.some(m => m.role === 'user' && m.text === prompt), 'acknowledged user text must remain readable');
    const reply = observed.chat.messages.at(-1);
    assert(reply.error, 'Missing native cwd must fail explicitly; retain unexpected success as an investigation');
    assert(!reply.text?.includes(folderA), 'must not answer from A');
    await shot('02-' + provider + '-native-failure');
  }
  assert.equal(fs.existsSync(folderB), false); assert.equal(fs.readFileSync(path.join(folderA, 'same.txt'), 'utf8'), 'A private reference');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, a);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, a);
  assert.equal(await page.evaluate(id => window.__barkdown.state.chats[id].draft, first.chatId), 'A draft');
  assert.deepEqual(pageErrors, []); report.passed = true;
} catch (error) { report.error = error.stack; if (page) await shot('failure').catch(() => {}); throw error; }
finally {
  try { if (app) await app.close(); report.stopped = true; }
  finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ out, passed: report.passed, stopped: report.stopped })); }
}
