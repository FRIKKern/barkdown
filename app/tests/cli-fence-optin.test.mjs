// The two ways past the CLI fence in app/main/cli-spawn.js, and that neither can be reached from a test.
//   * Packaged: the module sits inside a real app.asar archive, in Electron (and in the main process Electron's
//     app.isPackaged agrees). Rows: a seeded require cache, a preload faking Electron, ELECTRON_* variables.
//   * The dev opt-in: a flag on the Electron main process's own command line, passed only by
//     app/scripts/start.mjs. The main process reads it once and drops it, so its children never carry it.
// Rows run in their own processes against an ambient loopback listener (tests/lib/cli-stub.mjs). This file
// builds the command's name and the flag's name at run time, so the name scans hold for it too.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { stubPreload, REFUSED, SWITCH, appDir, ambient, route, track, endAll, LIMIT } from './lib/cli-stub.mjs';

after(endAll); // every child a row started, with all it started, even when a row failed or timed out
const ROW = { timeout: 60_000 };

const repo = path.dirname(appDir);
const FLAG = '--' + ['barkdown', 'dev', 'cli', 'unfenced'].join('-');
const NAMES = [FLAG.slice(2), FLAG.slice(2).replace(/-/g, '_')]; // as a flag, or as an environment variable
const carries = text => NAMES.some(name => String(text).toLowerCase().includes(name));
const IMPORT = 'return barkpark().importFromCli();';

// A preload that makes a plain node process look like Electron's packaged main process from the inside.
function fakeElectronPreload() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-fake-')), 'fake-electron.cjs');
  fs.writeFileSync(file, `
    const Module = require('module'), load = Module._load;
    Module._load = function (request, ...rest) {
      if (request === 'electron') return { app: { isPackaged: true } };
      if (request === 'original-fs') return require('fs');
      return load.call(this, request, ...rest);
    };
    process.versions.electron = '44.5.1'; process.type = 'browser';
  `);
  return `${stubPreload} --require ${JSON.stringify(file)}`;
}

test('not packaged however a test dresses the process up: a seeded require cache, a preload faking Electron, ELECTRON_* variables', ROW, async t => {
  const { near, env, started } = await ambient();
  try {
    const rows = [
      ['a require cache seeded with a packaged Electron', env, `const p = require.resolve('electron', { paths: [APP] }); require.cache[p] = { id: p, filename: p, loaded: true, exports: { app: { isPackaged: true } } }; ${IMPORT}`],
      ['a preload faking packaged Electron, its main process and original-fs', { ...env, NODE_OPTIONS: fakeElectronPreload() }, IMPORT],
      ['ELECTRON_* variables', { ...env, ELECTRON_FORCE_IS_PACKAGED: '1', ELECTRON_RUN_AS_NODE: '1', ELECTRON_IS_DEV: '0', ELECTRON_NO_ASAR: '1', ELECTRON_OVERRIDE_DIST_PATH: os.tmpdir() }, IMPORT],
      ['the preload and the variables together', { ...env, NODE_OPTIONS: fakeElectronPreload(), ELECTRON_FORCE_IS_PACKAGED: '1' }, IMPORT],
    ];
    let electronInstalled = true; try { execFileSync(process.execPath, ['-e', `require.resolve('electron', { paths: [${JSON.stringify(appDir)}] })`]); } catch { electronInstalled = false; }
    for (const [label, rowEnv, code] of rows) {
      if (!electronInstalled && /require cache/.test(label)) { t.diagnostic(`${label}: skipped, electron is not installed here`); continue; }
      const run = await route(code, rowEnv);
      assert.match(run.stderr + run.stdout, REFUSED, `${label}: ${run.stdout}`);
    }
    assert.equal(near.connections(), 0); assert.deepEqual(started(), []);
  } finally { await near.close(); }
});

