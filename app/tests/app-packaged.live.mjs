// The built macOS application with its runtime inside (P5 groundwork). Barkdown.app is started
// as an application, not from source, with only system folders on the PATH and a fresh user
// data folder holding one profile that has never been configured, and Homebrew and /usr/local hidden
// from every process it starts (a clean Mac has neither; a library linked from there is how a runtime
// built here stops working elsewhere). Shown: the profile runs on
// the runtime the application carries, a note is written, and it reads the same after a restart.
// Needs the application built by scripts/build-mac-app.mjs (app/release/mac-<arch>/Barkdown.app).
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { LINE_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createRuntimeRecord } = require('../main/runtime-orphan');
const bundle = path.resolve(process.env.BARKDOWN_TEST_APP || path.join(appRoot, 'release', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Barkdown.app'));
const executable = path.join(bundle, 'Contents', 'MacOS', 'Barkdown'), carried = path.join(bundle, 'Contents', 'Resources', 'runtime');
if (!fs.existsSync(executable) || !fs.existsSync(path.join(carried, 'barkdown-release.json'))) throw new Error('Build the application first: node scripts/build-mac-app.mjs');
const stamp = JSON.parse(fs.readFileSync(path.join(carried, 'barkdown-release.json'), 'utf8'));
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-app-packaged');
fs.mkdirSync(out, { recursive: true });
// A caller may hand in the user-data folder and ask to keep the keychain item, so a later launch of a
// reinstalled application can open the same library (the disk-image rehearsal does).
const userData = process.env.BARKDOWN_TEST_USER_DATA ? fs.realpathSync(process.env.BARKDOWN_TEST_USER_DATA) : fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-app-')));
const keepSecrets = process.env.BARKDOWN_TEST_KEEP === '1';
const bytes = dir => Number(execFileSync('du', ['-sk', dir], { encoding: 'utf8' }).split(/\s+/)[0]) * 1024;
const report = { source: host, upstream: stamp.upstream, application: { megabytes: Math.round(bytes(bundle) / 1e6), runtimeMegabytes: Math.round(bytes(carried) / 1e6) }, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], screenshots: [],
  limits: ['One Mac, one run. The application was built on this machine from the working tree named in `source`, signed ad hoc, not notarized, and started from its build folder, not installed, under a name of its own so its keychain item is its own. It is started with --profiles; an ordinary launch still opens the single legacy library. No Mac without developer tools has run it.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
registry.selectProfile(profile.id);
const dataDir = path.join(dir, 'local-barkpark', 'runtime'), record = createRuntimeRecord({ dataDir, log: () => {} });
// The rehearsal's own name: its keychain item is created by this build and removed at the end.
// (An ad hoc signed build has a new identity each time, and macOS asks before it reads an item another build made.)
const rehearsalName = 'Barkdown Rehearsal ' + path.basename(userData).slice(-6);
const forgetKeychain = () => { try { execFileSync('security', ['delete-generic-password', '-s', rehearsalName + ' Safe Storage'], { stdio: 'ignore' }); } catch {} };
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
// sandbox-exec takes the place of the executable, so Playwright's own arguments still reach the app.
// Chromium cannot start its own sandbox inside another one: the app runs with --no-sandbox here.
const hiddenHost = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-clean-')), 'Barkdown');
fs.writeFileSync(hiddenHost, `#!/bin/sh\nexec /usr/bin/sandbox-exec -p '(version 1)(allow default)(deny file-read* (subpath "/opt/homebrew") (subpath "/usr/local"))' "${executable}" "$@"\n`, { mode: 0o755 });
process.on('exit', () => fs.rmSync(path.dirname(hiddenHost), { recursive: true, force: true }));
let app, page, stderr = [];
const launch = async () => {
  stderr = [];
  const env = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' }; delete env.BARKDOWN_CARRIED_RUNTIME;
  app = await electron.launch({ executablePath: hiddenHost, args: ['--no-sandbox', '--profiles', `--user-data=${userData}`, `--app-name=${rehearsalName}`], env });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
};
const runtimeReady = async () => { const started = Date.now(); for (;;) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') return; if (s.phase === 'failed') throw new Error('Profile runtime failed: ' + s.error); if (Date.now() - started > 300000) throw new Error('Profile runtime not ready: ' + JSON.stringify(s)); await new Promise(resolve => setTimeout(resolve, 500)); } };
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
const paperSaved = () => page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges(); }, null, { timeout: 60000 });
const commandOf = pid => execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim();
try {
  const started = Date.now();
  await launch(); await runtimeReady();
  const firstBootMs = Date.now() - started;
  const facts = await app.evaluate(({ app: electronApp }) => ({ packaged: electronApp.isPackaged, resources: process.resourcesPath, path: process.env.PATH }));
  assert.equal(facts.packaged, true, 'this is the built application'); assert.equal(fs.realpathSync(facts.resources), fs.realpathSync(path.join(bundle, 'Contents', 'Resources')));
  const running = record.read();
  assert.ok(commandOf(running.pid).includes(carried), 'the runtime is the one the application carries');
  const postmaster = Number(fs.readFileSync(path.join(dataDir, 'pgdata', 'postmaster.pid'), 'utf8').split('\n')[0]);
  assert.ok(commandOf(postmaster).startsWith(path.join(carried, 'postgres', 'bin') + path.sep), 'the database server is the one the application carries');
  assert.equal(fs.existsSync(path.join(dir, 'settings.json')) && JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).barkpark !== undefined, false, 'the profile was never configured');
  report.checks.push({ name: 'The built application starts a never-configured profile on the runtime and the Postgres it carries, with only system folders on the PATH', firstBootMs }); persist();
  // C088 S4: the application carries no agent tool of its own, and is about half the size it was.
  const resources = path.join(bundle, 'Contents', 'Resources');
  const unpacked = path.join(resources, 'app.asar.unpacked', 'node_modules');
  for (const name of ['@openai/codex-darwin-arm64', '@anthropic-ai/claude-agent-sdk-darwin-arm64']) assert.equal(fs.existsSync(path.join(unpacked, name)), false, name + ' is not unpacked in the application');
  const listed = require('@electron/asar').listPackage(path.join(resources, 'app.asar'));
  const carriedTools = listed.filter(entry => /node_modules\/@(?:openai\/codex-(?:darwin|linux|win32)-|anthropic-ai\/claude-agent-sdk-(?:darwin|linux|win32))/.test(entry));
  assert.deepEqual(carriedTools.slice(0, 3), [], 'no agent platform package inside the application');
  const sizeMb = Math.round(Number(execFileSync('du', ['-sk', bundle], { encoding: 'utf8' }).split('\t')[0]) / 1024);
  assert.ok(sizeMb < 650, `the application is ${sizeMb} MB, under 650`);
  report.sizeMb = sizeMb;
  report.checks.push({ name: 'The application carries no Claude Code or Codex of its own and is under 650 MB', sizeMb }); persist();

  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click({ timeout: 60000 });
  await page.keyboard.type('From the application'); await paperSaved();
  await page.keyboard.press(LINE_END); await page.keyboard.press('Enter');
  await page.keyboard.type('Rhubarb notes written in the built application.'); await paperSaved();
  const papers = await page.evaluate(() => window.barkdown.barkpark.list());
  const note = papers.find(p => p.title === 'From the application');
  assert.ok(note, 'New page made a Paper, not a legacy document: ' + JSON.stringify(papers.map(p => p.title)));
  assert.equal((await page.evaluate(() => window.barkdown.docs.list())).length, 0, 'no legacy document was created');
  await page.screenshot({ path: path.join(out, '01-note-in-the-built-application.png') }); report.screenshots.push('01-note-in-the-built-application.png');
  report.checks.push({ name: 'New page in the built application is a Paper on the carried runtime; typed and saved' }); persist();

  await quit();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(record.read(), null); assert.equal(alive(running.pid), false, 'a clean quit leaves nothing running');
  await launch(); await runtimeReady();
  const read = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), { id: note.id, paperOwner: note.paperOwner });
  assert.equal(read.title, 'From the application'); assert.match(read.markdown, /Rhubarb notes written in the built application\./);
  report.checks.push({ name: 'After a quit and a restart of the application the note reads the same; nothing was left running in between' }); persist();
  await quit();
  if (!keepSecrets) forgetKeychain();
  report.note = { id: note.id, paperOwner: note.paperOwner, rehearsalName };
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').split('\n').filter(l => !/IMK/.test(l)).slice(-20);
  try { report.localStatus = await page.evaluate(() => window.barkdown.barkpark.localStatus()); } catch {}
  try { report.serverLog = fs.readFileSync(path.join(dataDir, 'server.log'), 'utf8').slice(-1200); } catch {}
  persist();
  try { if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, '99-failure.png') }); } catch {}
  try { await quit(); } catch {}
  forgetKeychain();
  let left = null; try { left = record.read(); } catch {}
  if (left?.pid && alive(left.pid)) { try { process.kill(-left.pid, 'SIGTERM'); } catch {} }
  try { execFileSync(path.join(carried, 'postgres', 'bin', 'pg_ctl'), ['-D', path.join(dataDir, 'pgdata'), '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {}
  throw error;
}
