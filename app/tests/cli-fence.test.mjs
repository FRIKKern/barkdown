// Outside a packaged build, every start of the Barkpark CLI goes through app/main/cli-spawn.js, and that
// function refuses unless this run recorded the server as its own. Each row below runs in its own process,
// on a machine set up the way a person's is: the CLI (a stub on PATH that counts its starts) has a saved
// config and every routing variable pointing at an ambient loopback listener, and no runtime record exists.
// A row passes when that listener sees 0 connections, nothing starts and the refusal sentence is shown.
// UI routes are driven at the module boundary their IPC handler calls; the test checks that wiring too.
// This file never spells the command's name or the dev opt-in's name, so the scans below hold for it too.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLI, stub, listener, record, stubDir, stubPreload } from './lib/cli-stub.mjs';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(appDir);
const barkparkJs = path.join(appDir, 'main/barkpark.js');
const canvasJs = path.join(appDir, 'main/canvas-bundle.js');
const OPT_IN = ['BARKDOWN', 'DEV', 'CLI', 'UNFENCED'].join('_');
const SWITCH = ['via', 'Cli'].join(''); // the app setting that reads through the CLI, built so the word scan holds
const REFUSED = /Refused to start the Barkpark CLI: outside a packaged build it talks only to a Barkpark this run started and recorded/;

// Runs `code` (CommonJS, top-level await allowed inside main()) in a fresh node process with `env` and extra argv.
function route(code, env, argv = []) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-route-')), 'route.cjs');
  fs.writeFileSync(file, `const barkpark = () => require(${JSON.stringify(barkparkJs)});\nconst canvas = () => require(${JSON.stringify(canvasJs)});\n` +
    `const { execFileSync } = require('child_process');\n(async () => { let out; try { out = { ok: await (async () => { ${code} })() }; } catch (e) { out = { error: String(e.message) }; } console.log(JSON.stringify(out)); })();\n`);
  return new Promise(resolve => {
    const child = spawn(process.execPath, [file, ...argv], { cwd: path.dirname(file), env });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
    child.on('close', status => { let result = null; try { result = JSON.parse(stdout.trim().split('\n').pop()); } catch {} resolve({ result, stdout, stderr, status }); });
  });
}

// The reviewer's six routes, the canvas bundle's server lookup, and the app's import with a self-built env.
const ROUTES = {
  'cliSearch from a test': `return barkpark().cliSearch('x');`,
  'cliSpawn handed to execFileSync': `const s = barkpark().cliSpawn(['whoami']); return execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8' });`,
  'importFromCli from a test': `return barkpark().importFromCli();`,
  'the importCli IPC call (its handler is importFromCli)': `return barkpark().importFromCli();`,
  'the import-cli button (it calls importCli)': `return barkpark().importFromCli();`,
  'the CLI mode switch and Save (the library list then reads through the CLI)': `return barkpark().cliListAllPapers({ enabled: true, ${SWITCH}: true, server: process.env.AMBIENT, dataset: 'production' });`,
  'the canvas bundle asking the CLI for its server': `const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'cli-fence-canvas-')); return canvas().resolve({ config: { enabled: true, ${SWITCH}: true }, cacheDir: dir + '/cache', vendorDir: dir + '/vendor', timeoutMs: 500 }).catch(e => String(e.message));`,
};

async function ambient() {
  const near = await listener();
  const { env, started } = stub(near.url);
  return { near, env: { ...env, AMBIENT: near.url }, started };
}

for (const [name, code] of Object.entries(ROUTES)) {
  test(`${name}: refused with no record, nothing starts, the ambient server sees nothing`, async () => {
    const { near, env, started } = await ambient();
    try {
      const run = await route(code, env);
      assert.equal(near.connections(), 0, `the ambient listener saw ${near.connections()} connection(s); ${run.stdout}`);
      assert.deepEqual(started(), [], 'the CLI started');
      assert.match(run.stderr + run.stdout, REFUSED);
    } finally { await near.close(); }
  });
}

test('the UI routes reach the CLI only through the module functions the rows above drive', () => {
  const main = fs.readFileSync(path.join(appDir, 'main/main.js'), 'utf8');
  assert.match(main, /handle\('barkpark:importCli', \(\) => barkpark\.importFromCli\(\)\);/);
  assert.match(main, new RegExp(`c\\.${SWITCH} \\? barkpark\\.cliListAllPapers\\(c\\)`), 'the library list reads through cliListAllPapers in CLI mode');
  assert.match(fs.readFileSync(path.join(appDir, 'main/preload.js'), 'utf8'), /importCli: \(\) => call\('barkpark:importCli'\)/);
  const settings = fs.readFileSync(path.join(appDir, 'renderer/src/settings.js'), 'utf8');
  assert.match(settings, /\[data-act="import-cli"\][\s\S]{0,200}api\.barkpark\.importCli\(\)/);
});

