// A signed nightly updates itself to the next one through its own updater, against the real GitHub feed
// (task-e586663a1087fe54). The previous nightly's image (BARKDOWN_TEST_DMG, downloaded from its release) is
// installed, writes a note (the packaged rehearsal), checks for an update, downloads the newer nightly's zip,
// takes the profile snapshot and installs it: Squirrel.Mac replaces the bundle and relaunches it. The installed
// copy must then be the newer version, open the same library with the note, and show the snapshot taken before.
//
// Squirrel relaunches the application without the test's arguments, so that launch opens the default profile of
// the Mac it runs on: this runs only on a disposable runner (CI=true) or with BARKDOWN_TEST_DISPOSABLE_MAC=1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') throw new Error('The signed update rehearsal is for macOS');
if (process.env.CI !== 'true' && process.env.BARKDOWN_TEST_DISPOSABLE_MAC !== '1') throw new Error('The installed update relaunches Barkdown on the default profile; run this on a disposable Mac (CI=true or BARKDOWN_TEST_DISPOSABLE_MAC=1)');
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const dmg = path.resolve(process.env.BARKDOWN_TEST_DMG || '');
if (!process.env.BARKDOWN_TEST_DMG || !fs.existsSync(dmg)) throw new Error('BARKDOWN_TEST_DMG names the previous signed nightly image');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-updates-signed');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, image: path.basename(dmg), checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-update-'));
const mountpoint = path.join(root, 'image'), applications = path.join(root, 'Applications'); fs.mkdirSync(applications);
const installed = path.join(applications, 'Barkdown.app'), executable = path.join(installed, 'Contents', 'MacOS', 'Barkdown');
const userData = path.join(root, 'user-data'); fs.mkdirSync(userData);
const versionOf = () => execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(installed, 'Contents', 'Info.plist')], { encoding: 'utf8' }).trim();
// Processes running the installed copy, by its full path inside this run's own temporary folder.
const running = () => spawnSync('pgrep', ['-f', executable], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let app, mounted = false, rehearsalName;
// What the application says about updating, installing and shutting down: the reason when an install stalls.
const said = [];
const launch = async () => {
  // The real keychain: the note's profile was sealed by the packaged rehearsal's launches.
  const env = { HOME: os.homedir(), USER: process.env.USER, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: process.env.TMPDIR, BARKDOWN_PROVIDER: 'api' };
  app = await electron.launch({ executablePath: executable, args: ['--profiles', `--user-data=${userData}`, `--app-name=${rehearsalName}`], env });
  app.process().stderr?.on('data', chunk => said.push(...String(chunk).split('\n').filter(l => /updat|squirrel|shipit|snapshot|export|prepar|quit|shutdown|error/i.test(l) && !/gl_|viz_|EGL/.test(l))));
  const page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await sleep(200); }
  // A quit before the restored note mounts is refused by the app; see app-dmg.live.mjs.
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'), null, { timeout: 60000 }).catch(() => {});
  return page;
};
try {
  execFileSync('hdiutil', ['attach', dmg, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountpoint], { stdio: 'ignore' }); mounted = true;
  execFileSync('cp', ['-R', path.join(mountpoint, 'Barkdown.app'), applications], { stdio: 'ignore' });
  execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); mounted = false;
  const from = versionOf(); report.from = from;
  assert.match(from, /-nightly\.\d{8}\.\d+$/, 'the installed copy is a nightly');
  const signature = spawnSync('codesign', ['-dv', '--verbose=2', installed], { encoding: 'utf8' }).stderr;
  assert.match(signature, /Authority=Developer ID Application/, 'the installed copy is signed with a Developer ID');
  report.checks.push({ name: `The previous nightly ${from}, signed with a Developer ID, is installed from its image` }); persist();
  // The note: the packaged rehearsal writes it into this user data and keeps the keychain item for the next launches.
  const rehearsal = spawnSync(process.execPath, [path.join(appRoot, 'tests', 'app-packaged.live.mjs')], { cwd: appRoot, env: { ...process.env, BARKDOWN_TEST_APP: installed, BARKDOWN_TEST_USER_DATA: userData, BARKDOWN_TEST_KEEP: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.writeFileSync(path.join(out, 'packaged-rehearsal.log'), rehearsal.stdout + rehearsal.stderr);
  assert.equal(rehearsal.status, 0, 'the packaged rehearsal passes against the installed previous nightly; see packaged-rehearsal.log');
  const latest = fs.readdirSync(path.resolve(appRoot, '../docs/cycles/evidence/C086/live')).filter(d => d.endsWith('-app-packaged')).sort().at(-1);
  const { note } = JSON.parse(fs.readFileSync(path.resolve(appRoot, '../docs/cycles/evidence/C086/live', latest, 'result.json'), 'utf8'));
  rehearsalName = note.rehearsalName; report.rehearsal = `evidence/C086/live/${latest}/result.json`;
  report.checks.push({ name: 'The previous nightly writes a note and reads it back after a restart (packaged rehearsal)', rehearsal: report.rehearsal }); persist();

  const launchedAt = Date.now();
  let page = await launch();
  // Versions before 29 October's fix turn a downloaded update back into "available" when the background check a
  // minute after launch runs (main/updates.js); the person then sees no Install button. Start after that check, as
  // someone opening Settings a little later would, so the rehearsal tests installing rather than that race.
  await sleep(Math.max(0, 75000 - (Date.now() - launchedAt)));
  const idle = await page.evaluate(() => window.barkdown.updates.status());
  assert.equal(idle.version, from); assert.equal(idle.channel, 'nightly'); assert.equal(idle.signed, true, 'the running copy knows it is signed: ' + JSON.stringify(idle));
  const found = await page.evaluate(() => window.barkdown.updates.check());
  assert.equal(found.phase, 'available', 'the GitHub feed offers a newer nightly: ' + JSON.stringify(found));
  const to = found.latest; report.to = to;
  if (process.env.BARKDOWN_UPDATE_TO) assert.equal('v' + to, process.env.BARKDOWN_UPDATE_TO, 'the feed offers the newest nightly');
  report.checks.push({ name: `The updater reads the nightly feed on GitHub and offers ${to}` }); persist();
  const got = await page.evaluate(() => window.barkdown.updates.download());
  assert.equal(got.phase, 'downloaded', JSON.stringify(got));
  report.checks.push({ name: `The ${process.arch} zip of ${to} is downloaded and its digest verified against the feed` }); persist();
  // Installing quits the application: Squirrel.Mac checks the new bundle's signature against this one, replaces it and relaunches.
  const closed = new Promise(resolve => app.once('close', resolve));
  // Installed the way a person does it, from Settings › About: that button prepares the profile (saves paused) before
  // the snapshot's export. Calling updates.install() directly skips the preparation, and the export refuses.
  await page.click('#bw-settings');
  await page.click('.bw-settings-nav button[data-pane="about"]');
  const install = page.locator('[data-act="update-install"]');
  await install.waitFor({ state: 'visible' });
  await install.click();
  const settings = () => page.locator('#about-updates').innerText({ timeout: 2000 }).catch(() => '');
  await Promise.race([closed, sleep(120000).then(async () => {
    const status = await page.evaluate(() => window.barkdown.updates.status()).catch(error => ({ unreadable: String(error.message) }));
    await page.screenshot({ path: path.join(out, '90-install-stalled.png') }).catch(() => {});
    report.stalled = { settings: await settings(), status, log: said.slice(-40) };
    throw new Error(`the application did not quit to install within 2 minutes; Settings says: ${report.stalled.settings}; status ${JSON.stringify(status)}`);
  })]);
  app = null;
  for (let i = 0; i < 150 && versionOf() !== to; i++) await sleep(2000);
  assert.equal(versionOf(), to, 'the installed bundle was replaced by the newer version');
  const after = spawnSync('codesign', ['--verify', '--deep', '--strict', installed], { encoding: 'utf8' });
  assert.equal(after.status, 0, 'the replaced bundle verifies: ' + after.stderr);
  report.checks.push({ name: `Squirrel.Mac replaced the installed bundle with ${to}; its signature verifies` }); persist();
  // The relaunch Squirrel started (without the test's arguments) is stopped; it is this run's own copy, found by its path.
  for (let i = 0; i < 30 && !running().length; i++) await sleep(1000);
  report.relaunched = running().length > 0;
  for (const pid of running()) try { process.kill(pid, 'SIGTERM'); } catch {}
  for (let i = 0; i < 60 && running().length; i++) await sleep(1000);
  for (const pid of running()) try { process.kill(pid, 'SIGKILL'); } catch {}

  page = await launch();
  const now = await page.evaluate(() => window.barkdown.updates.status());
  assert.equal(now.version, to, 'the running copy is the newer version');
  const read = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), note);
  assert.equal(read.title, 'From the application'); assert.match(read.markdown, /Rhubarb notes written in the built application\./);
  report.checks.push({ name: `${to} opens the same library and the note written by ${from} reads the same` }); persist();
  assert.ok(now.snapshot, 'the snapshot taken before the update is shown: ' + JSON.stringify(now));
  assert.equal(now.snapshot.from, from); assert.equal(now.snapshot.to, to);
  assert.ok(fs.existsSync(path.join(now.snapshot.folder, 'manifest.json')), 'the snapshot folder holds its manifest');
  report.snapshot = { from: now.snapshot.from, to: now.snapshot.to, folder: path.basename(now.snapshot.folder) };
  report.checks.push({ name: 'The profile snapshot taken before the install is recorded and shown after the restart' }); persist();
  await page.screenshot({ path: path.join(out, '01-updated.png') });
  report.status = 'passed';
  report.limits = ['A hosted GitHub runner, not a person\'s Mac: developer tools are installed and the screen is virtual. The relaunch Squirrel.Mac starts opens the default profile and is stopped; the checks run in a second launch on the rehearsal\'s own profile.'];
  persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error?.stack || error);
  // What the updater said, and Squirrel's installer (ShipIt) logs: why a bundle that quit to install was not replaced.
  report.log = said.slice(-40);
  const shipit = path.join(os.homedir(), 'Library', 'Caches', 'no.guerrilla.barkdown.ShipIt');
  for (const name of ['ShipIt_stderr.log', 'ShipIt_stdout.log']) { try { report[name] = fs.readFileSync(path.join(shipit, name), 'utf8').split('\n').filter(line => !/Unrecognized attribute string/.test(line)).slice(0, 400); } catch {} }
  persist(); console.error(report.error); process.exitCode = 1; }
finally {
  if (app) await app.close().catch(() => {});
  for (const pid of running()) try { process.kill(pid, 'SIGKILL'); } catch {}
  if (mounted) try { execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); } catch {}
  if (rehearsalName) try { execFileSync('security', ['delete-generic-password', '-s', rehearsalName + ' Safe Storage'], { stdio: 'ignore', timeout: 15000 }); } catch {}
  fs.rmSync(root, { recursive: true, force: true });
}
