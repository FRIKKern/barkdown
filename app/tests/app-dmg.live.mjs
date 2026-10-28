// C086: the disk image people install from. It is mounted read-only, the application is copied out
// the way a person drags it to Applications, the image is detached, and the packaged rehearsal runs
// against that installed copy: nothing from the build folder, nothing from the image, is in use.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const dmg = path.resolve(process.env.BARKDOWN_TEST_DMG || path.join(appRoot, 'release', `Barkdown-${manifest.version}-${process.arch}.dmg`));
if (!fs.existsSync(dmg)) throw new Error('Build the disk image first: node scripts/build-mac-app.mjs --dmg');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-app-dmg');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, image: path.basename(dmg), imageMb: Math.round(fs.statSync(dmg).size / 1048576), checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-dmg-'));
const mountpoint = path.join(root, 'image'), applications = path.join(root, 'Applications'); fs.mkdirSync(applications);
let mounted = false;
// A quit the application refuses (its own "owned work has not been verified stopped" dialog) is a failure named
// within 90 seconds, not a run that waits for a click until the job limit; the process is stopped either way.
const quitFailures = [];
const closeWithin = (electronApp, what) => { let timer; return Promise.race([electronApp.close(), new Promise((_, reject) => { timer = setTimeout(() => { try { electronApp.process().kill('SIGKILL'); } catch {} reject(new Error(`${what} did not quit within 90 seconds`)); }, 90000); })]).catch(error => { quitFailures.push(error.message); }).finally(() => clearTimeout(timer)); };
try {
  assert.ok(report.imageMb < 650, `the image is ${report.imageMb} MB, under 650`);
  // The checksum beside the image matches the image: what a person verifies after a download.
  const written = fs.readFileSync(dmg + '.sha256', 'utf8').trim().split(/\s+/);
  const digest = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(dmg)).digest('hex');
  assert.deepEqual(written, [digest, path.basename(dmg)], 'the .sha256 beside the image names the image and matches it');
  report.sha256 = digest; report.checks.push({ name: 'The SHA-256 written beside the image matches the image' }); persist();
  execFileSync('hdiutil', ['attach', dmg, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountpoint], { stdio: 'ignore' }); mounted = true;
  const entries = fs.readdirSync(mountpoint);
  assert.ok(entries.includes('Barkdown.app'), 'the image holds Barkdown.app: ' + entries.join(', '));
  assert.ok(entries.includes('Applications'), 'the image offers the Applications link');
  report.checks.push({ name: 'The disk image mounts read-only and holds Barkdown.app beside an Applications link', imageMb: report.imageMb }); persist();
  // A person drags the application to Applications: a plain copy, attributes kept.
  execFileSync('cp', ['-R', path.join(mountpoint, 'Barkdown.app'), applications], { stdio: 'ignore' });
  const reinstall = path.join(root, 'reinstall'); fs.mkdirSync(reinstall); execFileSync('cp', ['-R', path.join(mountpoint, 'Barkdown.app'), reinstall], { stdio: 'ignore' });
  execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); mounted = false;
  const installed = path.join(applications, 'Barkdown.app');
  const mark = JSON.parse(fs.readFileSync(path.join(installed, 'Contents', 'Resources', 'runtime', 'barkdown-release.json'), 'utf8'));
  assert.equal(mark.upstream, fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim(), 'the installed copy carries the pinned runtime');
  report.checks.push({ name: 'The application copied out of the image carries the pinned runtime; the image is detached before it runs' }); persist();
  const userData = path.join(root, 'user-data'); fs.mkdirSync(userData);
  const rehearsal = spawnSync(process.execPath, [path.join(appRoot, 'tests', 'app-packaged.live.mjs')], { cwd: appRoot, env: { ...process.env, BARKDOWN_TEST_APP: installed, BARKDOWN_TEST_USER_DATA: userData, BARKDOWN_TEST_KEEP: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.writeFileSync(path.join(out, 'packaged-rehearsal.log'), rehearsal.stdout + rehearsal.stderr);
  assert.equal(rehearsal.status, 0, 'the packaged rehearsal passes against the installed copy; see packaged-rehearsal.log');
  const latest = fs.readdirSync(path.resolve(appRoot, '../docs/cycles/evidence/C086/live')).filter(d => d.endsWith('-app-packaged')).sort().at(-1);
  report.rehearsal = latest ? `evidence/C086/live/${latest}/result.json` : null;
  report.checks.push({ name: 'The packaged rehearsal (first boot, note, restart) passes against the copy installed from the image', rehearsal: report.rehearsal }); persist();
  // Uninstall: the application goes, the library stays. Reinstall from the image: the same note reads back.
  const previous = JSON.parse(fs.readFileSync(path.resolve(appRoot, '../docs/cycles', report.rehearsal), 'utf8'));
  fs.rmSync(installed, { recursive: true, force: true });
  assert.equal(fs.existsSync(installed), false);
  assert.ok(fs.existsSync(path.join(userData, 'profile-data', 'registry.json')), 'the profile registry survives the uninstall');
  const dataMb = Math.round(Number(execFileSync('du', ['-sk', userData], { encoding: 'utf8' }).split('\t')[0]) / 1024);
  report.checks.push({ name: 'Removing the application leaves the user data where it was', userDataMb: dataMb }); persist();
  fs.renameSync(path.join(reinstall, 'Barkdown.app'), installed);
  const app = await electron.launch({ executablePath: path.join(installed, 'Contents', 'MacOS', 'Barkdown'), args: ['--profiles', `--user-data=${userData}`, `--app-name=${previous.note.rehearsalName}`], env: { HOME: os.homedir(), USER: process.env.USER, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: process.env.TMPDIR, BARKDOWN_PROVIDER: 'api' } });
  try {
    const page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed after reinstall: ' + s.error); await new Promise(r => setTimeout(r, 200)); }
    const read = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), previous.note);
    assert.equal(read.title, 'From the application'); assert.match(read.markdown, /Rhubarb notes written in the built application\./);
    report.checks.push({ name: 'The application reinstalled from the image opens the same library and the note reads the same' }); persist();
    // The restored note tab mounts once the library answers; a quit before that is refused by the app ("the open notes
    // changed while quitting", task-6aa7aeed8d4ebe1b, fixed in the app separately). Quit after the pane is there.
    await page.waitForFunction(() => document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'), null, { timeout: 60000 }).catch(() => {});
  } finally { await closeWithin(app, 'The reinstalled application'); }
  // A failed upgrade: the replacement bundle has no runtime inside. The library must not be touched
  // and the app must say so; putting the previous bundle back must bring the note back.
  const registryBefore = fs.readFileSync(path.join(userData, 'profile-data', 'registry.json'), 'utf8');
  const countFiles = dir => { let n = 0; for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1; return n; };
  const filesBefore = countFiles(path.join(userData, 'profile-data'));
  const good = path.join(root, 'previous'); fs.renameSync(installed, good);
  execFileSync('cp', ['-R', good, installed], { stdio: 'ignore' });
  fs.rmSync(path.join(installed, 'Contents', 'Resources', 'runtime'), { recursive: true, force: true });
  const broken = await electron.launch({ executablePath: path.join(installed, 'Contents', 'MacOS', 'Barkdown'), args: ['--profiles', `--user-data=${userData}`, `--app-name=${previous.note.rehearsalName}`], env: { HOME: os.homedir(), USER: process.env.USER, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: process.env.TMPDIR, BARKDOWN_PROVIDER: 'api' } });
  let brokenStatus;
  try {
    const page = await broken.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    for (let i = 0; i < 150; i++) { brokenStatus = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (['ready', 'failed', 'stopped', 'unconfigured'].includes(brokenStatus.phase)) break; await new Promise(r => setTimeout(r, 200)); }
    await page.screenshot({ path: path.join(out, '02-broken-replacement.png') });
  } finally { await closeWithin(broken, 'The application without its runtime'); }
  assert.notEqual(brokenStatus?.phase, 'ready', 'a bundle without its runtime does not claim to be ready: ' + JSON.stringify(brokenStatus));
  assert.equal(fs.readFileSync(path.join(userData, 'profile-data', 'registry.json'), 'utf8'), registryBefore, 'the profile registry is untouched by the broken replacement');
  assert.ok(countFiles(path.join(userData, 'profile-data')) >= filesBefore, 'no profile file was removed by the broken replacement');
  report.checks.push({ name: 'A replacement bundle without its runtime does not start the library and leaves the profile data untouched', observed: brokenStatus }); persist();
  fs.rmSync(installed, { recursive: true, force: true }); fs.renameSync(good, installed);
  const back = await electron.launch({ executablePath: path.join(installed, 'Contents', 'MacOS', 'Barkdown'), args: ['--profiles', `--user-data=${userData}`, `--app-name=${previous.note.rehearsalName}`], env: { HOME: os.homedir(), USER: process.env.USER, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: process.env.TMPDIR, BARKDOWN_PROVIDER: 'api' } });
  try {
    const page = await back.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed after rollback: ' + s.error); await new Promise(r => setTimeout(r, 200)); }
    const read = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), previous.note);
    assert.equal(read.title, 'From the application'); assert.match(read.markdown, /Rhubarb notes written in the built application\./);
    report.checks.push({ name: 'The previous bundle put back opens the same library and the note reads the same (failed-upgrade rollback)' }); persist();
  } finally { await closeWithin(back, 'The application put back'); try { execFileSync('security', ['delete-generic-password', '-s', previous.note.rehearsalName + ' Safe Storage'], { stdio: 'ignore', timeout: 15000 }); } catch {} }
  assert.deepEqual(quitFailures, [], 'every launch quits when asked');
  const notarized = spawnSync('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', dmg]).status === 0;
  report.status = 'passed'; report.limits = [`One Mac. ${notarized ? 'The image is signed with a Developer ID and notarized.' : 'The image is ad hoc signed and not notarized: on another Mac Gatekeeper refuses it until the signature exists.'} Dragging is simulated by a copy.`]; persist();
  console.log(JSON.stringify({ status: report.status, imageMb: report.imageMb, checks: report.checks.map(c => c.name) }, null, 2));
} catch (error) { report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (mounted) try { execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); } catch {} fs.rmSync(root, { recursive: true, force: true }); }
