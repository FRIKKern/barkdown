// A run may send CLI traffic only to the Barkpark it started itself (tests/lib/bp-runner.mjs).
// The CLI here is a stub on PATH that records every start. Aimed at a loopback address, it makes a real
// request there, so a listener counts what actually arrives. This file never spells the command's name
// (tests/lib/cli-stub.mjs builds it as CLI), so the tree scan at the end holds for this file too.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROUTING_FLAGS, OTHER_GLOBAL_FLAGS, cliGlobalFlags, unreachableBarkpark } from './lib/bp-runner.mjs';
import { CLI, OUTSIDE, ESCAPE, ROUTING_ENV, stub, listener, record, asStubSees } from './lib/cli-stub.mjs';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(appDir);
const runner = pathToFileURL(path.join(appDir, 'tests/lib/bp-runner.mjs')).href;
const SWITCH_KEY = ['via', 'Cli'].join('');

// Runs each argument list through the runner in one child; per list, the result or the error message.
function viaRunner(env, file, argLists) {
  const code = `import { runOwned } from ${JSON.stringify(runner)}; const out = []; for (const args of ${JSON.stringify(argLists)}) { try { out.push({ ok: runOwned(args) }); } catch (e) { out.push({ error: String(e.message) }); } } console.log(JSON.stringify(out));`;
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: appDir, env: { ...env, ...(file ? { BARKDOWN_OWNED_RUNTIME: file } : {}) } });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
    child.on('close', () => { let results = null; try { results = JSON.parse(stdout.trim().split('\n').pop()); } catch {} resolve({ results, stderr }); });
  });
}

for (const suite of ['tests/status-shots.mjs', 'tests/editor-tables.live.mjs', 'tests/editor.live.mjs']) {
  test(`${suite} refuses a server this run did not start, before any CLI call`, () => {
    const { env, started } = stub();
    const result = spawnSync(process.execPath, [suite], { cwd: appDir, env, encoding: 'utf8', timeout: 60000 });
    assert.notEqual(result.status, 0, 'the suite must stop');
    assert.deepEqual(started(), [], `the CLI was started ${started().length} time(s) towards a server this run did not start`);
    assert.match(result.stderr, /Refusing to run bp: this run started no Barkpark of its own/);
  });
}

test('a missing, outside, stopped or incomplete record is refused; only the recorded live server is reached, with a pinned environment', async () => {
  const { dir, env, started, savedConfig } = stub();
  const own = await listener();
  try {
    const stopped = Number(spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).stdout.trim());
    for (const [file, reason] of [
      [null, /started no Barkpark of its own/],
      [path.join(dir, 'missing.json'), /cannot be read/],
      [record(dir, { server: OUTSIDE, pid: process.pid }), /not a loopback address/],
      [record(dir, { server: 'https://127.0.0.1:9', pid: process.pid }), /not a loopback address/],
      [record(dir, { server: 'http://127.0.0.1', pid: process.pid }), /not a loopback address/],
      [record(dir, { server: 'http://127.0.0.1:9@barkpark-outside.invalid:4000', pid: process.pid }), /not a loopback address/],
      [record(dir, { server: own.url, pid: stopped }), /not running/],
      [record(dir, { server: own.url, pid: process.pid, token: '' }), /no token or dataset/],
    ]) assert.match((await viaRunner(env, file, [['whoami']])).results[0].error, reason);
    assert.deepEqual(started(), [], 'no refused record may start the CLI');
    assert.equal(own.connections(), 0);
    const pinned = { BARKPARK_API_URL: own.url, BARKPARK_API_TOKEN: 'owned-token', BARKPARK_DATASET: 'production', BARKPARK_WORKSPACE: 'default', BARKPARK_PROJECT: 'default' };
    const accepted = await viaRunner(env, record(dir, { server: own.url + '/', pid: process.pid, configHome: path.join(dir, 'cli-config') }), [['whoami']]);
    assert.deepEqual(accepted.results, [{ ok: { server: own.url, dataset: 'production' } }], accepted.stderr);
    const [hit] = started();
    assert.deepEqual(hit.argv, asStubSees(['whoami', '-o', 'json']));
    assert.deepEqual(hit.cliEnv, pinned, 'every server, token, session and routing variable from the shell is dropped');
    assert.equal(hit.config, path.join(dir, 'cli-config'), 'the saved CLI config is not read');
    assert.ok(!path.resolve(hit.cwd).startsWith(repo + path.sep), 'the CLI runs outside any checkout, so no repository context file applies');
    assert.deepEqual((await viaRunner(env, record(dir, { server: own.url, pid: process.pid }), [['whoami']])).results, [{ ok: { server: own.url, dataset: 'production' } }]);
    const second = started()[1];
    assert.deepEqual(second.cliEnv, pinned);
    assert.notEqual(second.config, savedConfig); assert.deepEqual(fs.readdirSync(second.config), [], 'with no private config the runner gives the CLI an empty one');
  } finally { await own.close(); }
});

