// C086: the disk image people install from. It is mounted read-only, the application is copied out
// the way a person drags it to Applications, the image is detached, and the packaged rehearsal runs
// against that installed copy: nothing from the build folder, nothing from the image, is in use.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
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
try {
  assert.ok(report.imageMb < 650, `the image is ${report.imageMb} MB, under 650`);
  execFileSync('hdiutil', ['attach', dmg, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountpoint], { stdio: 'ignore' }); mounted = true;
  const entries = fs.readdirSync(mountpoint);
  assert.ok(entries.includes('Barkdown.app'), 'the image holds Barkdown.app: ' + entries.join(', '));
  assert.ok(entries.includes('Applications'), 'the image offers the Applications link');
  report.checks.push({ name: 'The disk image mounts read-only and holds Barkdown.app beside an Applications link', imageMb: report.imageMb }); persist();
  // A person drags the application to Applications: a plain copy, attributes kept.
  execFileSync('cp', ['-R', path.join(mountpoint, 'Barkdown.app'), applications], { stdio: 'ignore' });
  execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); mounted = false;
  const installed = path.join(applications, 'Barkdown.app');
  const mark = JSON.parse(fs.readFileSync(path.join(installed, 'Contents', 'Resources', 'runtime', 'barkdown-release.json'), 'utf8'));
  assert.equal(mark.upstream, fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim(), 'the installed copy carries the pinned runtime');
  report.checks.push({ name: 'The application copied out of the image carries the pinned runtime; the image is detached before it runs' }); persist();
  const rehearsal = spawnSync(process.execPath, [path.join(appRoot, 'tests', 'app-packaged.live.mjs')], { cwd: appRoot, env: { ...process.env, BARKDOWN_TEST_APP: installed }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.writeFileSync(path.join(out, 'packaged-rehearsal.log'), rehearsal.stdout + rehearsal.stderr);
  assert.equal(rehearsal.status, 0, 'the packaged rehearsal passes against the installed copy; see packaged-rehearsal.log');
  const latest = fs.readdirSync(path.resolve(appRoot, '../docs/cycles/evidence/C086/live')).filter(d => d.endsWith('-app-packaged')).sort().at(-1);
  report.rehearsal = latest ? `evidence/C086/live/${latest}/result.json` : null;
  report.checks.push({ name: 'The packaged rehearsal (first boot, note, restart) passes against the copy installed from the image', rehearsal: report.rehearsal }); persist();
  report.status = 'passed'; report.limits = ['One Mac. The image is ad hoc signed and not notarized: on another Mac Gatekeeper refuses it until the signature exists. Dragging is simulated by a copy.']; persist();
  console.log(JSON.stringify({ status: report.status, imageMb: report.imageMb, checks: report.checks.map(c => c.name) }, null, 2));
} catch (error) { report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (mounted) try { execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); } catch {} fs.rmSync(root, { recursive: true, force: true }); }
