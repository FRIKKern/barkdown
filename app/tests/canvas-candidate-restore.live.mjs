// Native rollback rehearsal for an exact reviewed editor candidate and preserved served baseline.
// The fixture owns its loopback server and user-data directory; it never contacts or mutates a live Barkpark.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const appDir = path.resolve('.');
const candidateDir = path.resolve(process.env.BARKDOWN_EDITOR_CANDIDATE_DIR || '');
const baselineDir = path.resolve(process.env.BARKDOWN_EDITOR_BASELINE_DIR || '');
const files = [
  'bp-paper-code.js',
  'bp-paper-editor-shell.css',
  'bp-paper-editor.bundle.js',
  'bp-paper-editor.css',
  'bp-paper-mermaid.js',
  'bp-paper-surface.css',
];
const nativeFiles = ['bp-paper-editor.bundle.js', 'bp-paper-editor.css'];
const sha = (algorithm, bytes) => crypto.createHash(algorithm).update(bytes).digest('hex');

function auditedSet(label, dir) {
  if (!process.env[`BARKDOWN_EDITOR_${label.toUpperCase()}_DIR`]) throw new Error(`BARKDOWN_EDITOR_${label.toUpperCase()}_DIR is required`);
  const sumsFile = path.join(dir, 'SHA256SUMS');
  const declared = new Map(fs.readFileSync(sumsFile, 'utf8').trim().split('\n').map(line => {
    const match = /^([a-f0-9]{64})  (bp-paper-[^/]+)$/.exec(line);
    if (!match) throw new Error(`Invalid ${label} SHA256SUMS line: ${line}`);
    return [match[2], match[1]];
  }));
  assert.deepEqual([...declared.keys()].sort(), [...files].sort(), `${label} manifest must name exactly six browser assets`);
  const assets = Object.fromEntries(files.map(file => {
    const bytes = fs.readFileSync(path.join(dir, file));
    const sha256 = sha('sha256', bytes);
    assert.equal(sha256, declared.get(file), `${label} ${file} differs from its preserved digest`);
    return [file, { bytes, sha256, sha1: sha('sha1', bytes) }];
  }));
  return { label, dir, assets };
}

const candidate = auditedSet('candidate', candidateDir);
const baseline = auditedSet('baseline', baselineDir);
assert.ok(
  nativeFiles.some(file => candidate.assets[file].sha256 !== baseline.assets[file].sha256),
  'candidate and baseline editor pairs must differ',
);