test('every routing flag is refused before the CLI starts, bare, inline or glued', async () => {
  const { dir, env, started } = stub();
  const own = await listener(), stray = await listener();
  try {
    const routed = ROUTING_FLAGS.flatMap(flag => [[flag, stray.url, 'whoami'], ['whoami', `${flag}=${stray.url}`], [`${flag}${stray.url}`, 'whoami']]);
    const refused = await viaRunner(env, record(dir, { server: own.url, pid: process.pid }), routed);
    assert.deepEqual(routed.filter((args, i) => !/may not choose its own destination/.test(refused.results[i].error || '')), [], 'these calls were not refused');
    assert.deepEqual(started(), [], 'a call that names its own destination is refused before the CLI starts');
    assert.equal(stray.connections(), 0);
  } finally { await own.close(); await stray.close(); }
});

test('one argument cannot carry a destination past the check: a destination inside one argument is refused, shell syntax stays literal', async () => {
  const { dir, env, started } = stub();
  const own = await listener(), stray = await listener();
  try {
    const file = record(dir, { server: own.url, pid: process.pid });
    const smuggled = [[`whoami -s ${stray.url}`], ['whoami', `$(${CLI} -s ${stray.url} whoami >&2)`], ['whoami', `\`${CLI} -s ${stray.url} whoami\``]];
    const refused = await viaRunner(env, file, smuggled);
    assert.deepEqual(refused.results.map(r => /names another server/.test(r.error || '')), smuggled.map(() => true), 'the spawn function refuses an argument naming another server');
    const marker = path.join(dir, 'shell-ran');
    const literal = [['whoami', `$(node -e "require('fs').writeFileSync('${marker}','')")`], ['whoami', `\`touch ${marker}\``]];
    await viaRunner(env, file, literal);
    assert.equal(stray.connections(), 0, 'a listener this run did not record sees no connection');
    assert.equal(fs.existsSync(marker), false, 'no shell read the arguments');
    assert.deepEqual(started().map(hit => hit.argv), literal.map(args => asStubSees([...args, '-o', 'json'])), 'each argument reaches the CLI as one literal argument, and nothing else starts');
  } finally { await own.close(); await stray.close(); }
});

test("the runner's flag lists match the global flags the installed CLI reports", async t => {
  // The completion script reads no server, but the CLI starts only through the fence: record a listener this test owns.
  const own = await listener(), prior = process.env.BARKDOWN_OWNED_RUNTIME;
  process.env.BARKDOWN_OWNED_RUNTIME = record(stub().dir, { server: own.url, pid: process.pid });
  let flags;
  try { flags = cliGlobalFlags(); } finally {
    if (prior === undefined) delete process.env.BARKDOWN_OWNED_RUNTIME; else process.env.BARKDOWN_OWNED_RUNTIME = prior;
    await own.close();
  }
  if (!flags) {
    assert.ok(!process.env.BARKDOWN_REQUIRE_CLI_FLAGS, 'this job builds the CLI, so it must be on PATH');
    return t.skip('the CLI is not installed here');
  }
  assert.deepEqual([...new Set(flags)].sort(), [...ROUTING_FLAGS, ...OTHER_GLOBAL_FLAGS].sort(), 'sort each new global flag into ROUTING_FLAGS or OTHER_GLOBAL_FLAGS');
});

