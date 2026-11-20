// Outside a packaged build, every start of the Barkpark CLI goes through app/main/cli-spawn.js, and that
// function refuses unless this run recorded the server as its own. Each row below runs in its own process,
// on a machine set up the way a person's is: the CLI (a stub on PATH that counts its starts) has a saved
// config and every routing variable pointing at an ambient loopback listener, and no runtime record exists.
// A row passes when that listener sees 0 connections, nothing starts and the refusal sentence is shown.
// UI routes are driven at the module boundary their IPC handler calls; the test checks that wiring too.
// The dev opt-in and the packaged check have their own file, tests/cli-fence-optin.test.mjs.
// This file never spells the command's name, so the scans hold for it too.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CLI, listener, record, stubDir, stubPreload, REFUSED, SWITCH, appDir, ambient, route, endAll, LIMIT } from './lib/cli-stub.mjs';

after(endAll); // every child a row started, with all it started, even when a row failed or timed out
const ROW = { timeout: 60_000 };

const repo = path.dirname(appDir);
const { VERBS } = createRequire(import.meta.url)('../main/cli-spawn.js');

// The reviewer's six routes, the canvas bundle's server lookup, and the app's import with a self-built env.
const ROUTES = {
  'cliSearch from a test': `return barkpark().cliSearch('x');`,
  'cliSpawn handed to execFileSync': `const s = barkpark().cliSpawn(['whoami']); return execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8', ...${JSON.stringify(LIMIT)} });`,
  'importFromCli from a test': `return barkpark().importFromCli();`,
  'the importCli IPC call (its handler is importFromCli)': `return barkpark().importFromCli();`,
  'the import-cli button (it calls importCli)': `return barkpark().importFromCli();`,
  'the CLI mode switch and Save (the library list then reads through the CLI)': `return barkpark().cliListAllPapers({ enabled: true, ${SWITCH}: true, server: process.env.AMBIENT, dataset: 'production' });`,
  'the canvas bundle asking the CLI for its server': `const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'cli-fence-canvas-')); return canvas().resolve({ config: { enabled: true, ${SWITCH}: true }, cacheDir: dir + '/cache', vendorDir: dir + '/vendor', timeoutMs: 500 }).catch(e => String(e.message));`,
};

for (const [name, code] of Object.entries(ROUTES)) {
  test(`${name}: refused with no record, nothing starts, the ambient server sees nothing`, ROW, async () => {
    const { near, env, started } = await ambient();
    try {
      const run = await route(code, env);
      assert.equal(near.connections(), 0, `the ambient listener saw ${near.connections()} connection(s); ${run.stdout}`);
      assert.deepEqual(started(), [], 'the CLI started');
      assert.match(run.stderr + run.stdout, REFUSED);
    } finally { await near.close(); }
  });
}

test('the UI routes reach the CLI only through the module functions the rows above drive', ROW, () => {
  const main = fs.readFileSync(path.join(appDir, 'main/main.js'), 'utf8');
  assert.match(main, /handle\('barkpark:importCli', \(\) => barkpark\.importFromCli\(\)\);/);
  assert.match(main, new RegExp(`c\\.${SWITCH} \\? barkpark\\.cliListAllPapers\\(c\\)`), 'the library list reads through cliListAllPapers in CLI mode');
  assert.match(fs.readFileSync(path.join(appDir, 'main/preload.js'), 'utf8'), /importCli: \(\) => call\('barkpark:importCli'\)/);
  const settings = fs.readFileSync(path.join(appDir, 'renderer/src/settings.js'), 'utf8');
  assert.match(settings, /\[data-act="import-cli"\][\s\S]{0,200}api\.barkpark\.importCli\(\)/);
});

test('an app started with an environment it built itself (no record, nothing inherited) still refuses', ROW, async () => {
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

test('a record this run owns lets the CLI start, towards that server only, with an env pinned to it', ROW, async () => {
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
        const refused = await route(`const s = barkpark().cliSpawn(${JSON.stringify(args)}); return execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8', ...${JSON.stringify(LIMIT)} });`, { ...env, BARKDOWN_OWNED_RUNTIME: file });
        assert.match(refused.stderr, REFUSED, args.join(' '));
      }
      assert.equal(stray.connections(), 0);
    } finally { await stray.close(); }
  } finally { await near.close(); await own.close(); }
});