test('an app started with an environment it built itself (no record, nothing inherited) still refuses', async () => {
  const near = await listener();
  const hits = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-bare-')), 'hits.jsonl');
  // Only what node and the stub need, written here: the stub first on PATH and every routing name at the listener.
  const env = { PATH: [stubDir, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter), HOME: path.dirname(hits), NODE_OPTIONS: stubPreload, STUB_HITS: hits,
    BARKPARK_API_URL: near.url, BARKPARK_API_TOKEN: 'ambient-token', BARKPARK_DATASET: 'production', AMBIENT: near.url,
    ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot, PATHEXT: '.COM;.EXE' } : {}) };
  try {
    for (const code of [ROUTES['importFromCli from a test'], ROUTES['cliSearch from a test']]) {
      const run = await route(code, env);
      assert.match(run.stderr + run.stdout, REFUSED);
    }
    assert.equal(near.connections(), 0);
    assert.equal(fs.existsSync(hits), false, 'the CLI started');
  } finally { await near.close(); }
});

test('a record this run owns lets the CLI start, towards that server only, with an env pinned to it', async () => {
  const { near, env, started } = await ambient();
  const own = await listener();
  try {
    const file = record(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-own-')), { server: own.url, pid: process.pid });
    const run = await route(`return barkpark().importFromCli();`, { ...env, BARKDOWN_OWNED_RUNTIME: file });
    assert.equal(near.connections(), 0);
    assert.ok(own.connections() > 0, run.stderr);
    for (const hit of started()) assert.equal(hit.cliEnv.BARKPARK_API_URL, own.url);
    // Naming another server in an argument, or picking credentials or a session, is refused before the start.
    const stray = await listener();
    try {
      for (const args of [['-s', stray.url, 'whoami'], [`--server=${stray.url}`, 'whoami'], ['whoami', '--token', 't'], ['whoami', '--session=s'], ['doc', 'get', `x@127.0.0.1:${new URL(stray.url).port}`]]) {
        const refused = await route(`const s = barkpark().cliSpawn(${JSON.stringify(args)}); return execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8' });`, { ...env, BARKDOWN_OWNED_RUNTIME: file });
        assert.match(refused.stderr, REFUSED, args.join(' '));
      }
      assert.equal(stray.connections(), 0);
    } finally { await stray.close(); }
  } finally { await near.close(); await own.close(); }
});

// The dev opt-in. Set the way app/scripts/start.mjs sets it (`npm start`, `npm run dev`), the CLI starts:
// start.mjs runs for real and launches a stand-in Electron (node under Electron's name) that starts the CLI
// through the app's own function. Every other way a test could reach is a row of its own.
function fakeElectron() {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-electron-'));
  const pathTxt = path.join(appDir, 'node_modules/electron/path.txt');
  const rel = fs.existsSync(pathTxt) ? fs.readFileSync(pathTxt, 'utf8') : 'electron';
  const exe = path.join(dist, rel);
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  if (process.platform === 'win32') { try { fs.linkSync(process.execPath, exe); } catch { fs.copyFileSync(process.execPath, exe); } } else fs.symlinkSync(process.execPath, exe);
  const out = path.join(dist, 'started.json');
  const probe = path.join(dist, 'probe.cjs');
  fs.writeFileSync(probe, `
    const path = require('path'), fs = require('fs');
    if (path.basename(process.argv0) === ${JSON.stringify(path.basename(exe))}) {
      const { execFileSync } = require('child_process');
      let result; try { const s = require(${JSON.stringify(barkparkJs)}).cliSpawn(['whoami']); result = { ok: JSON.parse(execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8' })) }; } catch (e) { result = { error: String(e.message) }; }
      fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify(result)); process.exit(0);
    }
  `);
  return { dist, out, probe };
}

test('the opt-in, set the way npm start sets it, lets the dev app start the CLI', async t => {
  if (!fs.existsSync(path.join(appDir, 'node_modules/electron'))) return t.skip('electron is not installed here');
  const { near, env } = await ambient();
  const { dist, out, probe } = fakeElectron();
  try {
    const child = spawn(process.execPath, [path.join(appDir, 'scripts/start.mjs')], { cwd: appDir, env: { ...env, ELECTRON_OVERRIDE_DIST_PATH: dist, BARKDOWN_CARRIED_RUNTIME: dist, NODE_OPTIONS: `${stubPreload} --require ${JSON.stringify(probe)}` } });
    let stderr = ''; child.stderr.on('data', d => { stderr += d; });
    await new Promise(resolve => child.on('close', resolve));
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(result, { ok: { server: near.url, dataset: 'production' } }, stderr);
    assert.equal(near.connections(), 1, 'the dev app reaches the server the person chose');
  } finally { await near.close(); }
});

test('the opt-in reached any other way: a wrong value, a setting, an argument all refuse; the exact name and value in a test env is a stated limit', async () => {
  const { near, env, started } = await ambient();
  try {
    const cases = [
      ['the name with another value', { ...env, [OPT_IN]: '1' }, [], `return barkpark().importFromCli();`],
      ['the name in lower case', { ...env, [OPT_IN.toLowerCase()]: 'npm-start' }, [], `return barkpark().importFromCli();`],
      ['a setting carrying it', env, [], `return barkpark().cliListAllPapers({ enabled: true, ${SWITCH}: true, server: process.env.AMBIENT, dataset: 'production', ${JSON.stringify(OPT_IN)}: 'npm-start', unfenced: true });`],
      ['an argument carrying it', env, [`--${OPT_IN}=npm-start`, `${OPT_IN}=npm-start`], `return barkpark().importFromCli();`],
    ];
    if (process.platform !== 'win32') cases.splice(1, 1); // the name is case-insensitive in a Windows environment
    for (const [label, caseEnv, argv, code] of cases) {
      const run = await route(code, caseEnv, argv);
      assert.match(run.stderr + run.stdout, REFUSED, label);
    }
    assert.equal(near.connections(), 0); assert.deepEqual(started(), []);
    // Stated limit: a test that writes the exact name and value into an environment turns the fence off, as
    // start.mjs does. The scan below fails any file other than start.mjs and cli-spawn.js that spells the name;
    // a name built at run time, as this file builds it, is not caught.
    const limit = await route(`const s = barkpark().cliSpawn(['whoami']); return JSON.parse(execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8' }));`, { ...env, [OPT_IN]: 'npm-start' });
    assert.equal(limit.result?.ok?.server, near.url, limit.stderr);
  } finally { await near.close(); }
});

// The command as a string a child-process call could start: the name alone, with a path, with a Windows
// extension, or at the start of a command line, inside quotes or backticks.
const COMMAND = new RegExp(`(['"\`])(?:[^'"\`\\s]*[\\\\/])?${CLI}(?:\\.(?:exe|cmd|bat|com))?(?:\\1|\\s)`, 'i');
const commandHits = text => text.split(/\r?\n/).filter(line => COMMAND.test(line));
const walk = (dir, out = []) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, out); else out.push(full); } return out; };