// A stand-in Electron (node under Electron's name, made to look like the main process) launched by the real
// start.mjs. Like main.js, it loads cli-spawn.js first. It then starts the CLI, reads the environments a
// terminal tab and a provider run would get, and runs a "test" from a terminal tab as its own child.
function standInElectron() {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-electron-'));
  const pathTxt = path.join(appDir, 'node_modules/electron/path.txt');
  const exe = path.join(dist, fs.existsSync(pathTxt) ? fs.readFileSync(pathTxt, 'utf8') : 'electron');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  // A hard link (a copy across volumes) on every platform, as on Windows: process.execPath keeps the stand-in's name.
  try { fs.linkSync(process.execPath, exe); } catch { fs.copyFileSync(process.execPath, exe); fs.chmodSync(exe, 0o755); }
  const out = path.join(dist, 'result.json'), probe = path.join(dist, 'probe.cjs'), starts = path.join(dist, 'starts.txt');
  const main = name => JSON.stringify(path.join(appDir, 'main', name));
  fs.writeFileSync(probe, `
    const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync, spawnSync } = require('child_process');
    if (path.basename(process.argv0) === ${JSON.stringify(path.basename(exe))} && process.argv[1] && path.resolve(process.argv[1]) === ${JSON.stringify(appDir)}) {
      fs.appendFileSync(${JSON.stringify(starts)}, process.pid + '\\n');
      process.versions.electron = 'stand-in'; process.type = 'browser';
      const result = { hadFlag: process.argv.includes(${JSON.stringify(FLAG)}) };
      const { cliSpawn, relaunchArgs } = require(${main('cli-spawn.js')});
      result.argv = process.argv; result.relaunchArgs = relaunchArgs();
      try { const s = cliSpawn(['whoami']); result.started = JSON.parse(execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8', ...LIMIT })); } catch (e) { result.startError = String(e.message); }
      const shellEnv = require(${main('shell-environment.js')}).providerEnv();
      const terminalEnv = { ...shellEnv, TERM: 'xterm-256color' }; delete terminalEnv.ELECTRON_RUN_AS_NODE;
      let mcp; try { mcp = require(${main('providers/runs.js')}).mcpServerSpec(os.tmpdir(), null); } catch (e) { mcp = { error: String(e.message) }; }
      result.mcp = mcp;
      result.carriers = { mainEnv: JSON.stringify(process.env), terminalEnv: JSON.stringify(terminalEnv), providerEnv: JSON.stringify(shellEnv), mcp: JSON.stringify(mcp), argv: JSON.stringify(process.argv) };
      const child = spawnSync(process.execPath, ['-e', "require(" + JSON.stringify(${main('barkpark.js')}) + ").importFromCli().then(r => console.log(JSON.stringify(r)))"], { env: terminalEnv, encoding: 'utf8', ...LIMIT });
      result.fromTerminal = child.stdout + child.stderr;
      // An in-app relaunch: a new main process started with the args the relaunch builds.
      if (!process.env.STAND_IN_RELAUNCHED) spawnSync(${JSON.stringify(exe)}, result.relaunchArgs, { env: { ...process.env, STAND_IN_RELAUNCHED: '1' }, ...LIMIT });
      const file = process.env.STAND_IN_RELAUNCHED ? ${JSON.stringify(out + '.relaunched')} : ${JSON.stringify(out)};
      fs.writeFileSync(file, JSON.stringify(result)); process.exit(0);
    }
  `.replace(/\.\.\.LIMIT/g, '...' + JSON.stringify(LIMIT)));
  return { dist, out, probe, starts };
}

test('the dev app (npm start) starts the CLI; its terminal tabs and provider runs do not carry the opt-in, and a test run there is refused', ROW, async t => {
  if (!fs.existsSync(path.join(appDir, 'node_modules/electron'))) return t.skip('electron is not installed here');
  const { near, env } = await ambient();
  const { dist, out, probe, starts } = standInElectron();
  try {
    const child = track(spawn(process.execPath, [path.join(appDir, 'scripts/start.mjs')], { cwd: appDir, detached: process.platform !== 'win32', env: { ...env, ELECTRON_OVERRIDE_DIST_PATH: dist, BARKDOWN_CARRIED_RUNTIME: dist, NODE_OPTIONS: `${stubPreload} --require ${JSON.stringify(probe)}` } }));
    let stderr = ''; child.stderr.on('data', d => { stderr += d; });
    await new Promise(resolve => child.on('close', resolve));
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(result.hadFlag, true, 'start.mjs passes the opt-in on the main process command line');
    assert.deepEqual(result.started, { server: near.url, dataset: 'production' }, stderr + (result.startError || ''));
    assert.equal(result.mcp.error, undefined, 'the provider run spec was built');
    assert.deepEqual(Object.entries(result.carriers).filter(([, text]) => carries(text)).map(([where]) => where), [], 'the opt-in travels nowhere');
    assert.match(result.fromTerminal, REFUSED, 'a test run from a terminal tab of the dev app is fenced');
    assert.deepEqual(result.relaunchArgs.filter(arg => arg === FLAG), [FLAG], 'the dev app hands the flag to its own relaunch');
    const relaunched = JSON.parse(fs.readFileSync(out + '.relaunched', 'utf8'));
    assert.equal(relaunched.hadFlag, true); assert.deepEqual(relaunched.started, { server: near.url, dataset: 'production' }, 'the relaunched dev app starts the CLI');
    assert.deepEqual(Object.entries(relaunched.carriers).filter(([, text]) => carries(text)).map(([where]) => where), [], 'and its children still do not carry the opt-in');
    assert.match(relaunched.fromTerminal, REFUSED);
    assert.equal(near.connections(), 2, 'only the dev app and its relaunch reached the server');
    assert.equal(fs.readFileSync(starts, 'utf8').trim().split('\n').length, 2, 'the stand-in acts once per Electron main start: the dev app and its relaunch');
  } finally { await near.close(); }
});

