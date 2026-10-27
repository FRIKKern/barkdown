// A source launch finds or fetches the packaged Barkpark at the pin (#95). The release is a local HTTP
// server holding a stand-in runtime folder; nothing here reaches GitHub or starts Barkpark.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ensureRuntime, folderName, readyRuntime, runtimeFolder } from '../scripts/source-runtime.mjs';

const pin = '1482fb675d14b7cce477100a6baf705ca14a9214', platform = 'darwin', arch = 'arm64';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-source-runtime-'));
function standIn(parent, upstream = pin) {
  const folder = path.join(parent, folderName(pin, platform, arch));
  fs.mkdirSync(path.join(folder, 'bin'), { recursive: true }); fs.mkdirSync(path.join(folder, 'releases'));
  fs.writeFileSync(path.join(folder, 'bin', 'barkpark'), '#!/bin/sh\n'); fs.writeFileSync(path.join(folder, 'barkdown-release.json'), JSON.stringify({ version: 1, upstream, platform, arch, erts: 'erts-16.0' }));
  return folder;
}
function release({ upstream = pin, sum = null, missing = false } = {}) {
  const work = tmp(); standIn(work, upstream);
  const archive = path.join(work, 'runtime.tar.gz'); execFileSync('tar', ['-czf', archive, '-C', work, folderName(pin, platform, arch)]);
  const bytes = fs.readFileSync(archive), digest = sum || crypto.createHash('sha256').update(bytes).digest('hex');
  const asset = `/runtime-${pin.slice(0, 9)}/${folderName(pin, platform, arch)}.tar.gz`, requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (missing) { res.writeHead(404); return res.end(); }
    if (req.url === asset + '.sha256') { res.writeHead(200); return res.end(`${digest}  ${path.basename(asset)}\n`); }
    if (req.url === asset) { res.writeHead(200); return res.end(bytes); }
    res.writeHead(404); res.end();
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise(done => server.close(done)) })));
}
// The app root's parent holds runtime/, as in a checkout (app/ beside runtime/).
const checkout = () => { const root = path.join(tmp(), 'app'); fs.mkdirSync(root, { recursive: true }); return root; };

test('a runtime already at the default build path is used without a download', async () => {
  const root = checkout(); standIn(path.dirname(runtimeFolder(pin, { root, platform, arch })));
  const result = await ensureRuntime({ pin, root, platform, arch, fetchImpl: () => assert.fail('no download expected') });
  assert.equal(result.source, 'present'); assert.equal(result.folder, runtimeFolder(pin, { root, platform, arch }));
});

test('a missing runtime is downloaded, checked against its SHA-256 and moved into place', async () => {
  const root = checkout(), server = await release();
  try {
    const result = await ensureRuntime({ pin, root, platform, arch, base: server.base });
    assert.equal(result.source, 'downloaded'); assert.equal(result.mark.upstream, pin);
    assert.ok(readyRuntime(runtimeFolder(pin, { root, platform, arch }), pin));
    assert.deepEqual(fs.readdirSync(path.dirname(result.folder)), [folderName(pin, platform, arch)], 'the download folder is gone');
  } finally { await server.close(); }
});

test('an archive that does not match its SHA-256 installs nothing', async () => {
  const root = checkout(), server = await release({ sum: '0'.repeat(64) });
  try {
    await assert.rejects(ensureRuntime({ pin, root, platform, arch, base: server.base }), /does not match its SHA-256/);
    assert.equal(fs.existsSync(runtimeFolder(pin, { root, platform, arch })), false);
    assert.deepEqual(fs.readdirSync(path.dirname(runtimeFolder(pin, { root, platform, arch }))), []);
  } finally { await server.close(); }
});

test('an archive stamped with another commit installs nothing', async () => {
  const root = checkout(), server = await release({ upstream: 'f'.repeat(40) });
  try { await assert.rejects(ensureRuntime({ pin, root, platform, arch, base: server.base }), /stamped 1482fb675/); assert.equal(fs.existsSync(runtimeFolder(pin, { root, platform, arch })), false); }
  finally { await server.close(); }
});

test('an unpublished pin says how to build the runtime instead', async () => {
  const root = checkout(), server = await release({ missing: true });
  try { await assert.rejects(ensureRuntime({ pin, root, platform, arch, base: server.base }), /not published yet.*build-runtime-release\.mjs/); assert.equal(server.requests.length, 1, 'the archive is not requested'); }
  finally { await server.close(); }
});

test('a platform without a published runtime is told to use Settings', async () => {
  await assert.rejects(ensureRuntime({ pin, root: checkout(), platform: 'win32', arch: 'x64', fetchImpl: () => assert.fail('no download expected') }), /no packaged Barkpark is published for win32-x64/);
});

test('a folder for another commit at the path is left alone', async () => {
  const root = checkout(); standIn(path.dirname(runtimeFolder(pin, { root, platform, arch })), 'e'.repeat(40));
  await assert.rejects(ensureRuntime({ pin, root, platform, arch, fetchImpl: () => assert.fail('no download expected') }), /exists but is not the runtime/);
});
