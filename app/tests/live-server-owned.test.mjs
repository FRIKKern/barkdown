// Live suites send HTTP only to the Barkpark this run started: they take the server from the runtime record
// (tests/lib/bp-runner.mjs#ownedServer) and refuse before their first request otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  for (const [name, value] of Object.entries(process.env)) if (!/^(BARKPARK|BP)_|^BARKDOWN_(OWNED_RUNTIME|SHOTS_)|^NODE_TEST_CONTEXT$/i.test(name)) env[name] = value;
  return { ...env, ...extra };
}
const recordFile = fields => { const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'live-owned-')), 'owned-runtime.json'); fs.writeFileSync(file, JSON.stringify({ token: 'recorded-token', dataset: 'production', ...fields })); return file; };

test('a live suite pointed at a server this run did not start sends nothing to it', { timeout: 60_000 }, async () => {
  const listener = await stray();
  try {
    for (const suite of ['tests/migration-staging.live.mjs', 'tests/admission-dying-writer.live.mjs']) {
      const run = spawnSync(process.execPath, [suite], { cwd: appDir, encoding: 'utf8', env: shellEnv({ [SHOTS]: listener.url, BARKPARK_API_TOKEN: 'not-this-runs', BARKDOWN_SHOTS_ISOLATED: '1' }), ...LIMIT });
      assert.notEqual(run.status, 0, suite);
      assert.match(run.stderr, REFUSED, `${suite}: ${run.stderr.slice(0, 400)}`);
    }
    assert.equal(listener.connections(), 0, 'the stray server saw no connection');
  } finally { await listener.close(); }
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
    assert.match(owned({ [SHOTS]: ours.url, BARKPARK_API_TOKEN: 't' }).error, /this run started no Barkpark of its own/);
    assert.match(owned({ [SHOTS]: other.url, BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: process.pid }) }).error, /names a server this run did not start/);
    assert.match(owned({ [SHOTS]: ours.url, BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: 2 ** 22 + 7 }) }).error, /not running/);
    assert.match(owned({ [SHOTS]: 'https://example.com', BARKDOWN_OWNED_RUNTIME: recordFile({ server: 'https://example.com', pid: process.pid }) }).error, /not a loopback address/);
    const good = owned({ [SHOTS]: ours.url + '/', BARKPARK_API_TOKEN: 'not-this-runs', BARKDOWN_OWNED_RUNTIME: recordFile({ server: ours.url, pid: process.pid }) });
    assert.deepEqual(good, { r: { server: ours.url, token: 'recorded-token', dataset: 'production' }, shots: ours.url, token: 'recorded-token' });
    assert.equal(ours.connections() + other.connections(), 0);
  } finally { await ours.close(); await other.close(); }
});

// Every file under app/tests that reads the shots server asks ownedServer first, before that read; the runner
// library and the isolated runner that writes the record are the two exceptions.
test('every suite that reads the shots server takes it from ownedServer before its first read', () => {
  const files = fs.readdirSync(path.join(appDir, 'tests')).filter(name => name.endsWith('.mjs') && name !== path.basename(fileURLToPath(import.meta.url)));
  const readers = files.filter(name => fs.readFileSync(path.join(appDir, 'tests', name), 'utf8').includes(SHOTS));
  const late = readers.filter(name => name !== 'status-shots-isolated.mjs').filter(name => {
    const text = fs.readFileSync(path.join(appDir, 'tests', name), 'utf8').replace(/^\s*\/\/.*$/gm, line => ' '.repeat(line.length)), call = text.search(/^ownedServer\(\);/m);
    return call < 0 || call > text.indexOf(SHOTS);
  });
  assert.deepEqual(late, []);
  assert.ok(readers.length >= 37, `the suites that read it are found (${readers.length})`);
  const writer = fs.readFileSync(path.join(appDir, 'tests/status-shots-isolated.mjs'), 'utf8');
  assert.ok(writer.indexOf('owned-runtime.json') < writer.indexOf(`${SHOTS}:`), 'the isolated runner writes the record before it names the server');
});
