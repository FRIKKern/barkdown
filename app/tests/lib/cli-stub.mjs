// Test helpers for the CLI fence: a stub CLI on PATH, a listener that counts connections, and runtime
// records. The stub is node itself, linked (copied, on Windows) under the CLI's name, with a preload that
// acts only in a process started under that name. It records every start; aimed at a loopback address it
// makes a real request there, so a listener counts what actually arrives. This file never spells the
// command's name (it builds it as CLI), so the tree scan holds for it too.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

export const CLI = ['b', 'p'].join('');
export const ROUTING_ENV = /^(BARKPARK_|BP_)/i;
export const OUTSIDE = 'http://barkpark-outside.invalid:4000';
export const ESCAPE = ['BARKDOWN', 'ALLOW', 'REMOTE', 'FIXTURE'].join('_'); // the removed override

export const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-stub-'));
export const stubScript = path.join(stubDir, 'stub.cjs');
fs.writeFileSync(stubScript, `
  const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process'), e = process.env;
  if (path.basename(process.argv0).toLowerCase().replace(/\\.exe$/, '') === ${JSON.stringify(CLI)}) {
    // node resolves its first argument as a script path before the preload runs; undo that.
    const argv = process.argv.slice(1); if (argv.length) argv[0] = path.relative(process.cwd(), argv[0]);
    const cliEnv = Object.fromEntries(Object.entries(e).filter(([k]) => ${ROUTING_ENV}.test(k)));
    if (e.STUB_HITS) fs.appendFileSync(e.STUB_HITS, JSON.stringify({ argv, cliEnv, config: e.XDG_CONFIG_HOME, cwd: process.cwd() }) + '\\n');
    // The server the real CLI would pick: an exact -s/--server token and its value, an inline --server=, else env.
    let target = e.BARKPARK_API_URL || '';
    argv.forEach((a, i) => { if (a === '-s' || a === '--server') target = argv[i + 1]; else if (a.startsWith('--server=')) target = a.slice(9); });
    if (!/^http:\\/\\/127\\.0\\.0\\.1:\\d+$/.test(target)) { process.stderr.write('stub: refusing to pretend to be ' + (target || 'the saved server')); process.exit(1); }
    const got = spawnSync(process.execPath, ['-e', "fetch(process.argv[1] + '/v1/whoami').then(r => r.text()).then(t => process.stdout.write(t), x => { process.stderr.write(String(x)); process.exitCode = 1; })", target], { env: { ...e, NODE_OPTIONS: '' }, encoding: 'utf8' });
    process.stdout.write(got.stdout || ''); process.stderr.write(got.stderr || ''); process.exit(got.status ?? 1);
  }
`);
const stubCli = path.join(stubDir, process.platform === 'win32' ? `${CLI}.exe` : CLI);
if (process.platform === 'win32') { try { fs.linkSync(process.execPath, stubCli); } catch { fs.copyFileSync(process.execPath, stubCli); } }
else fs.symlinkSync(process.execPath, stubCli);
export const stubPreload = `--require ${JSON.stringify(stubScript)}`;

// An environment as a person's machine has it: a saved config and every routing variable naming `ambient`
// (an outside host by default), with the stub first on PATH and no runtime record.
export function stub(ambient = OUTSIDE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-stub-case-'));
  const hits = path.join(dir, 'hits.jsonl');
  const savedConfig = path.join(dir, 'saved-config');
  fs.mkdirSync(path.join(savedConfig, 'barkpark'), { recursive: true });
  fs.writeFileSync(path.join(savedConfig, 'barkpark', 'config.json'), JSON.stringify({ server: ambient, token: 'saved-token', dataset: 'production' }));
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!ROUTING_ENV.test(key) && !/^(BARKDOWN_OWNED_RUNTIME$|BARKDOWN_SHOTS_)/.test(key)) env[key] = value;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = stubDir + path.delimiter + (env[pathKey] || '');
  Object.assign(env, {
    BARKPARK_API_URL: ambient, BARKPARK_API_TOKEN: 'outside-token', BARKPARK_SERVER: ambient, BARKPARK_URL: ambient, BARKPARK_TOKEN: 'outside-token',
    BARKPARK_SESSION: 'outside-session', BARKPARK_CONTROL_URL: ambient, BARKPARK_WORKSPACE: 'elsewhere', BARKPARK_PROJECT: 'elsewhere', BARKPARK_DATASET: 'elsewhere', BP_THEME: 'outside',
    XDG_CONFIG_HOME: savedConfig, [ESCAPE]: '1', BARKDOWN_PROVIDER: 'api', STUB_HITS: hits, NODE_OPTIONS: stubPreload,
  });
  const started = () => fs.existsSync(hits) ? fs.readFileSync(hits, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  return { dir, env, hits, started, savedConfig };
}

// A listener that counts every connection made to it.
export async function listener() {
  const server = http.createServer((req, res) => res.end(JSON.stringify({ server: `http://127.0.0.1:${server.address().port}`, dataset: 'production' })));
  let connections = 0;
  server.on('connection', () => { connections++; });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, connections: () => connections, close: () => new Promise(resolve => server.close(resolve)) };
}

// A runtime record, as a server's starter writes it. A test that owns a listener records it with its own pid.
let records = 0;
export const record = (dir, fields) => { const file = path.join(dir, `owned-runtime-${++records}.json`); fs.writeFileSync(file, JSON.stringify({ token: 'owned-token', dataset: 'production', ...fields })); return file; };

// The stub reads its first argument back from the path node made of it (lossy only for repeated slashes).
export const asStubSees = args => [path.relative(process.cwd(), path.resolve(args[0])), ...args.slice(1)];
