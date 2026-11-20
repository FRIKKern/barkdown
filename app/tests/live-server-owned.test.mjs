// Live suites send HTTP only to the Barkpark this run started: they take the server from the runtime record
// (tests/lib/bp-runner.mjs#ownedServer) and refuse before their first request otherwise.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { walkSuites, trackedSuites, isSuite, NOT_SUITES } from './lib/suite-scan.mjs';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIMIT = { timeout: 20_000, killSignal: 'SIGKILL' };
const SHOTS = 'BARKDOWN_SHOTS_SERVER';
const REFUSED = /Refusing to reach Barkpark/;

// A loopback listener this run did not record: it counts connections, closes them and answers nothing.
async function stray() {
  let connections = 0;
  const server = net.createServer(socket => { connections++; socket.destroy(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, connections: () => connections, close: () => new Promise(resolve => server.close(resolve)) };
}
// The environment a stray shell could hand a suite: no runtime record, no Barkpark routing of its own.
function shellEnv(extra) {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) if (!/^(BARKPARK_|BP_|BARKDOWN_OWNED_RUNTIME$|BARKDOWN_SHOTS_|NODE_TEST_CONTEXT$)/i.test(name)) env[name] = value;
  return { ...env, ...extra };
}
const records = fs.mkdtempSync(path.join(os.tmpdir(), 'live-owned-records-'));
after(() => fs.rmSync(records, { recursive: true, force: true }));
let recordCount = 0;
const recordFile = fields => { const file = path.join(records, `owned-runtime-${++recordCount}.json`); fs.writeFileSync(file, JSON.stringify({ token: 'recorded-token', dataset: 'production', ...fields })); return file; };

// R1 runs on every machine's `npm test` and in hosted CI, so the suites get nothing from the caller: an
// environment built here, an empty home and temp folder, a fake token, and this listener as the only server.
// Each suite runs from a scratch folder, so the one evidence folder it names relative to its working folder
// (admission's ../docs/…) lands in scratch; migration's repo folder is written only after its requests are
// answered, which the listener never does, and the row checks that folder is unchanged.
const SUITES = ['tests/migration-staging.live.mjs', 'tests/admission-dying-writer.live.mjs'];
const SUITE_LIMIT_MS = 5_000;
const running = new Set();
const endTree = pid => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch {} } }
};
after(() => { for (const pid of running) endTree(pid); running.clear(); });
function suiteEnv(scratch, server) {
  const home = path.join(scratch, 'home'), temp = path.join(scratch, 'tmp');
  for (const dir of [home, temp]) fs.mkdirSync(dir, { recursive: true });
  const env = { PATH: path.dirname(process.execPath), HOME: home, XDG_CONFIG_HOME: home, TMPDIR: temp, TMP: temp, TEMP: temp,
    BARKDOWN_SHOTS_ISOLATED: '1', [SHOTS]: server, BARKPARK_API_TOKEN: 'fake-token-live-server-owned' };
  // Windows starts no process without its system folder; nothing else is taken from the caller.
  if (process.platform === 'win32') Object.assign(env, { SystemRoot: process.env.SystemRoot, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home });
  return env;
}
function runSuite(suite, cwd, env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(appDir, suite)], { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(child.pid);
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.stdout.resume();
    const timer = setTimeout(() => endTree(child.pid), SUITE_LIMIT_MS);
    child.on('close', (status, signal) => { clearTimeout(timer); endTree(child.pid); running.delete(child.pid); resolve({ status, signal, stderr }); });
  });
}
const listing = dir => fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];

test('a live suite pointed at a server this run did not start sends nothing to it', { timeout: 60_000 }, async () => {
  const listener = await stray(), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'live-owned-suites-'));
  const repoEvidence = path.join(appDir, '../docs/cycles/evidence/C045'), before = listing(repoEvidence);
  try {
    for (const suite of SUITES) {
      const cwd = path.join(scratch, path.basename(suite, '.live.mjs'), 'app'); fs.mkdirSync(cwd, { recursive: true });
      const run = await runSuite(suite, cwd, suiteEnv(scratch, listener.url));
      assert.equal(run.signal, null, `${suite} ended within ${SUITE_LIMIT_MS} ms`);
      assert.notEqual(run.status, 0, suite);
      assert.match(run.stderr, REFUSED, `${suite}: ${run.stderr.slice(0, 400)}`);
    }
    assert.equal(listener.connections(), 0, 'the stray server saw no connection');
    assert.deepEqual(listing(repoEvidence), before, 'no suite wrote evidence into the repository');
  } finally { await listener.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
});

// ownedServer itself, in a fresh process per case.
function owned(env) {
  const code = `import(${JSON.stringify(pathToFileURL(path.join(appDir, 'tests/lib/bp-runner.mjs')).href)}).then(m => m.ownedServer()).then(r => console.log(JSON.stringify({ r, shots: process.env.${SHOTS} || null, token: process.env.BARKPARK_API_TOKEN || null })), e => console.log(JSON.stringify({ error: e.message })))`;
  const run = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', env: shellEnv(env), ...LIMIT });
  return JSON.parse(run.stdout.trim().split('\n').pop() || '{}');
}

