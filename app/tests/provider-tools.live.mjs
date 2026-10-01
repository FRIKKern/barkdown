// C088 S2: the tool chosen in Settings wins, a file that is not the tool is refused with what it
// answered, and the sign-in check follows the chosen path. The login shell and the tools are fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-provider-tools-live-'));
const out = path.resolve('../docs/cycles/evidence/C088/live', new Date().toISOString().replace(/[:.]/g, '-') + '-provider-tools');
fs.mkdirSync(out, { recursive: true });
const tools = path.join(root, 'tools'); fs.mkdirSync(tools);
const write = (name, body) => { const file = path.join(tools, name); fs.writeFileSync(file, '#!/bin/sh\n' + body); fs.chmodSync(file, 0o755); return file; };
const claude = write('claude', 'case "$1 $2" in "auth status") echo \'{"loggedIn":true}\';; "--version ") echo "9.9.9 (Claude Code)";; *) exit 2;; esac\n');
const impostor = write('impostor', 'echo "hello from a script"\n');
const elderly = write('claude-old', 'case "$1 $2" in "auth status") echo \'{"loggedIn":true}\';; "--version ") echo "2.0.1 (Claude Code)";; *) exit 2;; esac\n');
const future = write('claude-next', 'case "$1" in --version) echo "3.0.0 (Claude Code)";; *) exit 2;; esac\n');
const systemPath = '/usr/bin:/bin:/usr/sbin:/sbin', shell = path.resolve('tests/fixtures/shells/good.sh');
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT || null, host: `${process.platform} ${os.release()} ${process.arch}`, checks: [], status: 'failed' };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
let app;
const settle = async (page, provider) => { let s; for (let i = 0; i < 150; i++) { s = await page.evaluate(p => window.barkdown.providers.loginStatus(p), provider); if (!['starting', 'checking', 'waiting'].includes(s.state)) return s; await new Promise(r => setTimeout(r, 200)); } return s; };
try {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${path.join(root, 'user-data')}`],
    env: { HOME: os.homedir(), USER: process.env.USER, PATH: systemPath, SHELL: shell, BD_FIXTURE_PATH: `${tools}:${systemPath}`, BARKDOWN_PROVIDER: '', ANTHROPIC_API_KEY: '', TMPDIR: process.env.TMPDIR } });
  const page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const found = await page.evaluate(() => window.barkdown.providers.tools());
  assert.deepEqual([found.claude.ok, found.claude.source, found.claude.version, found.claude.path], [true, 'path', '9.9.9', claude], JSON.stringify(found.claude));
  // Codex may be a real install in a known folder on this machine, or absent; either answer is reported, never thrown.
  assert.ok(found.codex.ok ? found.codex.path : /Codex was not found on the PATH/.test(found.codex.problem), JSON.stringify(found.codex));
  report.found = found; report.checks.push('On the login-shell PATH the fixture Claude Code is found and its --version answer accepted; Codex is reported as found or as not found'); persist();
  await page.evaluate(p => window.barkdown.settings.set({ providerBinary: { claude: p } }), impostor);
  const refused = await page.evaluate(() => window.barkdown.providers.tools(true));
  assert.deepEqual([refused.claude.ok, refused.claude.source, refused.claude.path], [false, 'settings', impostor]); assert.match(refused.claude.problem, /Not Claude Code: --version answered “hello from a script”/);
  await page.evaluate(() => window.barkdown.providers.checkLogin('claude'));
  const status = await settle(page, 'claude');
  assert.notEqual(status.state, 'signed-in', 'a sign-in check through the impostor does not report signed in: ' + JSON.stringify(status));
  report.refused = refused.claude; report.checks.push('A path set in Settings wins; a file that is not the tool is refused with what it answered, and the sign-in check through it does not report signed in'); persist();
  await page.evaluate(p => window.barkdown.settings.set({ providerBinary: { claude: p } }), claude);
  const chosen = await page.evaluate(() => window.barkdown.providers.tools(true));
  assert.deepEqual([chosen.claude.ok, chosen.claude.source, chosen.claude.version], [true, 'settings', '9.9.9']);
  await page.evaluate(() => window.barkdown.providers.checkLogin('claude'));
  assert.equal((await settle(page, 'claude')).state, 'signed-in');
  report.checks.push('The chosen path is checked again and the sign-in check follows it'); persist();
  let rejected = null; try { await page.evaluate(() => window.barkdown.settings.set({ providerBinary: { claude: 'claude' } })); } catch (error) { rejected = error.message; }
  assert.match(String(rejected), /must be absolute/); report.checks.push('A relative path is refused on save'); persist();
  // Older than the version Barkdown was tested with: found, usable, and a warning that names the tested version.
  await page.evaluate(p => window.barkdown.settings.set({ providerBinary: { claude: p } }), elderly);
  const old = (await page.evaluate(() => window.barkdown.providers.tools(true))).claude;
  assert.deepEqual([old.ok, old.version, old.fit], [true, '2.0.1', 'older'], JSON.stringify(old)); assert.match(old.advice, /older than the \d+\.\d+\.\d+ Barkdown was tested with/);
  await page.evaluate(p => window.barkdown.settings.set({ providerBinary: { claude: p } }), future);
  const next = (await page.evaluate(() => window.barkdown.providers.tools(true))).claude;
  assert.deepEqual([next.ok, next.fit], [true, 'major']); assert.match(next.advice, /different major/);
  const same = (await page.evaluate(() => window.barkdown.providers.tools(true))).codex;
  assert.ok(!same.ok || ['tested', 'newer'].includes(same.fit), 'a tool at or past the tested version is silent: ' + JSON.stringify(same));
  report.fit = { old, next }; report.checks.push('An older tool warns and names the tested version; a different major warns; at or past the tested version nothing is said'); persist();
  await page.evaluate(p => window.barkdown.settings.set({ providerBinary: { claude: p } }), elderly);
  await page.evaluate(() => window.__barkdown.openSettings?.() ?? document.querySelector('#bw-settings').click());
  await page.locator('button[data-pane="assistant"]').click();
  await page.locator('[data-tool-status="claude"] [data-tool-fit="older"]').waitFor();
  await page.locator('#claude-binary').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, '01-settings-tool-field.png') });
  report.checks.push('Settings shows the tool field with what was found and the version warning'); persist();
  report.status = 'passed'; report.limits = ['One Mac. The tools and the login shell are fixtures; a real Claude Code on a clean account is the S4 rehearsal.']; persist();
  console.log(JSON.stringify({ status: report.status, checks: report.checks }, null, 2));
} catch (error) { report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (app) await app.close().catch(() => {}); fs.rmSync(root, { recursive: true, force: true }); }
