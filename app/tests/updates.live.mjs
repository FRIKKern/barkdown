// C086 phase 3: the updater against a local feed. A tiny server serves <channel>-mac.yml naming a newer
// version and the zip it points at; the app checks, finds it, downloads it and verifies the digest;
// the install is refused with the ad hoc reason. Installing is rehearsed once the app is signed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const appRoot = path.resolve('.');
const out = path.resolve('../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-updates');
fs.mkdirSync(out, { recursive: true });
const report = { source: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-updates-'));
const current = JSON.parse(fs.readFileSync('package.json', 'utf8')).version, newer = current.replace(/^(\d+)\.(\d+)\.(\d+).*$/, (_, a, b, c) => `${a}.${b}.${Number(c) + 1}`);
const zipName = `Barkdown-${newer}-arm64-mac.zip`, zip = crypto.randomBytes(3 * 1024 * 1024);
const sha512 = crypto.createHash('sha512').update(zip).digest('base64');
const feed = `version: ${newer}\nfiles:\n  - url: ${zipName}\n    sha512: ${sha512}\n    size: ${zip.length}\npath: ${zipName}\nsha512: ${sha512}\nreleaseDate: '${new Date().toISOString()}'\n`;
const served = [];
const server = http.createServer((req, res) => { const pathname = new URL(req.url, 'http://local').pathname; served.push(pathname); if (pathname.endsWith('latest-mac.yml')) { res.writeHead(200, { 'content-type': 'text/yaml' }); res.end(feed); } else if (pathname.endsWith(zipName)) { res.writeHead(200, { 'content-type': 'application/zip', 'content-length': zip.length }); res.end(zip); } else { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/feed`;
let app;
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${path.join(root, 'user-data')}`], env: { ...process.env, BARKDOWN_UPDATE_URL: url, BARKDOWN_PROVIDER: 'api' } });
  const page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const idle = await page.evaluate(() => window.barkdown.updates.status());
  assert.deepEqual([idle.phase, idle.channel, idle.version], ['idle', 'latest', current]);
  report.checks.push('With a feed named, the updater is on, idle, on the latest channel, and has downloaded nothing'); persist();
  const found = await page.evaluate(() => window.barkdown.updates.check());
  assert.equal(found.phase, 'available', JSON.stringify(found)); assert.equal(found.latest, newer);
  assert.ok(served.some(u => u.endsWith('latest-mac.yml')) && !served.some(u => u.endsWith('.zip')), 'the check read the feed and did not download: ' + served.join(','));
  report.checks.push(`A check reads latest-mac.yml and reports ${newer} available without downloading`); persist();
  const got = await page.evaluate(() => window.barkdown.updates.download());
  assert.equal(got.phase, 'downloaded', JSON.stringify(got)); assert.ok(served.some(u => u.endsWith('.zip')));
  report.checks.push('A download fetches the zip the feed names and verifies its digest'); persist();
  const refused = await page.evaluate(() => window.barkdown.updates.install());
  assert.equal(refused.phase, 'downloaded'); assert.match(refused.message, /^This copy is signed ad hoc and cannot replace itself/);
  report.checks.push('Installing is refused with the ad hoc reason; nothing restarts'); persist();
  await page.evaluate(() => document.querySelector('#bw-settings')?.click() ?? window.__barkdown.openSettings?.());
  await page.locator('button[data-pane="about"]').click();
  await page.locator('#about-updates').filter({ hasText: 'is downloaded' }).waitFor();
  await page.screenshot({ path: path.join(out, '01-about-update-downloaded.png') });
  report.checks.push('Settings › About shows the downloaded update and the reason it cannot install'); persist();
  report.status = 'passed'; report.limits = ['One Mac, from source under Electron with a local feed; the digest check is real, the zip is random bytes, and the install step waits for a Developer ID signature.']; persist();
  console.log(JSON.stringify({ status: report.status, checks: report.checks }, null, 2));
} catch (error) { report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (app) await app.close().catch(() => {}); server.close(); fs.rmSync(root, { recursive: true, force: true }); }
