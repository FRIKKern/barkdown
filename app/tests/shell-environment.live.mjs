// C088 S1: an app started with launchd's minimal PATH finds the user's own tool through the login
// shell. The shell is a fixture that answers -ilc with a PATH holding a fixture `claude`; the app's
// own PATH must stay as launched, since the packaged runtime depends on that.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-shell-env-live-'));
const out = path.resolve('../docs/cycles/evidence/C088/live', new Date().toISOString().replace(/[:.]/g, '-') + '-shell-environment');
fs.mkdirSync(out, { recursive: true });
const tools = path.join(root, 'tools'); fs.mkdirSync(tools);
// A fixture Claude Code: signed in, with a version, and nothing else.
fs.writeFileSync(path.join(tools, 'claude'), '#!/bin/sh\ncase "$1 $2" in "auth status") echo \'{"loggedIn":true,"authMethod":"fixture"}\';; "--version ") echo "9.9.9 (Claude Code)";; *) echo "fixture claude: unsupported $*" >&2; exit 2;; esac\n');
fs.chmodSync(path.join(tools, 'claude'), 0o755);
const systemPath = '/usr/bin:/bin:/usr/sbin:/sbin';
const shell = path.resolve('tests/fixtures/shells/good.sh');
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT || null, host: `${process.platform} ${os.release()} ${process.arch}`, checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
let app;
try {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${path.join(root, 'user-data')}`],
    env: { HOME: os.homedir(), USER: process.env.USER, PATH: systemPath, SHELL: shell, BD_FIXTURE_PATH: `${tools}:${systemPath}`, BARKDOWN_PROVIDER: '', ANTHROPIC_API_KEY: '', TMPDIR: process.env.TMPDIR } });
  const page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  let env;
  for (let i = 0; i < 100; i++) { env = await page.evaluate(() => window.barkdown.providers.shellEnvironment()); if (env.source !== 'pending') break; await new Promise(r => setTimeout(r, 200)); }
  assert.equal(env.source, 'login-shell:' + shell, 'the login shell answered: ' + JSON.stringify(env));
  report.shellEnvironment = env; report.checks.push('The login shell fixture was probed and its PATH adopted'); persist();
  const check = await page.evaluate(() => window.barkdown.providers.checkLogin('claude'));
  let status;
  for (let i = 0; i < 150; i++) { status = await page.evaluate(() => window.barkdown.providers.loginStatus('claude')); if (!['starting', 'checking'].includes(status.state)) break; await new Promise(r => setTimeout(r, 200)); }
  assert.equal(status.state, 'signed-in', 'the fixture tool on the login-shell PATH was found and reports signed in: ' + JSON.stringify({ check, status }));
  report.checks.push('A sign-in check found the tool through the login-shell PATH, not the app’s PATH'); persist();
  const appPath = await app.evaluate(() => process.env.PATH);
  assert.equal(appPath, systemPath, 'the app’s own PATH is unchanged');
  report.checks.push('The main process PATH stays as launched: the packaged runtime never sees the shell PATH'); persist();
  await page.screenshot({ path: path.join(out, '01-signed-in-through-shell-path.png') });
  report.status = 'passed'; report.limits = ['One Mac. The login shell and the tool are fixtures; a real zsh with a real Claude Code is the clean-account rehearsal in S4.']; persist();
  console.log(JSON.stringify(report, null, 2));
} catch (error) { report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (app) await app.close().catch(() => {}); fs.rmSync(root, { recursive: true, force: true }); }
