// A host that dies leaves its managed runtime and private database running. The next launch
// proves they are this profile's own by the launch record, stops them and starts again; the
// library is intact. Real Electron, a real kill of the main process, no manual cleanup.
// Needs a built Barkpark checkout at BARKDOWN_TEST_BP_SOURCE (default ../../barkpark-editor).
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { createRuntimeRecord } = require('../main/runtime-orphan');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appRoot, '../../barkpark-editor'));
if (!fs.existsSync(path.join(source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('BARKDOWN_TEST_BP_SOURCE must point at a built Barkpark checkout');
const upstream = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
const host = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('../docs/cycles/evidence/C085/live', new Date().toISOString().replace(/[:.]/g, '-') + '-runtime-reclaim');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-reclaim-')));
const report = { source: host, upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['One machine, one run. The host is ended with SIGKILL while idle; a kill in the middle of a write is not produced here. POSIX process groups only: the Windows path (taskkill on the recorded process tree) is written and not rehearsed.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Writing desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source } } });
registry.selectProfile(profile.id);
const dataDir = path.join(dir, 'local-barkpark', 'runtime'), record = createRuntimeRecord({ dataDir, log: () => {} });
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
let app, page, stderr = [];
const launch = async () => {
  stderr = [];
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api' } });
  app.process().stderr?.on('data', chunk => stderr.push(String(chunk)));
  page = await app.firstWindow(); page.setDefaultTimeout(30000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
};
const runtimeReady = async () => {
  const started = Date.now();
  for (;;) {
    const status = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(error => ({ phase: 'pending', error: error.message }));
    if (status.phase === 'ready') return Date.now() - started;
    if (status.phase === 'failed') throw new Error('Profile runtime failed: ' + status.error);
    if (Date.now() - started > 300000) throw new Error('Profile runtime not ready after 5 minutes');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
const quit = async () => { await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('The app did not quit within 90 seconds')), 90000))]); };
let left = null;
try {
  await launch(); await runtimeReady();
  const note = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  const before = (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => p.id).sort();
  assert.ok(before.includes(note.id));
  left = record.read();
  assert.ok(left && Number.isSafeInteger(left.pid) && alive(left.pid), 'the launch is recorded with a live runtime');
  assert.equal(left.hostPid, app.process().pid);
  report.checks.push({ name: 'The launch is recorded: host, runtime process and its start time, ports', runtime: left.pid, host: left.hostPid }); persist();

  process.kill(app.process().pid, 'SIGKILL');
  await new Promise(resolve => setTimeout(resolve, 4000));
  assert.equal(alive(left.hostPid), false, 'the host is gone');
  assert.equal(alive(left.pid), true, 'the runtime outlived its host');
  assert.ok(record.read(), 'the record outlived the host');
  report.checks.push({ name: 'The host is killed: its runtime and database keep running, the record remains' }); persist();

  await launch(); const ms = await runtimeReady();
  assert.equal(alive(left.pid), false, 'the leftover runtime was stopped');
  assert.ok(stderr.join('').includes(`[runtime] reclaimed after host ${left.hostPid} ended: runtime ${left.pid}, private database`), stderr.join('').slice(-600));
  const now = record.read();
  assert.ok(now && now.pid !== left.pid && now.hostPid === app.process().pid);
  const after = (await page.evaluate(() => window.barkdown.barkpark.list())).map(p => p.id).sort();
  assert.deepEqual(after, before, 'the library is intact');
  const edited = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  assert.ok(edited.id);
  report.checks.push({ name: 'The next launch reclaims both by the record, starts again and serves the same library; writing works', readyMs: ms }); persist();

  await quit();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(record.read(), null, 'a clean quit leaves no record');
  assert.equal(alive(now.pid), false, 'a clean quit leaves no runtime');
  report.checks.push({ name: 'A clean quit leaves nothing to reclaim' }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); report.mainStderr = stderr.join('').slice(-2000); persist();
  try { await quit(); } catch {}
  // Only what this rehearsal launched: the recorded process group and the private database directory.
  for (const r of [left, (() => { try { return record.read(); } catch { return null; } })()]) if (r?.pid && alive(r.pid)) { try { process.kill(-r.pid, 'SIGTERM'); } catch {} }
  try { execFileSync('pg_ctl', ['-D', path.join(dataDir, 'pgdata'), '-m', 'fast', '-w', '-t', '20', 'stop'], { stdio: 'ignore' }); } catch {}
  throw error;
}