test('ownedServer answers only from the record of a runtime this run started', { timeout: 60_000 }, async () => {
  const ours = await stray(), other = await stray();
  try {
    assert.deepEqual(owned({}), { r: null, shots: null, token: null }, 'nothing named and no record: the suite skips');
    assert.match(owned({ BARKPARK_API_TOKEN: 't' }).error, /a Barkpark token is set, but this run started no Barkpark of its own\. Run the suite through tests\/status-shots-isolated\.mjs .*or unset BARKPARK_API_TOKEN/);
    assert.match(owned({ [SHOTS]: ours.url, BARKPARK_API_TOKEN: 't' }).error, /this run started no Barkpark of its own/);
    assert.match(owned({ [SHOTS]: other.url, BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: process.pid }) }).error, /names a server this run did not start/);
    assert.match(owned({ [SHOTS]: ours.url, BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: 2 ** 22 + 7 }) }).error, /not running/);
    assert.match(owned({ [SHOTS]: 'https://example.com', BARKDOWN_OWNED_RUNTIME: recordFile({ server: 'https://example.com', pid: process.pid }) }).error, /not a loopback address/);
    const good = owned({ [SHOTS]: ours.url + '/', BARKPARK_API_TOKEN: 'not-this-runs', BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: process.pid }) });
    assert.deepEqual(good, { r: { server: ours.url, token: 'recorded-token', dataset: 'production' }, shots: ours.url, token: 'recorded-token' });
    // A valid record with no server named: the record's values come back and pin the token; the server variable stays unset.
    assert.deepEqual(owned({ BARKPARK_API_TOKEN: 'not-this-runs', BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: process.pid }) }), { r: { server: ours.url, token: 'recorded-token', dataset: 'production' }, shots: null, token: 'recorded-token' });
    assert.equal(ours.connections() + other.connections(), 0);
  } finally { await ours.close(); await other.close(); }
});

// The scan (tests/lib/suite-scan.mjs): every file under app/tests that reads the shots server or the token
// asks ownedServer first, before that read. Planted trees show what it reads; the real tree must be clean.
const testsDir = path.join(appDir, 'tests');
const READS_SERVER = 'const server = process.env.BARKDOWN_SHOTS_SERVER;\nawait fetch(server);\n';
const READS_TOKEN = "const token = process.env.BARKPARK_API_TOKEN;\nawait fetch('http://127.0.0.1:9', { headers: { authorization: 'Bearer ' + token } });\n";
const GUARDED = body => "import { ownedServer } from './lib/bp-runner.mjs';\nownedServer();\n" + body;
function plantedScan(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-owned-plant-'));
  try {
    for (const [name, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), body); }
    return walkSuites(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('every suite under app/tests takes its server from ownedServer before its first read', () => {
  assert.deepEqual(walkSuites(testsDir).filter(suite => !suite.guarded).map(suite => suite.relative), []);
  const writer = fs.readFileSync(path.join(testsDir, 'status-shots-isolated.mjs'), 'utf8');
  assert.ok(writer.indexOf('owned-runtime.json') < writer.indexOf(`${SHOTS}:`), 'the isolated runner writes the record before it names the server');
});

test('a suite in a subfolder is scanned', () => {
  assert.deepEqual(plantedScan({ 'deep/inner/plant.live.mjs': READS_SERVER, 'deep/guarded.live.mjs': GUARDED(READS_SERVER) }),
    [{ relative: 'deep/guarded.live.mjs', guarded: true }, { relative: 'deep/inner/plant.live.mjs', guarded: false }]);
});

test('a suite is scanned whatever its extension, a .txt one included; a file that is not text is not a program', () => {
  const found = plantedScan({ 'a.cjs': READS_SERVER, 'b.js': READS_SERVER, 'c.mts': READS_SERVER, 'd.txt': READS_SERVER, 'e': READS_SERVER,
    'f.bin': Buffer.concat([Buffer.from([0xff, 0xfe, 0x00]), Buffer.from(READS_SERVER)]) });
  assert.deepEqual(found.map(suite => [suite.relative, suite.guarded]), [['a.cjs', false], ['b.js', false], ['c.mts', false], ['d.txt', false], ['e', false]]);
});

test('a suite that reads only the token is scanned', () => {
  assert.deepEqual(plantedScan({ 'token.live.mjs': READS_TOKEN, 'token-guarded.live.mjs': GUARDED(READS_TOKEN), 'sets-only.test.mjs': "const env = { BARKPARK_API_TOKEN: 'x' };\n" }),
    [{ relative: 'token-guarded.live.mjs', guarded: true }, { relative: 'token.live.mjs', guarded: false }]);
});

test('the scanned suites are exactly the tracked ones, 38 of them, and each listed exception still reads the server or token', () => {
  const walked = walkSuites(testsDir).map(suite => suite.relative);
  assert.deepEqual(walked, trackedSuites(testsDir), 'the folder walk and git list the same suites');
  assert.equal(walked.length, 38);
  assert.deepEqual(Object.keys(NOT_SUITES).sort(), ['lib/bp-runner.mjs', 'lib/suite-scan.mjs', 'live-server-owned.test.mjs', 'run-ownership.test.mjs', 'status-shots-isolated.mjs', 'status-shots.mjs']);
  for (const relative of Object.keys(NOT_SUITES)) assert.ok(isSuite('', fs.readFileSync(path.join(testsDir, relative), 'utf8')), `${relative} still reads the server or token`);
});
