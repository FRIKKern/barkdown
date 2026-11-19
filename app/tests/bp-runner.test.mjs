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

function stub() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-runner-stub-'));
  const hits = path.join(dir, 'hits.jsonl');
  fs.writeFileSync(path.join(dir, 'bp-stub.cjs'), `
    const fs = require('fs'), e = process.env;
    fs.appendFileSync(${JSON.stringify(hits)}, JSON.stringify({ argv: process.argv.slice(2), url: e.BARKPARK_API_URL, server: e.BARKPARK_SERVER, token: e.BARKPARK_API_TOKEN, config: e.XDG_CONFIG_HOME }) + '\\n');
    if (/^http:\\/\\/127\\.0\\.0\\.1:/.test(e.BARKPARK_API_URL || '')) { process.stdout.write(JSON.stringify({ server: e.BARKPARK_API_URL, dataset: e.BARKPARK_DATASET })); process.exit(0); }
    process.stderr.write('stub bp: refusing to pretend to be ' + (e.BARKPARK_API_URL || 'the saved server')); process.exit(1);
  `);
  if (process.platform === 'win32') fs.writeFileSync(path.join(dir, 'bp.cmd'), `@"${process.execPath}" "%~dp0bp-stub.cjs" %*\r\n`);
  else { fs.writeFileSync(path.join(dir, 'bp'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(dir, 'bp-stub.cjs')}" "$@"\n`); fs.chmodSync(path.join(dir, 'bp'), 0o755); }
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!/^(BARKPARK_|BARKDOWN_OWNED_RUNTIME$|BARKDOWN_ALLOW_REMOTE_FIXTURE$|BARKDOWN_SHOTS_)/.test(key)) env[key] = value;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = dir + path.delimiter + (env[pathKey] || '');
  Object.assign(env, { BARKPARK_API_URL: OUTSIDE, BARKPARK_API_TOKEN: 'outside-token', BARKPARK_SERVER: OUTSIDE, BARKPARK_TOKEN: 'outside-token', BARKDOWN_PROVIDER: 'api' });
  const calls = () => fs.existsSync(hits) ? fs.readFileSync(hits, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  return { dir, env, calls };
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
  const { dir, env, calls } = stub();
  const call = (file, args = ['whoami']) => run(['--input-type=module', '-e', `import { bp } from ${JSON.stringify(runner)}; console.log(JSON.stringify(bp(${JSON.stringify(args)})));`], { ...env, ...(file ? { BARKDOWN_OWNED_RUNTIME: file } : {}) });
  const stopped = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).stdout.trim();
  const refusals = [
    [null, /started no Barkpark of its own/],
    [path.join(dir, 'missing.json'), /cannot be read/],
    [record(dir, { server: OUTSIDE, pid: process.pid }), /not a loopback address/],
    [record(dir, { server: 'https://127.0.0.1:9', pid: process.pid }), /not a loopback address/],
    [record(dir, { server: 'http://127.0.0.1', pid: process.pid }), /not a loopback address/],
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
  const routed = call(own, ['-s', OUTSIDE, 'whoami']);
  assert.notEqual(routed.status, 0); assert.match(routed.stderr, /may not choose its own destination \(-s\)/);
  assert.deepEqual(calls(), [], 'a call that names its own server is refused before bp starts');
  const accepted = call(own);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.deepEqual(calls(), [{ argv: ['whoami', '-o', 'json'], url: 'http://127.0.0.1:9', token: 'owned-token', config: path.join(dir, 'cli-config') }], 'the shell and saved settings that point elsewhere are overridden');
});

test('bp is started only by the runner, and `npm run shots` is the isolated route', () => {
  const files = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (entry.name === 'node_modules' || entry.name === 'test-results') continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(mjs|cjs|js|sh)$/.test(entry.name)) files.push(full); } };
  for (const dir of ['app/tests', 'app/scripts', 'scripts']) if (fs.existsSync(path.join(repo, dir))) walk(path.join(repo, dir));
  const spawnsBp = /\b(execFileSync|execFile|spawnSync|spawn|execSync|exec)\(\s*['"`]bp\b/;
  const offenders = files.filter(file => !file.endsWith(path.join('lib', 'bp-runner.mjs')) && !file.endsWith('bp-runner.test.mjs') && spawnsBp.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders.map(file => path.relative(repo, file)), []);
  const escape = files.concat(path.join(repo, 'app/package.json'), path.join(repo, 'package.json')).filter(file => !file.endsWith('bp-runner.test.mjs') && fs.readFileSync(file, 'utf8').includes('BARKDOWN_ALLOW_REMOTE_FIXTURE'));
  assert.deepEqual(escape.map(file => path.relative(repo, file)), []);
  const scripts = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).scripts;
  assert.match(scripts.shots, /node tests\/status-shots-isolated\.mjs$/);
  for (const [name, command] of Object.entries(scripts)) assert.doesNotMatch(command, /node tests\/status-shots\.mjs/, `${name} runs status shots outside the isolated runtime`);
});
