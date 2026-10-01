// The updater against a real release: the application installed from the newest nightly's image is
// pointed at a local server serving that release's actual assets (zip, blockmap) under a feed whose
// version is one higher, since the previous nightly predates the updater. It must find the newer
// version, download the real zip, verify its digest, and refuse to install while signed ad hoc.
// Needs one staged release under .release/ (scripts/release.mjs leaves it).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
const appRoot = path.resolve('.'), repo = path.resolve('..');
const stages = fs.readdirSync(path.join(repo, '.release')).filter(d => /^v\d+\.\d+\.\d+-nightly\./.test(d)).sort((a, b) => fs.statSync(path.join(repo, '.release', a)).mtimeMs - fs.statSync(path.join(repo, '.release', b)).mtimeMs);
if (stages.length < 1) throw new Error('A staged nightly is needed under .release/');
const older = stages.at(-1);
const olderDmg = fs.readdirSync(path.join(repo, '.release', older)).find(f => f.endsWith('.dmg'));
// The feed: the staged release's own yml with its version raised by one run number; the files it names are the real ones.
const feedDir = path.join(repo, '.release', older);
const realFeed = fs.readFileSync(path.join(feedDir, 'nightly-mac.yml'), 'utf8');
const newer = older.replace(/\.(\d+)$/, (_, n) => '.' + (Number(n) + 1));
const feed = realFeed.replace(/^version: .*$/m, 'version: ' + newer.slice(1));
const out = path.resolve('../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-updates-release');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, installed: older, offered: newer, checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-updates-release-'));
const mountpoint = path.join(root, 'image'), applications = path.join(root, 'Applications'); fs.mkdirSync(applications);
const served = [];
const server = http.createServer((req, res) => { const name = path.basename(new URL(req.url, 'http://local').pathname); served.push(name); if (name === 'nightly-mac.yml') { res.writeHead(200, { 'content-type': 'text/yaml' }); res.end(feed); return; } const file = path.join(feedDir, name); if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-length': fs.statSync(file).size }); fs.createReadStream(file).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/feed`;
let app, mounted = false;
const rehearsalName = 'Barkdown Rehearsal ' + path.basename(root).slice(-6);
try {
  execFileSync('hdiutil', ['attach', path.join(repo, '.release', older, olderDmg), '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mountpoint], { stdio: 'ignore' }); mounted = true;
  execFileSync('cp', ['-R', path.join(mountpoint, 'Barkdown.app'), applications], { stdio: 'ignore' });
  execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); mounted = false;
  const installed = path.join(applications, 'Barkdown.app');
  app = await electron.launch({ executablePath: path.join(installed, 'Contents', 'MacOS', 'Barkdown'), args: ['--profiles', `--user-data=${path.join(root, 'user-data')}`, `--app-name=${rehearsalName}`], env: { HOME: os.homedir(), USER: process.env.USER, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: process.env.TMPDIR, BARKDOWN_PROVIDER: 'api', BARKDOWN_UPDATE_URL: url } });
  const page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(120000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const idle = await page.evaluate(() => window.barkdown.updates.status());
  assert.equal(idle.channel, 'nightly'); assert.equal('v' + idle.version, older); assert.equal(idle.signed, false);
  report.checks.push(`The installed ${older} runs on the nightly channel, ad hoc signed, updater on`); persist();
  const found = await page.evaluate(() => window.barkdown.updates.check());
  assert.equal(found.phase, 'available', JSON.stringify(found)); assert.equal('v' + found.latest, newer);
  assert.ok(served.includes('nightly-mac.yml') && !served.some(n => n.endsWith('.zip')));
  report.checks.push(`A check reads the feed and offers ${newer} (the release's own assets under a raised version) without downloading`); persist();
  const got = await page.evaluate(() => window.barkdown.updates.download());
  assert.equal(got.phase, 'downloaded', JSON.stringify(got)); assert.ok(served.some(n => n.endsWith('.zip')), 'the real zip was fetched');
  report.checks.push('The real zip is downloaded and its digest verified against the feed'); persist();
  const refused = await page.evaluate(() => window.barkdown.updates.install());
  assert.equal(refused.phase, 'downloaded'); assert.match(refused.message, /^This copy is signed ad hoc and cannot replace itself/);
  report.checks.push('Installing is refused with the ad hoc reason; the running application stays'); persist();
  report.status = 'passed'; report.limits = ['The installed application is the newest nightly and the offered update is its own zip under a raised version, because the previous nightly predates the updater; from the next nightly on, the previous one is installed and the newest is offered. Assets are served from a local folder because the repository is private. The install step waits for a Developer ID signature.']; persist();
  console.log(JSON.stringify({ status: report.status, checks: report.checks }, null, 2));
} catch (error) { report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (app) await app.close().catch(() => {}); if (mounted) try { execFileSync('hdiutil', ['detach', mountpoint, '-force'], { stdio: 'ignore' }); } catch {} server.close(); try { execFileSync('security', ['delete-generic-password', '-s', rehearsalName + ' Safe Storage'], { stdio: 'ignore' }); } catch {} fs.rmSync(root, { recursive: true, force: true }); }