test('walking app/main, only cli-spawn.js names the CLI as a command', () => {
  for (const plant of [`execFile('${CLI}', args)`, `spawn("${CLI}.exe", a)`, `spawn('/usr/local/bin/${CLI}', a)`, `execSync(\`${CLI} whoami\`)`, `const c = '${CLI}';`, `spawn('C:\\\\tools\\\\${CLI}.cmd')`, `exec("${CLI} doc get x")`])
    assert.equal(commandHits(plant).length, 1, plant);
  for (const clean of [`// the ${CLI} CLI`, `const ${CLI} = require('./barkpark');`, `'${CLI}-paper-editor.bundle.js'`, `'${CLI}:' + id`, `\`the ${CLI} CLI's server\``, `'#${CLI}-mode'`])
    assert.deepEqual(commandHits(clean), [], clean);
  // Stated limit: a name built at run time and handed to a raw child-process call is not a command string.
  assert.deepEqual(commandHits("spawn('b' + 'p', ['whoami'])"), []);
  const named = walk(path.join(appDir, 'main')).filter(file => commandHits(fs.readFileSync(file, 'utf8')).length).map(file => path.relative(repo, file).split(path.sep).join('/'));
  assert.deepEqual(named, ['app/main/cli-spawn.js'], 'start the CLI through app/main/cli-spawn.js');
});

test('the opt-in is named only by app/scripts/start.mjs and app/main/cli-spawn.js, across every file in the repo', () => {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8', maxBuffer: 256e6 }).split('\0').filter(Boolean);
  assert.ok(files.includes('.github/workflows/verify.yml') && files.includes('app/tests/cli-fence.test.mjs'), 'the walk covers workflows and tests');
  const needle = Buffer.from(OPT_IN.toLowerCase());
  // Pictures and video are skipped: a setting in them would reach no process.
  const naming = files.filter(file => !/\.(png|gif|jpe?g|webp|ico|icns|mp4|webm)$/i.test(file)).filter(file => { try { return fs.readFileSync(path.join(repo, file)).toString('latin1').toLowerCase().includes(needle.toString('latin1')); } catch { return false; } });
  assert.deepEqual(naming.sort(), ['app/main/cli-spawn.js', 'app/scripts/start.mjs']);
  assert.match(fs.readFileSync(path.join(appDir, 'scripts/start.mjs'), 'utf8'), new RegExp(`${OPT_IN}: 'npm-start'`));
});
