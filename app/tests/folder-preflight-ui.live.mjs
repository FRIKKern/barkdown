// Actual ordinary main + side composers and IPC; no transport substitution.
// Run only with a named serialized UI grant. No provider should launch.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-folder-refusal-'));
const out = process.env.C032_OUT || path.join(root, 'evidence'); fs.mkdirSync(out, { recursive: true });
const userData = path.join(root, 'user'), missing = path.join(root, 'Selected missing folder');
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), root, frames: [], passed: false, stopped: false };
let app, page; const errors = [];
const launch = async () => { app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } }); page = await app.firstWindow(); page.on('pageerror', e => errors.push(e.message)); await page.waitForFunction(() => window.__barkdown?.state.loaded); await page.setViewportSize({ width: 1600, height: 1000 }); };
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); };
try {
  await launch();
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
  const before = await page.evaluate(() => window.barkdown.state.load()); report.before = before;
  assert.equal(Object.keys(before.ownership.attempts).length, 0);
  for (const id of [parent, child]) { assert.equal(before.chats[id].messages.length, 0); assert.equal(before.chats[id].folder, missing); }
  assert.equal(before.chats[child].parent, parent); assert.equal(fs.existsSync(missing), false);
  await app.close(); app = null; await launch();
  const after = await page.evaluate(() => window.barkdown.state.load()); report.after = after;
  assert.equal(after.chats[parent].draft, 'Keep this main-chat prompt'); assert.equal(after.chats[child].draft, 'Keep this side-chat prompt'); assert.equal(after.chats[child].parent, parent);
  assert.equal(Object.keys(after.ownership.attempts).length, 0); assert.equal(after.chats[parent].folder, missing); assert.equal(after.chats[child].folder, missing);
  await shot('03-restart-retained-drafts'); assert.deepEqual(errors, []); report.passed = true;
} catch (error) { report.error = error.stack; if (page) await shot('failure').catch(() => {}); throw error; }
finally { try { if (app) await app.close(); report.stopped = true; } finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ out, passed: report.passed, stopped: report.stopped })); } }