// The tree scan reads raw text, line by line, with no parsing. A finding is
//   * the CLI's name in any case with no letter, digit, _ or - on either side and not followed by ':'
//     (a custom element with that prefix, the runner's own file name and a library id are other words);
//   * the app setting that makes the app start the CLI itself, unless written exactly as the key, ': false'
//     and then optional spaces and ',', '}' or the end of the line.
// It covers every file under app/tests, app/scripts and scripts except the runner, and every npm script.
const WORD = new RegExp(`(?<![A-Za-z0-9_-])${CLI}(?![A-Za-z0-9_:-])`, 'i');
const SWITCH = new RegExp(`${SWITCH_KEY}(?!: false\\s*(,|\\}|$))`, 'i');
const lineHash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const scan = (name, text) => text.split(/\r?\n/).flatMap((line, i) => WORD.test(line) || SWITCH.test(line) ? [{ name, line: i + 1, hash: lineHash(line) }] : []);
const scanScripts = (name, scripts) => Object.entries(scripts || {}).flatMap(([key, command]) => scan(`${name}#${key}`, command));

// The lines that may carry a finding: file, the SHA-256 of the line's exact text (first 16 hex), and why.
// Each entry admits one line. The list only shrinks; a new entry needs the lane lead's ruling and the count.
const GUARDED = "a live suite that sets the app to use the CLI only after the runner's check (runOwned, publishFixture or ownedRuntime) accepted this run's own server";
const UNIT = 'a unit test: a settings value handed to mocked or injected functions; it launches no app and starts no CLI';
const ALLOWED = [
  ['app/tests/adoption-ui.live.mjs', 'd3b29f47020b46a5', 'legacy settings for an app whose environment is unreachableBarkpark()'], // line 13
  ['app/tests/ci/boot-barkpark.sh', 'c569b5157c5d8fd0', 'builds the CLI binary under its own name for the CI server'], // line 19
  ['app/tests/conversations.test.mjs', 'ec4e380c82ec1b57', UNIT], // line 57
  ['app/tests/conversations.test.mjs', 'fba6950bd9bc67ac', "compares the app's own wording about the CLI"], // line 58
  ['app/tests/lib/paper-fixture.mjs', '073664891d046e02', GUARDED], // line 59
  ['app/tests/paper-agent-takeover.live.mjs', 'c0618d695d682687', GUARDED], // line 22
  ['app/tests/paper-agent-takeover.live.mjs', '3a3871d38a13a737', GUARDED], // line 34
  ['app/tests/paper-agent-takeover.live.mjs', '5931e8e2190ffbc9', GUARDED], // line 49
  ['app/tests/paper-block-identity.live.mjs', 'b34daec4803e5417', GUARDED], // line 30
  ['app/tests/paper-callouts.live.mjs', 'b34daec4803e5417', GUARDED], // line 22
  ['app/tests/paper-catalog.test.mjs', '6974a2bf91352aec', 'compares the command name the app passed to a recording mock'], // line 32
  ['app/tests/paper-connection.live.mjs', '13618e975193c3f6', GUARDED], // line 50
  ['app/tests/paper-connection.live.mjs', '8e1e1fab4711d16c', GUARDED], // line 52
  ['app/tests/paper-connection.test.mjs', 'bacb33b9431f7749', UNIT], // line 15
  ['app/tests/paper-connection.test.mjs', 'bad589966d700188', UNIT], // line 41
  ['app/tests/paper-connection.test.mjs', '203966e03af4f9e2', UNIT], // line 47
  ['app/tests/paper-evidence-owner.live.mjs', '24d01636bfb966f1', GUARDED], // line 59
  ['app/tests/paper-evidence-owner.live.mjs', 'a2d0b5d3963d2ac8', GUARDED], // line 60
  ['app/tests/paper-evidence-owner.live.mjs', '10006c28c077caa8', GUARDED], // line 77
  ['app/tests/paper-evidence-owner.live.mjs', 'aeaca718966eb107', GUARDED], // line 83
  ['app/tests/paper-evidence-owner.test.mjs', '6149e50d26e500a5', UNIT], // line 30
  ['app/tests/paper-host.live.mjs', 'c0618d695d682687', GUARDED], // line 25
  ['app/tests/paper-html-table-paste.live.mjs', 'b34daec4803e5417', GUARDED], // line 25
  ['app/tests/paper-markdown-paste.live.mjs', 'b34daec4803e5417', GUARDED], // line 25
  ['app/tests/paper-navigation.test.mjs', 'e1738041fb906208', UNIT], // line 12
  ['app/tests/paper-origin.test.mjs', 'e741c5e572e3ac2a', UNIT], // line 12
  ['app/tests/paper-rich-clipboard.live.mjs', 'b34daec4803e5417', GUARDED], // line 31
  ['app/tests/paper-rich-takeover.live.mjs', 'b34daec4803e5417', GUARDED], // line 41
  ['app/tests/paper-rich-takeover.live.mjs', '0308e921b7893e7c', GUARDED], // line 55
  ['app/tests/paper-shot.mjs', '42793c170b351ffc', GUARDED], // line 17
  ['app/tests/paper-structured-table.live.mjs', 'b34daec4803e5417', GUARDED], // line 35
  ['app/tests/paper-upload-history.live.mjs', 'b34daec4803e5417', GUARDED], // line 31
  ['app/tests/portabledoc.test.mjs', 'be1694d4448c6047', UNIT], // line 74
  ['app/tests/profile-runtime.test.mjs', '0d5b35bcb1e36d3e', UNIT], // line 40
  ['app/tests/run-ownership.test.mjs', '22a08c59accc28d6', UNIT], // line 95
  ['app/tests/status-shots.mjs', '217727e1869ef9ec', GUARDED], // line 68
];
const ALLOWED_COUNT = 36;
const allowedKey = ({ name, hash }) => `${name}\n${hash}`;
const allowed = new Map(ALLOWED.map(([name, hash, reason]) => [`${name}\n${hash}`, reason]));
// Findings the allow list does not admit: unlisted lines, and every copy past the first of a listed line.
const unadmitted = found => { const seen = new Set(); return found.filter(hit => { const key = allowedKey(hit); if (!allowed.has(key) || seen.has(key)) return true; seen.add(key); return false; }); };

