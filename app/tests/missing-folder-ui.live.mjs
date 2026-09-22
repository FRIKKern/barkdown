// Explicit serialized UI grant required. No Paper/Barkpark runtime is needed.
// Claude/Codex missing folders now refuse before dispatch; original C029 SDK
// failure captures remain historical evidence, not current expected behavior.
// SDK routing tests are separate; this fixture never replaces provider transports.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-missing-reference-'));
const userData = path.join(root, 'user'), folderA = path.join(root, 'A'), folderB = path.join(root, 'missing-B');
const out = process.env.C029_OUT || path.join(root, 'evidence'); fs.mkdirSync(out, { recursive: true }); assert.equal(fs.readdirSync(out).length, 0, 'Use a fresh evidence directory; never replace a prior run');
fs.mkdirSync(folderA); fs.writeFileSync(path.join(folderA, 'same.txt'), 'A private reference');
const providers = (process.env.C029_NATIVE_PROVIDERS || 'claude,codex').split(',').filter(Boolean);
assert(providers.every(p => ['claude', 'codex'].includes(p)), 'Only explicit native provider names are supported');
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), root, providers, results: [], frames: [], passed: false, stopped: false };
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim(), repo = git(['rev-parse', '--show-toplevel']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const source = { commit: report.source, dirty: Boolean(git(['-C', repo, 'status', '--porcelain'])), files: Object.fromEntries(git(['-C', repo, 'ls-files', 'app/main', 'app/renderer', 'app/shared', 'app/package.json', 'app/package-lock.json', 'app/tests/missing-folder-ui.live.mjs']).split('\n').filter(Boolean).map(file => [file, sha(fs.readFileSync(path.join(repo, file)))])) };
const retain = (name, value) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
report.videos = []; report.processes = []; let phase, video, processRecord;
let app, page; const pageErrors = [];
async function launch(name) {
  phase = name;
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], recordVideo: { dir: path.join(root, 'raw-video', name), size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  processRecord = { phase, pid: app.process().pid, stopped: false }; report.processes.push(processRecord);
  page = await app.firstWindow(); video = page.video(); page.on('pageerror', e => pageErrors.push(e.message)); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1400, height: 900 });
}
async function close() { if (!app) return; const proc = app.process(); await app.close(); app = null; processRecord.exitCode = proc.exitCode; processRecord.signalCode = proc.signalCode; processRecord.stopped = proc.exitCode !== null || proc.signalCode !== null; assert.equal(processRecord.stopped, true); if (video) { const file = `${phase}.webm`; await video.saveAs(path.join(out, file)); report.videos.push(file); video = null; } }
async function shot(name) { await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); }
try {
  assert.equal(source.dirty, false, 'Commit capture source before launching Electron');
  await launch('01-selected-B-session');
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
  retain('before-restart', await page.evaluate(async () => ({ profile: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load() })));
  await close(); await launch('02-restart-refusal-session');
  const state = await page.evaluate(async () => ({ profile: await window.barkdown.profiles.status(), ws: await window.barkdown.state.load() }));
  retain('after-restart', state);
  assert.equal(state.profile.profileId, b); assert.equal(state.ws.current, bChat); assert.equal(state.ws.chats[bChat].folder, folderB); assert.equal(state.ws.chats[bChat].draft, 'B retained draft');
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'project', path: 'same.txt' }));
  await page.getByText('This file or its working folder is no longer available.', { exact: true }).waitFor();
  assert.equal(await page.locator('.bw-pane:not([hidden]) .cm-content').count(), 0);
  await shot('01-selected-B-unavailable-after-restart');
  report.results.push({ name: 'selected B restart preserves exact unavailable folder and draft; same-path A content is not substituted', passed: true });
  for (const provider of providers) {
    const prompt = `Keep this ${provider} prompt for the selected missing folder.`;
    await page.evaluate(async provider => {
      const s = window.__barkdown.state, chat = s.chats[s.current];
      chat.provider = provider; chat.sessions = {}; chat.draft = ''; window.__barkdown.render();
      const ws = await window.barkdown.state.load(); ws.chats[chat.id].provider = provider; await window.barkdown.state.save(ws);
    }, provider);
    await page.locator('#bw-prompt').fill(prompt); await page.locator('#bw-prompt').press('Enter');
    await page.waitForFunction(prompt => {
      const s = window.__barkdown.state, c = s.chats[s.current];
      return c.messages.some(m => m.role === 'user' && m.text === prompt) && !c.runId && c.messages.at(-1)?.error?.includes('Selected working folder');
    }, prompt, { timeout: 90000 });
    assert.equal(await page.locator('#bw-prompt').inputValue(), prompt);
    await page.waitForFunction(async prompt => { const ws = await window.barkdown.state.load(); return ws.chats[ws.current].draft === prompt; }, prompt);
    const observed = await page.evaluate(async () => {
      const ws = await window.barkdown.state.load(); return { chat: ws.chats[ws.current], attempts: ws.ownership?.attempts || {}, visibleError: window.__barkdown.state.chats[ws.current].messages.at(-1)?.error };
    });
    report.results.push({ name: provider + ' actual IPC refusal before reservation', observed });
    assert.equal(observed.chat.folder, folderB);
    assert.equal(observed.chat.draft, prompt); assert.equal(observed.chat.messages.length, 0);
    assert.equal(Object.keys(observed.attempts).length, 0); assert.match(observed.visibleError, /Selected working folder/);
    retain(provider + '-refusal', observed);
    await shot('02-' + provider + '-predispatch-refusal');
  }
  assert.equal(fs.existsSync(folderB), false); assert.equal(fs.readFileSync(path.join(folderA, 'same.txt'), 'utf8'), 'A private reference');
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, a);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, a);
  assert.equal(await page.evaluate(id => window.__barkdown.state.chats[id].draft, first.chatId), 'A draft');
  assert.deepEqual(pageErrors, []); report.passed = true;
} catch (error) { report.error = error.stack; if (page) await shot('failure').catch(() => {}); throw error; }
finally {
  try { await close(); report.stopped = report.processes.every(p => p.stopped); }
  finally { report.pageErrors = pageErrors; retain('report', report);
    const artifacts = Object.fromEntries(fs.readdirSync(out).filter(file => file !== 'manifest.json' && fs.statSync(path.join(out, file)).isFile()).map(file => { const bytes = fs.readFileSync(path.join(out, file)); return [file, { bytes: bytes.length, sha256: sha(bytes) }]; }));
    retain('manifest', { version: 1, capturedAt: new Date().toISOString(), source, environment: { platform: process.platform, release: os.release(), arch: process.arch, electron: require('electron/package.json').version, viewport: { width: 1400, height: 900 } }, capture: { stills: report.frames, videos: report.videos, motion: 'actual Playwright video; no reduced-motion override', transport: 'actual Electron IPC; no provider substitution or dispatch' }, artifacts, passed: report.passed, stopped: report.stopped, limits: 'Selected B restart/missing reference/no A substitution and known missing ordinary CLI refusal. Original C029 SDK errors are historical; no post-stat removal race or combined-source proof.' });
    console.log(JSON.stringify({ out, passed: report.passed, stopped: report.stopped })); }
}
