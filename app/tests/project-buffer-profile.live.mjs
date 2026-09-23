// Disposable actual Settings/CodeMirror journey. Requires a coordinated input window.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-project-buffer-'));
const userData = path.join(root, 'user-data'), folder = path.join(root, 'shared-folder');
fs.mkdirSync(folder); const file = path.join(folder, 'note.md');
const original = '# Saved on disk\n', edited = '# Human edit must survive switching';
fs.writeFileSync(file, original);
const out = process.env.BARKDOWN_BUFFER_OUT || path.join(root, 'evidence'); fs.mkdirSync(out, { recursive: true });
const report = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), root, frames: [], passed: false, stopped: false };
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.frames.push(name + '.png'); };
const loaded = id => page.waitForFunction(id => window.__barkdown?.state.loaded && (!id || window.__barkdown.state.profileId === id), id);
const openFile = async () => {
  await page.evaluate(folder => { window.__barkdown.setFolder(folder); window.__barkdown.openTarget({ kind: 'project', path: 'note.md' }); }, folder);
  await page.locator('.bw-pane:not([hidden]) .cm-content').waitFor();
};
try {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow(); await loaded();
  const a = await page.evaluate(() => window.__barkdown.state.profileId);
  const b = await page.evaluate(() => window.barkdown.profiles.create('Buffer B'));
  await openFile();
  const editor = page.locator('.bw-pane:not([hidden]) .cm-content');
  await editor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(edited);
  await page.locator('.bw-dot-dirty').waitFor(); await shot('01-unsaved-project');
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(b.id); await page.locator('#profile-switch').click();
  await page.getByText('Save your project files before switching profiles.', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.barkdown.profiles.status())).profileId, a);
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'switch refusal must not autosave');
  await shot('02-switch-refused'); await page.keyboard.press('Escape');
  assert.equal(await editor.innerText(), edited, 'unsaved editor text remains intact');
  assert.equal(await page.locator('.bw-dot-dirty').count(), 1);
  await editor.click(); await page.keyboard.press('Control+s');
  await page.waitForFunction(() => !document.querySelector('.bw-dot-dirty'));
  assert.equal(fs.readFileSync(file, 'utf8'), edited, 'only explicit Save writes bytes');
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(b.id); await page.locator('#profile-switch').click(); await loaded(b.id);
  await openFile(); assert.equal(await page.locator('.bw-pane:not([hidden]) .cm-content').innerText(), edited);
  assert.equal(await page.locator('.bw-dot-dirty').count(), 0); await shot('03-explicit-save-then-B');
  report.passed = true;
  console.log('PASS actual dirty project blocks Settings profile switch, preserves unsaved text/disk/profile, and explicit Save allows B');
} catch (error) { report.error = error.stack; if (page && !page.isClosed()) await shot('failure').catch(() => {}); throw error; }
finally {
  if (app) await app.close(); report.stopped = true;
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2)); console.log('Evidence:', out);
}