test('with a record, only the verbs Barkdown issues run, and no argument may name another server whatever its flag', ROW, async () => {
  const { near, env, started } = await ambient();
  const own = await listener(), stray = await listener();
  const port = new URL(stray.url).port;
  try {
    const file = record(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-verbs-')), { server: own.url, pid: process.pid });
    const start = args => route(`const s = barkpark().cliSpawn(${JSON.stringify(args)}); return execFileSync(s.command, s.args, { ...s.options, encoding: 'utf8', ...${JSON.stringify(LIMIT)} });`, { ...env, BARKDOWN_OWNED_RUNTIME: file });
    const refused = [
      ['cloud', 'login'], ['doc', 'delete', 'paper', 'x'], ['--manifest', 'm.json', 'whoami'], ['--no-cache', 'whoami'], ['whoami', '--token', 't'], ['whoami', '--session=s'],
      ['-s', stray.url, 'whoami'], ['whoami', `--server=${stray.url}`], ['whoami', '--control-url', `evil.example:${port}`], ['doc', 'get', 'paper', 'x', '--source-server', 'https://example.com'],
      ['doc', 'get', 'paper', 'x', '--anything=localhost'], ['doc', 'get', 'paper', 'x', '--y', '10.0.0.5'], ['doc', 'get', 'paper', `x@127.0.0.1:${port}`], ['doc', 'get', 'paper', '[::1]'],
    ];
    for (const args of refused) assert.match((await start(args)).stderr, REFUSED, args.join(' '));
    assert.deepEqual(started(), [], 'a refused call starts nothing');
    assert.equal(stray.connections(), 0); assert.equal(near.connections(), 0);
    // A verb on the list, with ordinary values (a dotted file name, a time) and the app's own routing, starts and reaches the recorded server.
    for (const args of [['doc', 'get', 'paper', 'photo.png'], ['-s', own.url, '-d', 'production', 'doc', 'query', 'paper', '--filter', 'title*=10:30']]) {
      const run = await start(args);
      assert.deepEqual(run.result, { ok: JSON.stringify({ server: own.url, dataset: 'production' }) }, run.stderr);
    }
    assert.equal(stray.connections(), 0); assert.equal(near.connections(), 0);
  } finally { await near.close(); await own.close(); await stray.close(); }
});

// Every CLI call site in the app, its tests and scripts: the leading literal words of the argument list.
// (scripts/demo-names.test.cjs holds call text as test data, not calls.)
const CALL = /\b(cli|cliFile|cliSpawn|runOwned)\(\s*\[/g;
function callVerbs() {
  const sites = [];
  for (const dir of ['app/main', 'app/tests', 'app/scripts', 'scripts']) for (const file of walk(path.join(repo, dir))) {
    const name = path.relative(repo, file).split(path.sep).join('/');
    if (!/\.(c|m)?js$/.test(name) || name === 'scripts/demo-names.test.cjs') continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(CALL)) {
      const words = [...text.slice(match.index + match[0].length, match.index + match[0].length + 200).matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map(m => m[1] ?? m[2]);
      sites.push({ site: `${name}:${text.slice(0, match.index).split('\n').length}`, verb: VERBS.includes(`${words[0]} ${words[1]}`) ? `${words[0]} ${words[1]}` : words[0] });
    }
  }
  return sites;
}

test("the fence's verb list is exactly the verbs Barkdown's call sites issue", ROW, () => {
  const sites = callVerbs();
  assert.ok(sites.length > 50, `found ${sites.length} call sites`);
  assert.deepEqual(sites.filter(({ verb }) => !VERBS.includes(verb)).map(({ site, verb }) => `${site} ${verb}`), [], 'a call site issues a verb the fence refuses: add it to VERBS in app/main/cli-spawn.js');
  const used = new Set(sites.map(({ verb }) => verb));
  assert.deepEqual(VERBS.filter(verb => !used.has(verb)), [], 'a verb on the list has no caller: remove it');
});

// The command as a string a child-process call could start: the name alone, with a path, with a Windows
// extension, or at the start of a command line, inside quotes or backticks.
const COMMAND = new RegExp(`(['"\`])(?:[^'"\`\\s]*[\\\\/])?${CLI}(?:\\.(?:exe|cmd|bat|com))?(?:\\1|\\s)`, 'i');
const commandHits = text => text.split(/\r?\n/).filter(line => COMMAND.test(line));
const walk = (dir, out = []) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, out); else out.push(full); } return out; };

test('walking app/main, only cli-spawn.js names the CLI as a command', ROW, () => {
  for (const plant of [`execFile('${CLI}', args)`, `spawn("${CLI}.exe", a)`, `spawn('/usr/local/bin/${CLI}', a)`, `execSync(\`${CLI} whoami\`)`, `const c = '${CLI}';`, `spawn('C:\\\\tools\\\\${CLI}.cmd')`, `exec("${CLI} doc get x")`])
    assert.equal(commandHits(plant).length, 1, plant);
  for (const clean of [`// the ${CLI} CLI`, `const ${CLI} = require('./barkpark');`, `'${CLI}-paper-editor.bundle.js'`, `'${CLI}:' + id`, `\`the ${CLI} CLI's server\``, `'#${CLI}-mode'`])
    assert.deepEqual(commandHits(clean), [], clean);
  // Stated limit: a name built at run time and handed to a raw child-process call is not a command string.
  assert.deepEqual(commandHits("spawn('b' + 'p', ['whoami'])"), []);
  const named = walk(path.join(appDir, 'main')).filter(file => commandHits(fs.readFileSync(file, 'utf8')).length).map(file => path.relative(repo, file).split(path.sep).join('/'));
  assert.deepEqual(named, ['app/main/cli-spawn.js'], 'start the CLI through app/main/cli-spawn.js');
});
