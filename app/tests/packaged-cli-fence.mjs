// The CLI fence on a packaged build: the Desktop suite builds the unsigned app (electron-builder --dir) and
// runs its document server child, run as node by the app's own executable, the way the app starts it for an
// assistant. Inside the bundle the child starts the CLI; the same files copied out of the bundle refuse it
// unless the run recorded a Barkpark of its own.
//   node tests/packaged-cli-fence.mjs <unpacked app folder>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { SWITCH, REFUSED, ambient, record } from './lib/cli-stub.mjs';

const require = createRequire(import.meta.url);
const unpacked = path.resolve(process.argv[2] || '');
// Windows and Linux unpack beside a resources folder; a macOS --dir build (a local check) is an .app.
const mac = fs.existsSync(path.join(unpacked, 'Barkdown.app'));
const exe = mac ? 'Barkdown.app/Contents/MacOS/Barkdown' : fs.readdirSync(unpacked).find(name => /^Barkdown(\.exe)?$/i.test(name));
assert.ok(exe, `no Barkdown executable in ${unpacked}`);
const bundle = path.join(unpacked, mac ? 'Barkdown.app/Contents/Resources' : 'resources', 'app.asar');
assert.ok(fs.statSync(bundle).isFile(), 'the build packs the app into app.asar');

// One document listing over the server's stdio protocol; resolves with what the child printed to stderr.
function listOnce(serverJs, env) {
  return new Promise((resolve, reject) => {
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'packaged-fence-store-'));
    const child = spawn(path.join(unpacked, exe), [serverJs, store], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`no answer in 60 s\n${err}`)); }, 60_000);
    child.stderr.on('data', d => { err += d; });
    child.stdout.on('data', d => {
      out += d;
      if (out.split('\n').some(line => /"id":2\b/.test(line))) { clearTimeout(timer); child.stdin.end(); child.kill(); resolve(err); }
    });
    child.on('error', reject);
    const send = message => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'fence-probe', version: '1' } } });
    send({ method: 'notifications/initialized' });
    send({ id: 2, method: 'tools/call', params: { name: 'list_documents', arguments: {} } });
  });
}

async function run(label, serverJs, owned) {
  const { near, env, started, dir } = await ambient();
  try {
    const connection = { enabled: true, [SWITCH]: true, server: near.url, dataset: 'production' };
    const runEnv = { ...env, BARKDOWN_RUN_CONNECTION: JSON.stringify(connection) };
    if (owned) runEnv.BARKDOWN_OWNED_RUNTIME = record(dir, { server: near.url, pid: process.pid });
    const err = await listOnce(serverJs, runEnv);
    const result = { label, started: started().length, connections: near.connections(), refused: REFUSED.test(err) };
    console.log(JSON.stringify(result));
    return result;
  } finally { await near.close(); }
}

const t0 = Date.now();
const inside = await run('packaged, no record', path.join(bundle, 'main', 'mcp-server.js'), false);
assert.ok(inside.started > 0 && inside.connections > 0 && !inside.refused, 'the packaged child starts the CLI');

const copied = fs.mkdtempSync(path.join(os.tmpdir(), 'packaged-fence-copy-'));
require('@electron/asar').extractAll(bundle, copied);
const outsideJs = path.join(copied, 'main', 'mcp-server.js');
const bare = await run('copied out, no record', outsideJs, false);
assert.ok(bare.started === 0 && bare.connections === 0 && bare.refused, 'the child copied out of the bundle refuses the CLI');
const owned = await run('copied out, owned record', outsideJs, true);
assert.ok(owned.started > 0 && owned.connections > 0 && !owned.refused, 'copied out, it starts the CLI for a Barkpark the run recorded');
console.log(`packaged fence probe passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
