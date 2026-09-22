// Actual ordinary main + side composers and IPC; no transport substitution.
// Run only with a named serialized UI grant. No provider should launch.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url), root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-folder-refusal-'));
const out = process.env.C032_OUT || path.join(root, 'evidence'); fs.mkdirSync(out, { recursive: true }); assert.equal(fs.readdirSync(out).length, 0, 'Use a fresh evidence directory; never replace a prior run');
const userData = path.join(root, 'user'), missing = path.join(root, 'Selected missing folder');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const repo = git(['rev-parse', '--show-toplevel']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceFiles = git(['-C', repo, 'ls-files', 'app/main', 'app/renderer', 'app/shared', 'app/package.json', 'app/package-lock.json', 'app/tests/folder-preflight-ui.live.mjs']).split('\n').filter(Boolean);
const source = { commit: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['-C', repo, 'status', '--porcelain'])),
  files: Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(repo, file)))])) };
const report = { source: source.commit, root, userData, missing, frames: [], videos: [], processes: [], passed: false, stopped: false };
let app, page; const errors = [];
let phase, video, processRecord;
const launch = async name => { phase = name; app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], recordVideo: { dir: path.join(root, 'raw-video', name), size: { width: 1600, height: 1000 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  processRecord = { phase, pid: app.process().pid, stopped: false }; report.processes.push(processRecord);
  page = await app.firstWindow(); video = page.video(); page.on('pageerror', e => errors.push(e.message)); await page.waitForFunction(() => window.__barkdown?.state.loaded); await page.setViewportSize({ width: 1600, height: 1000 }); };
const close = async () => { if (!app) return; const proc = app.process(); await app.close(); app = null; processRecord.exitCode = proc.exitCode; processRecord.signalCode = proc.signalCode; processRecord.stopped = proc.exitCode !== null || proc.signalCode !== null;
  assert.equal(processRecord.stopped, true, 'Owned Electron must exit');
  if (video) { const file = `${phase}.webm`; await video.saveAs(path.join(out, file)); report.videos.push(file); video = null; } };
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); };
const retainState = (name, state) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(state, null, 2) + '\n');
const visibleState = () => page.evaluate(() => { const s = window.__barkdown.state; return { current: s.current, chats: Object.fromEntries(Object.entries(s.chats).map(([id, c]) => [id, { draft: c.draft, folder: c.folder, provider: c.provider, parent: c.parent, errors: c.messages.filter(m => m.error).map(m => m.error) }])) }; });
try {
  assert.equal(source.dirty, false, 'Commit capture source before launching Electron');
  await launch('01-refusal-session');
  const parent = await page.evaluate(folder => {
    const ui = window.__barkdown, c = ui.createChat({ title: 'Main unavailable folder', folder }); c.provider = 'claude'; ui.render(); return c.id;
  }, missing);
  await page.locator('#bw-prompt').fill('Keep this main-chat prompt'); await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.at(-1)?.error?.includes('Selected working folder'), parent);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'Keep this main-chat prompt'); await shot('01-main-refusal');
  await page.locator('#bw-open-work').click(); await page.locator('[data-new="chat"]').click();
  const side = page.locator('.bw-side-chat'); await side.waitFor();
  const child = await page.evaluate(() => { const s = window.__barkdown.state, c = s.chats[s.current]; return c.tabs.find(t => t.id === c.active).sideChatId; });
  await side.locator('[data-composer="provider"]').click(); await page.locator('.bw-menu:not([hidden]) [data-choice="codex"]').click();
  await side.locator('textarea').fill('Keep this side-chat prompt'); await side.locator('textarea').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.at(-1)?.error?.includes('Selected working folder'), child);
  assert.equal(await side.locator('textarea').inputValue(), 'Keep this side-chat prompt'); assert.equal(await page.locator('#bw-prompt').inputValue(), 'Keep this main-chat prompt');
  await shot('02-side-refusal');
  // Await the ordinary debounced save by observing actual main-owned state.
  await page.waitForFunction(async ({ parent, child }) => { const ws = await window.barkdown.state.load(); return ws.chats[parent]?.draft === 'Keep this main-chat prompt' && ws.chats[child]?.draft === 'Keep this side-chat prompt'; }, { parent, child });
  const before = await page.evaluate(() => window.barkdown.state.load()); retainState('before-restart', before); retainState('before-restart-visible', await visibleState()); report.chatIds = { parent, child };
  assert.equal(Object.keys(before.ownership.attempts).length, 0);
  for (const id of [parent, child]) { assert.equal(before.chats[id].messages.length, 0); assert.equal(before.chats[id].folder, missing); }
  assert.equal(before.chats[child].parent, parent); assert.equal(fs.existsSync(missing), false);
  assert.equal(before.chats[parent].provider, 'claude'); assert.equal(before.chats[child].provider, 'codex');
  await close(); await launch('02-restart-session');
  const after = await page.evaluate(() => window.barkdown.state.load()); retainState('after-restart', after); retainState('after-restart-visible', await visibleState());
  assert.equal(after.chats[parent].draft, 'Keep this main-chat prompt'); assert.equal(after.chats[child].draft, 'Keep this side-chat prompt'); assert.equal(after.chats[child].parent, parent);
  assert.equal(Object.keys(after.ownership.attempts).length, 0); assert.equal(after.chats[parent].folder, missing); assert.equal(after.chats[child].folder, missing);
  assert.equal(after.chats[parent].provider, 'claude'); assert.equal(after.chats[child].provider, 'codex');
  assert.equal(after.chats[parent].messages.length, 0); assert.equal(after.chats[child].messages.length, 0);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'Keep this main-chat prompt');
  assert.equal(await page.locator('.bw-side-chat textarea').inputValue(), 'Keep this side-chat prompt');
  await shot('03-restart-retained-drafts'); assert.deepEqual(errors, []); report.passed = true;
} catch (error) { report.error = error.stack; if (page) await shot('failure').catch(() => {}); throw error; }
finally { try { await close(); report.stopped = report.processes.every(p => p.stopped); } finally {
  report.pageErrors = errors; retainState('report', report);
  const artifacts = Object.fromEntries(fs.readdirSync(out).filter(file => file !== 'manifest.json' && fs.statSync(path.join(out, file)).isFile()).map(file => { const bytes = fs.readFileSync(path.join(out, file)); return [file, { bytes: bytes.length, sha256: sha(bytes) }]; }));
  retainState('manifest', { version: 1, capturedAt: new Date().toISOString(), source, environment: { platform: process.platform, release: os.release(), arch: process.arch, electron: require('electron/package.json').version, viewport: { width: 1600, height: 1000 } }, capture: { stills: report.frames, videos: report.videos, motion: 'actual Playwright video; no reduced-motion override', transport: 'actual Electron IPC; no provider or transport substitution' }, artifacts, passed: report.passed, stopped: report.stopped, limits: 'Known missing ordinary Claude/Codex folder only. No provider launched; no API, stat-denied, post-check removal or combined-source acceptance claim.' });
  console.log(JSON.stringify({ out, passed: report.passed, stopped: report.stopped }));
} }
