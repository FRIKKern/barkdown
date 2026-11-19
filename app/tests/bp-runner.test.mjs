// A run may send bp traffic only to the Barkpark it started itself (tests/lib/bp-runner.mjs).
// `bp` here is a stub on PATH that records every call; the address it would reach is a made-up
// outside host or a closed local port. "Nothing sent" means the stub was never started.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(appDir);
const runner = pathToFileURL(path.join(appDir, 'tests/lib/bp-runner.mjs')).href;
const OUTSIDE = 'http://barkpark-outside.invalid:4000';
const ESCAPE = ['BARKDOWN', 'ALLOW', 'REMOTE', 'FIXTURE'].join('_'); // the removed override, spelled so this file does not carry it

function stub() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-runner-stub-'));
  const hits = path.join(dir, 'hits.jsonl');
  fs.writeFileSync(path.join(dir, 'bp-stub.cjs'), `
    const fs = require('fs'), e = process.env;
    const bpEnv = Object.fromEntries(Object.entries(e).filter(([k]) => /^(BARKPARK|BP)_/i.test(k)));
    fs.appendFileSync(${JSON.stringify(hits)}, JSON.stringify({ argv: process.argv.slice(2), bpEnv, config: e.XDG_CONFIG_HOME, cwd: process.cwd() }) + '\\n');
    if (/^http:\\/\\/127\\.0\\.0\\.1:/.test(e.BARKPARK_API_URL || '')) { process.stdout.write(JSON.stringify({ server: e.BARKPARK_API_URL, dataset: e.BARKPARK_DATASET })); process.exit(0); }
    process.stderr.write('stub bp: refusing to pretend to be ' + (e.BARKPARK_API_URL || 'the saved server')); process.exit(1);
  `);
  if (process.platform === 'win32') fs.writeFileSync(path.join(dir, 'bp.cmd'), `@"${process.execPath}" "%~dp0bp-stub.cjs" %*\r\n`);
  else { fs.writeFileSync(path.join(dir, 'bp'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(dir, 'bp-stub.cjs')}" "$@"\n`); fs.chmodSync(path.join(dir, 'bp'), 0o755); }
  // A saved CLI config that names the outside server, as a person's own machine would have.
  const savedConfig = path.join(dir, 'saved-config');
  fs.mkdirSync(path.join(savedConfig, 'barkpark'), { recursive: true });
  fs.writeFileSync(path.join(savedConfig, 'barkpark', 'config.json'), JSON.stringify({ server: OUTSIDE, token: 'saved-token', dataset: 'production' }));
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!/^(BARKPARK_|BP_|BARKDOWN_OWNED_RUNTIME$|BARKDOWN_SHOTS_)/i.test(key)) env[key] = value;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = dir + path.delimiter + (env[pathKey] || '');
  Object.assign(env, {
    BARKPARK_API_URL: OUTSIDE, BARKPARK_API_TOKEN: 'outside-token', BARKPARK_SERVER: OUTSIDE, BARKPARK_URL: OUTSIDE, BARKPARK_TOKEN: 'outside-token',
    BARKPARK_SESSION: 'outside-session', BARKPARK_CONTROL_URL: OUTSIDE, BARKPARK_WORKSPACE: 'elsewhere', BARKPARK_PROJECT: 'elsewhere', BARKPARK_DATASET: 'elsewhere', BP_THEME: 'outside',
    XDG_CONFIG_HOME: savedConfig, [ESCAPE]: '1', BARKDOWN_PROVIDER: 'api',
  });
  const calls = () => fs.existsSync(hits) ? fs.readFileSync(hits, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  return { dir, env, calls, savedConfig };
}

const run = (args, env) => spawnSync(process.execPath, args, { cwd: appDir, env, encoding: 'utf8', timeout: 60000 });
let records = 0;
const record = (dir, fields) => { const file = path.join(dir, `owned-runtime-${++records}.json`); fs.writeFileSync(file, JSON.stringify({ token: 'owned-token', dataset: 'production', ...fields })); return file; };

for (const suite of ['tests/status-shots.mjs', 'tests/editor-tables.live.mjs', 'tests/editor.live.mjs']) {
  test(`${suite} refuses a server this run did not start, before any bp call`, () => {
    const { env, calls } = stub();
    const result = run([suite], env);
    assert.notEqual(result.status, 0, 'the suite must stop');
    assert.deepEqual(calls(), [], `bp was started ${calls().length} time(s) towards a server this run did not start`);
    assert.match(result.stderr, /Refusing to run bp: this run started no Barkpark of its own/);
  });
}

test('a stray local server, a stopped one or an outside one is refused; only the recorded live server is reached', () => {
  const { dir, env, calls, savedConfig } = stub();
  const call = (file, args = ['whoami']) => run(['--input-type=module', '-e', `import { runOwned } from ${JSON.stringify(runner)}; console.log(JSON.stringify(runOwned(${JSON.stringify(args)})));`], { ...env, ...(file ? { BARKDOWN_OWNED_RUNTIME: file } : {}) });
  const stopped = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).stdout.trim();
  const refusals = [
    [null, /started no Barkpark of its own/],
    [path.join(dir, 'missing.json'), /cannot be read/],
    [record(dir, { server: OUTSIDE, pid: process.pid }), /not a loopback address/],
    [record(dir, { server: 'https://127.0.0.1:9', pid: process.pid }), /not a loopback address/],
    [record(dir, { server: 'http://127.0.0.1', pid: process.pid }), /not a loopback address/],
    [record(dir, { server: 'http://127.0.0.1:9@barkpark-outside.invalid:4000', pid: process.pid }), /not a loopback address/],
    [record(dir, { server: 'http://127.0.0.1:9', pid: Number(stopped) }), /not running/],
    [record(dir, { server: 'http://127.0.0.1:9', pid: process.pid, token: '' }), /no token or dataset/],
  ];
  for (const [file, reason] of refusals) {
    const result = call(file);
    assert.notEqual(result.status, 0, String(reason));
    assert.match(result.stderr, reason);
  }
  assert.deepEqual(calls(), [], 'no refused case may start bp');
  const own = record(dir, { server: 'http://127.0.0.1:9/', pid: process.pid, configHome: path.join(dir, 'cli-config') });
  for (const [args, flag] of [[['-s', OUTSIDE, 'whoami'], '-s'], [[`--server=${OUTSIDE}`, 'whoami'], '--server'], [['whoami', '--token', 'outside-token'], '--token']]) {
    const routed = call(own, args);
    assert.notEqual(routed.status, 0); assert.match(routed.stderr, new RegExp(`may not choose its own destination \\(${flag}`));
  }
  assert.deepEqual(calls(), [], 'a call that names its own destination is refused before bp starts');
  const pinned = { BARKPARK_API_URL: 'http://127.0.0.1:9', BARKPARK_API_TOKEN: 'owned-token', BARKPARK_DATASET: 'production', BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default' };
  const accepted = call(own);
  assert.equal(accepted.status, 0, accepted.stderr);
  const [hit] = calls();
  assert.deepEqual(hit.argv, ['whoami', '-o', 'json']);
  assert.deepEqual(hit.bpEnv, pinned, 'every server, token, session and routing variable from the shell is dropped');
  assert.equal(hit.config, path.join(dir, 'cli-config'), 'the saved CLI config is not read');
  assert.ok(!path.resolve(hit.cwd).startsWith(repo + path.sep), 'bp runs outside any checkout, so no repository context file applies');
  const withoutConfig = record(dir, { server: 'http://127.0.0.1:9', pid: process.pid });
  assert.equal(call(withoutConfig).status, 0);
  const second = calls()[1];
  assert.deepEqual(second.bpEnv, pinned);
  assert.notEqual(second.config, savedConfig); assert.deepEqual(fs.readdirSync(second.config), [], 'with no private config the runner gives bp an empty one');
});

// The scan below is the guard for the next suite: anything under app/tests, app/scripts or scripts that
// could start bp itself. It strips comments, then flags
//   * a string that is bp or a path to it ('bp', '/usr/local/bin/bp', 'bp.exe'): spawn, execFile, fork,
//     a helper that takes the command as an argument, a symlinked copy;
//   * a string that runs bp as a shell command ('bp doc ...', 'cd x && bp ...', '$(bp whoami)'): exec,
//     execSync, shell strings;
//   * a bp command line in a shell script, and a bp command in any package.json script;
//   * a suite that launches the app and tells it to use bp (viaCli: true) without going through the
//     runner (its check, a fixture publish that runs it, or unreachableBarkpark for the app's env).
// Known limit: a command name built at run time ('b' + 'p', or read from a variable) is not seen.
const BP_WORD = String.raw`(\S*[\/\\])?bp(\.exe|\.cmd)?`;
const BP_STRING = new RegExp(`^${BP_WORD}$`);
const BP_COMMAND = new RegExp(String.raw`(^|[;&|(]\s*|\$\(\s*|\bnpx\s+)${BP_WORD}(\s|$)`);
const STRINGS = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
// Files that name bp without starting it, each with its reason.
const NAMES_WITHOUT_STARTING = new Map([
  ['app/tests/paper-catalog.test.mjs', 'compares the command name the app passed to a recording mock'],
  ['scripts/demo-names.cjs', 'matches calls to a function named bp in a syntax tree'],
]);
function scan(name, text) {
  const found = [];
  if (name.endsWith('.sh')) {
    text.split('\n').forEach((line, i) => { if (!/^\s*#/.test(line) && BP_COMMAND.test(line.trim())) found.push(`${name}:${i + 1}`); });
    return found;
  }
  const code = text.replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '');
  for (const match of code.matchAll(STRINGS)) {
    const body = match[0].slice(1, -1);
    if (BP_STRING.test(body) || BP_COMMAND.test(body)) found.push(`${name}:${code.slice(0, match.index).split('\n').length}`);
  }
  if (/viaCli\s*:\s*true/.test(code) && /_electron|electron\.launch/.test(code) && !/bp-runner\.mjs|\b(connectPaperFixture|publishFixture|getPaper|ensureTags|paperFixtureScope)\(/.test(code)) found.push(`${name}: the app is told to use bp without the runner's check`);
  return found;
}
const scanScripts = (name, scripts) => Object.entries(scripts || {}).filter(([, command]) => command.split(/&&|\|\||;|\|/).some(part => BP_COMMAND.test(part.trim()))).map(([key]) => `${name}#${key}`);

test('the scan sees each way a file could start bp itself', () => {
  const planted = {
    'spawn.mjs': "spawn('bp', ['whoami']);", 'execFile.mjs': 'execFileSync("bp", args);', 'fork.cjs': "child.fork(`bp`)",
    'exec.mjs': "execSync('bp doc get paper x');", 'shell.mjs': "execSync(`cd ${dir} && bp bulldocs publish x`);", 'subshell.mjs': "exec('echo $(bp whoami)');",
    'helper.mjs': "run('bp', ['doc']);", 'variable.mjs': "const command = 'bp'; spawn(command, args);", 'path.mjs': "spawn('/usr/local/bin/bp', args);",
    'symlink.mjs': "fs.symlinkSync(which, path.join(dir, 'bp'));", 'windows.mjs': "spawn('bp.exe', args);", 'npx.mjs': "execSync('npx bp whoami');",
    'script.sh': 'set -e\nbp whoami -o json\n', 'piped.sh': 'echo x | bp doc patch\n', 'app.live.mjs': "electron.launch(o); settings.set({ barkpark: { viaCli: true } });",
  };
  for (const [name, text] of Object.entries(planted)) assert.notDeepEqual(scan(name, text), [], name);
  assert.deepEqual(scanScripts('package.json', { a: 'bp whoami', b: 'npm run build && bp doc get x', c: 'node x.mjs | bp doc patch' }), ['package.json#a', 'package.json#b', 'package.json#c']);
  const harmless = {
    'comment.mjs': "// run `bp use local` first\n/* bp whoami */\nconst id = 'bp:drafts.x';", 'words.mjs': "const s = 'a bp b'; const t = 'bp-paper-canvas'; const u = 'bpx';",
    'comment.sh': '# bp whoami\necho done\n', 'guarded.live.mjs': "import { ownedRuntime } from './lib/bp-runner.mjs'; settings.set({ barkpark: { viaCli: true } });", 'mocked.test.mjs': "const config = { viaCli: true };",
  };
  for (const [name, text] of Object.entries(harmless)) assert.deepEqual(scan(name, text), [], name);
  assert.deepEqual(scanScripts('package.json', { shots: 'npm run build && node tests/status-shots-isolated.mjs', bpx: 'node bp-runner.test.mjs' }), []);
});

test('bp is started only by the runner, nothing reads the old override, and `npm run shots` is the isolated route', () => {
  const files = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (entry.name === 'node_modules' || entry.name === 'test-results') continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(mjs|cjs|js|sh)$/.test(entry.name)) files.push(full); } };
  for (const dir of ['app/tests', 'app/scripts', 'scripts']) if (fs.existsSync(path.join(repo, dir))) walk(path.join(repo, dir));
  const rel = file => path.relative(repo, file).split(path.sep).join('/');
  const own = new Set(['app/tests/lib/bp-runner.mjs', 'app/tests/bp-runner.test.mjs']);
  const found = files.filter(file => !own.has(rel(file)) && !NAMES_WITHOUT_STARTING.has(rel(file))).flatMap(file => scan(rel(file), fs.readFileSync(file, 'utf8')));
  assert.deepEqual(found, [], 'start bp through app/tests/lib/bp-runner.mjs');
  const manifests = { 'package.json': path.join(repo, 'package.json'), 'app/package.json': path.join(appDir, 'package.json') };
  for (const [name, file] of Object.entries(manifests)) assert.deepEqual(scanScripts(name, JSON.parse(fs.readFileSync(file, 'utf8')).scripts), []);
  const escape = files.concat(Object.values(manifests), path.join(repo, 'scripts/check.cjs')).filter(file => fs.readFileSync(file, 'utf8').includes(ESCAPE));
  assert.deepEqual(escape.map(rel), []);
  const scripts = JSON.parse(fs.readFileSync(manifests['app/package.json'], 'utf8')).scripts;
  assert.match(scripts.shots, /node tests\/status-shots-isolated\.mjs$/);
  for (const [name, command] of Object.entries(scripts)) assert.doesNotMatch(command, /node tests\/status-shots\.mjs/, `${name} runs status shots outside the isolated runtime`);
});

test("a suite without a Barkpark gives the app's bp nowhere to go", async () => {
  const { unreachableBarkpark } = await import(runner);
  const env = unreachableBarkpark({ PATH: 'p', BARKPARK_API_URL: OUTSIDE, BARKPARK_SERVER: OUTSIDE, BARKPARK_SESSION: 's', BP_THEME: 't', XDG_CONFIG_HOME: '/saved' });
  assert.deepEqual(Object.keys(env).filter(name => /^(BARKPARK|BP)_/i.test(name)).sort(), ['BARKPARK_API_TOKEN', 'BARKPARK_API_URL', 'BARKPARK_DATASET', 'BARKPARK_PROJECT', 'BARKPARK_WORKSPACE']);
  assert.equal(env.BARKPARK_API_URL, 'http://127.0.0.1:9'); assert.equal(env.PATH, 'p');
  assert.notEqual(env.XDG_CONFIG_HOME, '/saved'); assert.deepEqual(fs.readdirSync(env.XDG_CONFIG_HOME), []);
});