test('the scan flags each planted start and leaves look-alikes alone; its stated limits stay misses', () => {
  const red = {
    'spawn.mjs': `spawn('${CLI}', ['whoami']);`, 'upper.mjs': `spawn('${CLI.toUpperCase()}', args);`, 'double.mjs': `execFileSync("${CLI}", args);`, 'fork.cjs': `child.fork(\`${CLI}\`)`,
    'dot-slash.mjs': `spawn('./${CLI}', args);`, 'path.mjs': `spawn('/usr/local/bin/${CLI}', args);`, 'cmd.mjs': `spawn('${CLI}.cmd', args);`, 'exe.mjs': `spawn('${CLI}.exe', args);`,
    'line-start.sh': `${CLI} whoami -o json`, 'env-prefix.mjs': `execSync('BARKPARK_DATASET=production ${CLI} whoami');`, 'env.sh': `BARKPARK_DATASET=production ${CLI} whoami`,
    'if.sh': `if ${CLI} whoami -o json; then echo ok; fi`, 'backtick.sh': `who=\`${CLI} whoami -o json\``, 'exec.sh': `exec ${CLI} whoami`, 'piped.sh': `echo x | ${CLI} doc patch`,
    'time.mjs': `spawnSync('sh', ['-c', 'time ${CLI} whoami']);`, 'which.mjs': `execSync('$(which ${CLI}) whoami');`, 'xargs.mjs': `execSync('echo whoami | xargs ${CLI}');`,
    'regex-quote.mjs': `const q = s => s.replace(/'/g, ''); spawn('${CLI}', args);`, 'glob.mjs': `const a = 'app/tests/*.mjs'; spawn('${CLI}', args); const b = 'docs/**/x.md';`,
    'comment.mjs': `// ${CLI} whoami`, 'npx.mjs': `execSync('npx ${CLI} whoami');`, 'helper.mjs': `run('${CLI}', ['doc']);`, 'x.ps1': `& ${CLI} whoami`, 'x.exs': `System.cmd("${CLI}", ["whoami"])`,
    'settings.mjs': `settings.set({ barkpark: { ${SWITCH_KEY}: true } });`, 'quoted.mjs': `settings.set({ barkpark: { '${SWITCH_KEY}': true } });`, 'nospace.mjs': `({ ${SWITCH_KEY}:false })`,
    'or.mjs': `({ ${SWITCH_KEY}: false || true })`, 'ternary.mjs': `({ ${SWITCH_KEY}: false ? a : b })`, 'line-break.mjs': `({ ${SWITCH_KEY}:\n  true })`,
    'spread.mjs': `const c = { ${SWITCH_KEY}: true }; settings.set({ barkpark: { ...c } });`, 'variable.mjs': `const on = true; settings.set({ barkpark: { ${SWITCH_KEY}: on } });`,
  };
  for (const [name, text] of Object.entries(red)) assert.notDeepEqual(scan(name, text), [], name);
  for (const command of [`${CLI} whoami`, `BARKPARK_DATASET=production ${CLI} whoami`, `env ${CLI} whoami`, `npm run build && ${CLI} doc get x`, `node x.mjs | ${CLI} doc patch`]) assert.equal(scanScripts('package.json', { planted: command }).length, 1, command);
  // A start appended to a file with an allowed line, a second copy of an allowed line, and an allowed line's
  // exact text in another file are all findings.
  const catalog = 'app/tests/paper-catalog.test.mjs', catalogText = fs.readFileSync(path.join(repo, catalog), 'utf8');
  assert.equal(unadmitted(scan(catalog, catalogText + `\nexecFileSync('${CLI}', ['whoami']);\n`)).length, 1);
  const allowedLine = catalogText.split(/\r?\n/).find(line => WORD.test(line));
  assert.equal(unadmitted(scan(catalog, catalogText + '\n' + allowedLine + '\n')).length, 1);
  assert.equal(unadmitted(scan('app/tests/zz-plant.test.mjs', allowedLine)).length, 1);
  const clean = {
    'element.mjs': `document.querySelector('${CLI}-paper-canvas');`, 'runner-path.mjs': `import { runOwned } from './lib/${CLI}-runner.mjs';`, 'id.mjs': `const id = '${CLI}:' + slug; /id="${CLI}:[^"]+"/;`,
    'env-name.mjs': 'const theme = process.env.BP_THEME;', 'longer.mjs': `const u = '${CLI}x'; const v = 'x${CLI}';`,
    'off.mjs': `({ ${SWITCH_KEY}: false, writes: true }); ({ ${SWITCH_KEY}: false }); const c = { ${SWITCH_KEY}: false\n};`,
  };
  for (const [name, text] of Object.entries(clean)) assert.deepEqual(scan(name, text), [], name);
  // Stated limits, pinned as misses so the PR's list stays true: a name built at run time, a copy or link of
  // the CLI under another name, a computed setting key, and a false value continued on the next line.
  const limits = {
    'built.mjs': "spawn('b' + 'p', ['whoami']);", 'renamed.mjs': `fs.symlinkSync(found, '${CLI}-copy'); spawn('./${CLI}-copy', ['whoami']);`,
    'computed.mjs': "settings.set({ barkpark: { ['via' + 'Cli']: true } });", 'continued.mjs': `({ ${SWITCH_KEY}: false\n  || true })`,
  };
  for (const [name, text] of Object.entries(limits)) assert.deepEqual(scan(name, text), [], `${name} is a stated limit`);
  // A pinned guarded line whose guard is deleted still passes the scan (the pin keys the line, not its guard).
  // The app's CLI start is then refused at run time by app/main/cli-spawn.js (tests/cli-fence.test.mjs).
  const host = 'app/tests/paper-host.live.mjs', hostText = fs.readFileSync(path.join(repo, host), 'utf8');
  const unguarded = hostText.split(/\r?\n/).map(line => /runOwned|ownedRuntime|publishFixture/.test(line) ? '' : line).join('\n');
  assert.notEqual(unguarded, hostText); assert.deepEqual(unadmitted(scan(host, unguarded)), [], 'a removed guard is a stated limit');
});

