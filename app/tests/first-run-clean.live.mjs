// First run on a Mac without developer tools, Claude Code, Codex or an API key (task-4b558e0033861d75).
// The newest nightly (BARKDOWN_TEST_DMG) is installed from its image and started with an empty home and only
// system folders on the PATH. The workflow has moved Xcode and the Command Line Tools aside first, so anything
// that runs /usr/bin/git (or another developer-tools shim) opens the system's "install the command line developer
// tools" window. Expected: the toast names what is missing and offers one step, that step opens Settings at
// Providers with an Install link and the sign-in command, and no such system window appears.
// Moving Xcode aside belongs to a disposable runner: this refuses to run unless CI=true or BARKDOWN_TEST_DISPOSABLE_MAC=1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') throw new Error('The clean first run is for macOS');
if (process.env.CI !== 'true' && process.env.BARKDOWN_TEST_DISPOSABLE_MAC !== '1') throw new Error('Run this on a disposable Mac whose developer tools were moved aside (CI=true or BARKDOWN_TEST_DISPOSABLE_MAC=1)');
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const dmg = path.resolve(process.env.BARKDOWN_TEST_DMG || '');
if (!process.env.BARKDOWN_TEST_DMG || !fs.existsSync(dmg)) throw new Error('BARKDOWN_TEST_DMG names the nightly image to install');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-first-run-clean');
fs.mkdirSync(out, { recursive: true });
// The commit from the runner, not from git: with the tools moved aside, /usr/bin/git would open the very window this looks for.
const report = { source: process.env.GITHUB_SHA || null, host: `${process.platform} ${os.release()} ${process.arch}`, image: path.basename(dmg), checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-clean-'));
const mountpoint = path.join(root, 'image'), applications = path.join(root, 'Applications'), home = path.join(root, 'home'), userData = path.join(root, 'user-data');
for (const dir of [applications, home, userData]) fs.mkdirSync(dir);
// The window macOS opens when a developer-tools shim runs without the tools.
const installerWindows = () => spawnSync('pgrep', ['-fl', 'Install Command Line Developer Tools'], { encoding: 'utf8' }).stdout.trim();
let app, mounted = false;
try {
  // The developer tools are really gone: the active developer folder does not exist.
  const developer = spawnSync('xcode-select', ['-p'], { encoding: 'utf8' }).stdout.trim();
  assert.ok(!developer || !fs.existsSync(developer), `the developer tools were moved aside (xcode-select -p: ${developer})`);
  assert.equal(installerWindows(), '', 'no installer window before the run');
  report.checks.push({ name: 'No developer tools: the active developer folder is missing', developer }); persist();
  execFileSync('hdiutil', ['attach', dmg, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountpoint], { stdio: 'ignore' }); mounted = true;
  execFileSync('cp', ['-R', path.join(mountpoint, 'Barkdown.app'), applications], { stdio: 'ignore' });
  execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); mounted = false;
  const installed = path.join(applications, 'Barkdown.app');
  report.version = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(installed, 'Contents', 'Info.plist')], { encoding: 'utf8' }).trim();
  // An empty home: no ~/.claude, no ~/.codex, no shell profile. The mock keychain: one launch, nothing to keep.
  const env = { HOME: home, USER: process.env.USER, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: process.env.TMPDIR, BARKDOWN_MOCK_KEYCHAIN: '1' };
  app = await electron.launch({ executablePath: path.join(installed, 'Contents', 'MacOS', 'Barkdown'), args: ['--profiles', `--user-data=${userData}`, '--app-name=Barkdown Clean First Run'], env });
  const page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const providers = await page.evaluate(() => window.__barkdown.state.settings.providers);
  assert.equal(providers.claude.loggedIn, false); assert.equal(providers.codex.loggedIn, false); assert.equal(providers.api.hasKey, false);
  const toast = page.locator('.bw-toast', { hasText: 'No assistant is set up yet' });
  await toast.waitFor({ timeout: 30000 });
  report.toast = (await toast.innerText()).trim();
  await page.screenshot({ path: path.join(out, '01-first-run.png') });
  report.checks.push({ name: `${report.version} starts with no assistant and says so, with one step offered`, toast: report.toast }); persist();
  await toast.getByRole('button', { name: 'Set up an assistant' }).click();
  await page.locator('section[data-pane="assistant"]:not([hidden])').waitFor();
  for (const [name, login] of [['claude', 'claude auth login'], ['codex', 'codex login']]) {
    const tool = page.locator(`[data-tool-status="${name}"]`);
    await tool.filter({ hasText: 'not found' }).waitFor({ timeout: 30000 });
    const text = await tool.innerText();
    assert.match(text, new RegExp(`Install, then run ${login}`), text);
    assert.ok(await tool.locator('a', { hasText: 'Install' }).count(), `${name} offers its Install link`);
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(out, '02-settings-providers.png') });
  report.checks.push({ name: 'Set up an assistant opens Settings at Providers: each missing tool shows its Install link and sign-in command' }); persist();
  // Give anything that would reach for git a moment longer, then look for the system's window.
  await page.waitForTimeout(10000);
  assert.equal(installerWindows(), '', 'no "Install Command Line Developer Tools" window appeared');
  report.checks.push({ name: 'No "Install Command Line Developer Tools" window appeared during the first run' }); persist();
  report.status = 'passed';
  report.limits = ['A hosted GitHub runner with Xcode and the Command Line Tools moved aside, an empty home and a system-only PATH, not a newly set up Mac. The first run without a working folder; opening a code review in a folder runs git, and macOS then offers its tools.'];
  persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.error = String(error?.stack || error); report.installerWindows = installerWindows(); persist(); console.error(report.error); process.exitCode = 1; }
finally {
  if (app) await app.close().catch(() => {});
  if (mounted) try { execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); } catch {}
  fs.rmSync(root, { recursive: true, force: true });
}