test('the opt-in reached any other way refuses: an environment variable by its name, the flag on a node process, a setting', ROW, async () => {
  const { near, env, started } = await ambient();
  try {
    const rows = [
      ['an environment variable named like the flag', { ...env, [NAMES[1].toUpperCase()]: 'npm-start', [NAMES[1]]: '1', [NAMES[0]]: '1' }, [], IMPORT],
      ['the flag on a plain node process', env, [FLAG], IMPORT],
      ['the flag on Electron run as node', { ...env, ELECTRON_RUN_AS_NODE: '1' }, [FLAG], IMPORT],
      ['relaunch args built by a process that was not opted in', env, [FLAG], `const args = require(APP + '/main/cli-spawn.js').relaunchArgs(); if (args.includes(${JSON.stringify(FLAG)})) return args; ${IMPORT}`],
      ['a setting carrying it', env, [], `return barkpark().cliListAllPapers({ enabled: true, ${SWITCH}: true, server: process.env.AMBIENT, dataset: 'production', ${JSON.stringify(NAMES[0])}: true });`],
    ];
    for (const [label, rowEnv, argv, code] of rows) {
      const run = await route(code, rowEnv, argv);
      assert.match(run.stderr + run.stdout, REFUSED, `${label}: ${run.stdout}`);
    }
    assert.equal(near.connections(), 0); assert.deepEqual(started(), []);
  } finally { await near.close(); }
});

// Every place app/main starts a child process, found by reading the code.
const SITE = /\b(spawn|spawnSync|fork|execFile|execFileSync|exec|execSync)\s*\(|\.spawn\s*\(|utilityProcess\.fork\s*\(|new\s+Worker\s*\(|\.relaunch\s*\(/g;
// The one site allowed to forward this process's command line: the main process's own relaunch, which gets
// the flag back only when this process was started with it. The list may only shrink.
const FORWARDS = ['app/main/main.js: app.relaunch({ args: relaunchArgs() })'];
const walk = (dir, out = []) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, out); else if (/\.(c|m)?js$/.test(entry.name)) out.push(full); } return out; };

test('no child app/main starts can carry the opt-in: none forwards argv, none names it, and main.js drops it before any module starts one', ROW, () => {
  const sites = [];
  for (const file of walk(path.join(appDir, 'main'))) {
    const text = fs.readFileSync(file, 'utf8'), name = path.relative(repo, file).split(path.sep).join('/');
    for (const match of text.matchAll(SITE)) sites.push({ site: `${name}:${text.slice(0, match.index).split('\n').length}`, call: text.slice(match.index, match.index + 600), name, text });
  }
  assert.ok(sites.length > 30, `found ${sites.length} child-process sites`);
  const forwarding = sites.filter(({ call }) => /process\.(exec)?argv|relaunchArgs|\.relaunch\s*\(/.test(call.split('\n')[0]));
  assert.deepEqual(forwarding.map(({ name, call }) => `${name}: ${call.split(';')[0].replace(/^\.?/, 'app.')}`), FORWARDS, 'a site forwards this process\'s command line');
  assert.equal(FORWARDS.length, 1);
  assert.deepEqual([...new Set(sites.filter(({ name, text }) => name !== 'app/main/cli-spawn.js' && carries(text)).map(({ name }) => name))], [], 'a file that starts children names the opt-in');
  const main = fs.readFileSync(path.join(appDir, 'main/main.js'), 'utf8');
  assert.equal(main.match(/require\('\.\/[^']+'\)/)?.[0], "require('./cli-spawn')", 'main.js loads cli-spawn.js before any other module of its own');
});

test('the opt-in is named only by app/scripts/start.mjs and app/main/cli-spawn.js, across every file in the repo', ROW, () => {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8', maxBuffer: 256e6 }).split('\0').filter(Boolean);
  assert.ok(files.includes('.github/workflows/verify.yml') && files.includes('app/tests/cli-fence-optin.test.mjs'), 'the walk covers workflows and tests');
  // Pictures and video are skipped: a name in them would reach no process.
  const naming = files.filter(file => !/\.(png|gif|jpe?g|webp|ico|icns|mp4|webm)$/i.test(file)).filter(file => { try { return carries(fs.readFileSync(path.join(repo, file)).toString('latin1')); } catch { return false; } });
  assert.deepEqual(naming.sort(), ['app/main/cli-spawn.js', 'app/scripts/start.mjs']);
  assert.match(fs.readFileSync(path.join(appDir, 'scripts/start.mjs'), 'utf8'), new RegExp(`spawn\\(electron, \\['\\.', '${FLAG}', \\.\\.\\.passThrough\\]`), 'start.mjs passes it as a flag, not in the environment');
});