test('the CLI is named only by the runner and the allowed lines, nothing reads the old override, and `npm run shots` is the isolated route', () => {
  const texts = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (entry.name === 'node_modules' || entry.name === 'test-results') continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else texts.push([path.relative(repo, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8')]); } };
  for (const dir of ['app/tests', 'app/scripts', 'scripts']) if (fs.existsSync(path.join(repo, dir))) walk(path.join(repo, dir));
  const manifests = ['package.json', 'app/package.json'].map(name => [name, JSON.parse(fs.readFileSync(path.join(repo, name), 'utf8')).scripts]);
  const found = [...texts.filter(([name]) => name !== 'app/tests/lib/bp-runner.mjs').flatMap(([name, text]) => scan(name, text)), ...manifests.flatMap(([name, scripts]) => scanScripts(name, scripts))];
  assert.deepEqual(unadmitted(found).map(hit => `${hit.name}:${hit.line} ${hit.hash}`), [], 'start the CLI through app/tests/lib/bp-runner.mjs');
  const used = new Set(found.map(allowedKey));
  assert.deepEqual([...allowed.keys()].filter(key => !used.has(key)).map(key => key.replace('\n', ' ')), [], 'an allowed line that no longer exists leaves the list');
  assert.equal(ALLOWED.length, ALLOWED_COUNT); assert.equal(allowed.size, ALLOWED_COUNT, 'each allowed line is listed once');
  assert.deepEqual(texts.filter(([, text]) => text.includes(ESCAPE)).map(([name]) => name), []);
  for (const [, scripts] of manifests) assert.ok(!JSON.stringify(scripts).includes(ESCAPE));
  const scripts = Object.fromEntries(manifests)['app/package.json'];
  assert.match(scripts.shots, /node tests\/status-shots-isolated\.mjs$/);
  for (const [name, command] of Object.entries(scripts)) assert.doesNotMatch(command, /node tests\/status-shots\.mjs/, `${name} runs status shots outside the isolated runtime`);
});

test("a suite without a Barkpark gives the app's CLI nowhere to go", () => {
  const env = unreachableBarkpark({ PATH: 'p', BARKPARK_API_URL: OUTSIDE, BARKPARK_SERVER: OUTSIDE, BARKPARK_SESSION: 's', BP_THEME: 't', XDG_CONFIG_HOME: '/saved' });
  assert.deepEqual(Object.keys(env).filter(name => ROUTING_ENV.test(name)).sort(), ['BARKPARK_API_TOKEN', 'BARKPARK_API_URL', 'BARKPARK_DATASET', 'BARKPARK_PROJECT', 'BARKPARK_WORKSPACE']);
  assert.equal(env.BARKPARK_API_URL, 'http://127.0.0.1:9'); assert.equal(env.PATH, 'p');
  assert.notEqual(env.XDG_CONFIG_HOME, '/saved'); assert.deepEqual(fs.readdirSync(env.XDG_CONFIG_HOME), []);
});