let active = candidate;
const requests = [];
const sockets = new Set();
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/status.json') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ version: active === candidate ? '1.22.0-candidate' : '1.21.0-baseline' }));
    return;
  }
  const match = /^\/assets\/(bp-paper-[^/]+)$/.exec(pathname);
  const asset = match && active.assets[match[1]];
  if (!asset) { response.writeHead(404); response.end(); return; }
  requests.push({ phase: active.label, file: match[1], sha256: asset.sha256 });
  response.writeHead(200, { 'content-type': match[1].endsWith('.css') ? 'text/css' : 'text/javascript', 'content-length': asset.bytes.length, 'cache-control': 'no-store' });
  response.end(asset.bytes);
});
server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-editor-restore-'));
const evidenceDir = path.resolve(process.env.BARKDOWN_EDITOR_RESTORE_EVIDENCE || path.join(userData, 'evidence'));
fs.mkdirSync(path.join(userData, 'barkdown'), { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(userData, 'barkdown', 'settings.json'), JSON.stringify({
  provider: 'api',
  barkpark: { enabled: true, writes: false, viaCli: false, server: origin, dataset: 'production', local: { enabled: false } },
}, null, 2) + '\n');

const phases = [];
let app = null;
async function launchAndAssert(name, expected, source) {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__barkdown?.state.loaded && window.__barkdown.state.canvasBundle, null, { timeout: 30000 });
  await page.waitForFunction(() => customElements.get('bp-paper-canvas'), null, { timeout: 30000 });
  const bundle = await page.evaluate(() => window.__barkdown.state.canvasBundle);
  assert.equal(bundle.source, source, `${name} source`);
  assert.equal(bundle.sha, expected.assets['bp-paper-editor.bundle.js'].sha1, `${name} executable SHA-1`);
  assert.equal(bundle.cssSha, expected.assets['bp-paper-editor.css'].sha1, `${name} stylesheet SHA-1`);
  const loaded = await page.evaluate(() => ({
    js: document.querySelector('script[data-canvas-bundle]')?.src,
    css: document.querySelector('link[data-canvas-bundle]')?.href,
  }));
  for (const [kind, file] of [['js', nativeFiles[0]], ['css', nativeFiles[1]]]) {
    assert.ok(loaded[kind]?.startsWith('file:///'), `${name} ${kind} must load from the verified local cache path`);
    const loadedPath = new URL(loaded[kind]);
    assert.equal(sha('sha256', fs.readFileSync(loadedPath)), expected.assets[file].sha256, `${name} loaded ${file}`);
  }
  const pointer = JSON.parse(fs.readFileSync(path.join(userData, 'canvas-bundle', 'current.json'), 'utf8'));
  assert.equal(pointer.sha, expected.assets[nativeFiles[0]].sha1, `${name} cache pointer executable`);
  assert.equal(pointer.cssSha, expected.assets[nativeFiles[1]].sha1, `${name} cache pointer stylesheet`);
  phases.push({ name, source: bundle.source, version: bundle.version, sha: bundle.sha, cssSha: bundle.cssSha, folder: pointer.folder, loaded });
  await app.close();
  app = null;
}

async function probeAll(expected) {
  for (const file of files) {
    const response = await fetch(`${origin}/assets/${file}`);
    assert.equal(response.status, 200);
    assert.equal(sha('sha256', Buffer.from(await response.arrayBuffer())), expected.assets[file].sha256, `${expected.label} served ${file}`);
  }
}

try {
  await probeAll(candidate);
  await launchAndAssert('candidate', candidate, 'server');
  const candidateFolder = phases[0].folder;
  const candidatePair = Object.fromEntries(nativeFiles.map(file => [
    file,
    Buffer.from(fs.readFileSync(path.join(userData, 'canvas-bundle', candidateFolder, file))),
  ]));

  active = baseline;
  await probeAll(baseline);
  await launchAndAssert('baseline-restore', baseline, 'server');
  for (const file of nativeFiles) {
    assert.deepEqual(
      fs.readFileSync(path.join(userData, 'canvas-bundle', candidateFolder, file)),
      candidatePair[file],
      `baseline restore must retain immutable candidate ${file}`,
    );
  }

  await new Promise(resolve => server.close(resolve));
  for (const socket of sockets) socket.destroy();
  await launchAndAssert('baseline-offline-restart', baseline, 'cache');
} finally {
  if (app) await app.close().catch(() => {});
  if (server.listening) {
    const stopped = new Promise(resolve => server.close(resolve));
    for (const socket of sockets) socket.destroy();
    await stopped;
  }
}

const digestView = set => Object.fromEntries(files.map(file => [file, set.assets[file].sha256]));
const manifest = {
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: execFileSync('git', ['status', '--porcelain', '--', '.', ':(exclude)node_modules'], { encoding: 'utf8' }).trim() !== '',
  isolation: { origin, loopbackOnly: true, liveMutation: false, userData },
  assets: { candidate: digestView(candidate), baseline: digestView(baseline) },
  phases,
  requests,
  assertions: [
    'all six candidate and baseline responses matched their preserved SHA256SUMS',
    'native Electron loaded the candidate executable and stylesheet from a verified server cache pair',
    'native Electron restarted onto the baseline pair at the same origin without mutating the candidate pair',
    'native Electron restarted offline from the restored baseline cache pair',
  ],
};
fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ evidence: evidenceDir, phases: manifest.phases, assertions: manifest.assertions }, null, 2));
