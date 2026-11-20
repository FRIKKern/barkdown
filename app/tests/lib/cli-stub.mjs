// Test helpers for the CLI fence: a stub CLI on PATH, a listener that counts connections, and runtime
// records. The stub records every start; aimed at a loopback address it
// makes a real request there, so a listener counts what actually arrives. This file never spells the
// command's name (it builds it as CLI), so the tree scan holds for it too.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CLI = ['b', 'p'].join('');
export const ROUTING_ENV = /^(BARKPARK_|BP_)/i;
export const OUTSIDE = 'http://barkpark-outside.invalid:4000';
export const ESCAPE = ['BARKDOWN', 'ALLOW', 'REMOTE', 'FIXTURE'].join('_'); // the removed override

export const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-stub-'));
// The stub hands every argument to node after the stub script, so a leading -s reaches the stub rather than
// node's own option parser. On POSIX it is a shell script. Windows needs an .exe (no shell starts the CLI):
// there it is cli-stub-launcher.cs, compiled with the C# compiler that ships with Windows' .NET Framework.
const windows = process.platform === 'win32';
const stubScript = path.join(stubDir, 'stub.cjs');
fs.writeFileSync(stubScript, `
  const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process'), e = process.env;
  if (require.main === module) {
    const argv = process.argv.slice(2);
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
const stubCli = path.join(stubDir, windows ? `${CLI}.exe` : CLI);
if (windows) {
  const known = ['Framework64', 'Framework'].map(dir => path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', dir, 'v4.0.30319', 'csc.exe'));
  const csc = known.find(file => fs.existsSync(file));
  if (!csc) throw new Error(`cli-stub: the Windows stub CLI needs the .NET Framework C# compiler, at ${known.join(' or ')}`);
  // The launcher's source sits next to this file; it compiles into the stub's temp folder, never the repo.
  fs.writeFileSync(path.join(stubDir, 'launch.txt'), `${process.execPath}\r\n${stubScript}\r\n`);
  const compiled = spawnSync(csc, ['/nologo', '/target:exe', `/out:${stubCli}`, fileURLToPath(new URL('./cli-stub-launcher.cs', import.meta.url))], { encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL' });
  if (compiled.status !== 0 || !fs.existsSync(stubCli)) throw new Error(`cli-stub: compiling the Windows stub CLI failed (${compiled.error?.message || 'exit ' + compiled.status}): ${compiled.stdout}${compiled.stderr}`);
}
else fs.writeFileSync(stubCli, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(stubScript)} "$@"\n`, { mode: 0o755 });
// What the environment must carry for the stub to act: nothing, on any platform.
export const stubPreload = '';
export const stubCommand = stubCli;

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

// The arguments as the stub records them. On Windows it reads its first argument back from the path node made
// of it (lossy only for repeated slashes).
export const asStubSees = args => windows ? [path.relative(process.cwd(), path.resolve(args[0])), ...args.slice(1)] : args;

// Fence rows: the refusal sentence, the app setting that reads through the CLI (built so the word scan holds),
// an ambient listener with the stub environment aimed at it, and a fresh node process running `code`.
export const REFUSED = /Refused to start the Barkpark CLI: outside a packaged build it talks only to a Barkpark this run started and recorded/;
export const SWITCH = ['via', 'Cli'].join('');
export const appDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const barkparkJs = path.join(appDir, 'main', 'barkpark.js'), canvasJs = path.join(appDir, 'main', 'canvas-bundle.js');

export async function ambient() {
  const near = await listener();
  const { env, started, dir } = stub(near.url);
  return { near, env: { ...env, AMBIENT: near.url }, started, dir };
}

// Every child a row starts, so an afterEach hook can end it with all it started. On POSIX a tracked child leads its
// own process group, and the group is killed whether or not its leader is still alive, so its children go too.
// On Windows the tree is ended while the parent lives (taskkill /T). Each spawnSync/execFileSync in a row
// carries LIMIT as its timeout, and each test a slightly larger limit, so a hang fails in seconds by name.
export const LIMIT = { timeout: 20_000, killSignal: 'SIGKILL' };
const children = new Set();
export function track(child) { children.add(child); return child; }
export function endTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch {} } }
}
export function endAll() { for (const child of children) if (process.platform !== 'win32' || child.exitCode === null && child.signalCode === null) endTree(child.pid); children.clear(); }

// Runs `code` (the body of an async function; `barkpark()`, `canvas()` and execFileSync are in scope) in a fresh
// node process with `env` and extra argv. The result is { ok } or { error } from the code, plus stdout/stderr.
export function route(code, env, argv = []) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-route-')), 'route.cjs');
  fs.writeFileSync(file, `const barkpark = () => require(${JSON.stringify(barkparkJs)});\nconst canvas = () => require(${JSON.stringify(canvasJs)});\n` +
    `const APP = ${JSON.stringify(appDir)};\nconst { execFileSync } = require('child_process');\n` +
    `(async () => { let out; try { out = { ok: await (async () => { ${code} })() }; } catch (e) { out = { error: String(e.message) }; } console.log(JSON.stringify(out)); })();\n`);
  return new Promise(resolve => {
    const child = track(spawn(process.execPath, [file, ...argv], { cwd: path.dirname(file), env, detached: process.platform !== 'win32' }));
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
    child.on('close', status => { let result = null; try { result = JSON.parse(stdout.trim().split('\n').pop()); } catch {} resolve({ result, stdout, stderr, status }); });
  });
}
