// The canvas bundle Barkdown edits with comes from the Barkpark it is connected to: the server
// serves /assets/bp-paper-editor.bundle.js and .css (a local Phoenix and bp cloud alike), so an
// editor change reaches the app by restarting Phoenix — no copy step. The fetched pair is cached
// under userData/canvas-bundle/<sha8>/ and used when the server is unreachable; the copy in
// renderer/vendor is the last fallback (a fresh install, no server yet). The result names its
// source and the bundle's sha1 so a row can verify which editor is running.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const FILES = ['bp-paper-editor.bundle.js', 'bp-paper-editor.css'];
const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');

function activeCliServer() {
  return new Promise(resolve => {
    execFile('bp', ['use', '-o', 'json'], { windowsHide: true, shell: process.platform === 'win32', timeout: 8000 }, (error, stdout) => {
      if (error) return resolve(null);
      try { const j = JSON.parse(stdout); resolve(j?.active?.server || null); } catch { resolve(null); }
    });
  });
}

async function resolveServer(config) {
  const direct = String(config?.server || '').replace(/\/+$/, '');
  if (config?.viaCli) return (await activeCliServer())?.replace(/\/+$/, '') || direct || null;
  return direct || null;
}

async function fetchText(url, timeoutMs) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function serverVersion(server) {
  try { const r = await fetch(`${server}/status.json`, { signal: AbortSignal.timeout(4000) }); const j = await r.json(); return j?.version || null; } catch { return null; }
}

function readCache(dir) {
  try {
    const current = JSON.parse(fs.readFileSync(path.join(dir, 'current.json'), 'utf8'));
    const folder = path.join(dir, current.sha.slice(0, 8));
    for (const f of FILES) if (!fs.existsSync(path.join(folder, f))) return null;
    return { ...current, js: path.join(folder, FILES[0]), css: path.join(folder, FILES[1]) };
  } catch { return null; }
}

function vendored(vendorDir) {
  const js = path.join(vendorDir, FILES[0]);
  let sha = null;
  try { sha = sha1(fs.readFileSync(js)); } catch {}
  return { source: 'vendored', server: null, version: null, sha, js, css: path.join(vendorDir, FILES[1]), fetchedAt: null };
}

// resolve({ config, cacheDir, vendorDir }) → { source: 'server'|'cache'|'vendored', server, version, sha, js, css, fetchedAt, error? }
async function resolve({ config, cacheDir, vendorDir, timeoutMs = 6000 }) {
  const server = await resolveServer(config);
  const cached = readCache(cacheDir);
  if (!server || !config?.enabled) return cached ? { ...cached, source: 'cache', error: 'not connected' } : vendored(vendorDir);
  try {
    const [js, css] = await Promise.all(FILES.map(f => fetchText(`${server}/assets/${f}`, timeoutMs)));
    const sha = sha1(js);
    const folder = path.join(cacheDir, sha.slice(0, 8));
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, FILES[0]), js);
    fs.writeFileSync(path.join(folder, FILES[1]), css);
    const meta = { source: 'server', server, version: await serverVersion(server), sha, cssSha: sha1(css), fetchedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(cacheDir, 'current.json'), JSON.stringify(meta, null, 2) + '\n');
    // Keep only the newest few builds around.
    try { for (const d of fs.readdirSync(cacheDir).filter(n => /^[0-9a-f]{8}$/.test(n) && n !== sha.slice(0, 8)).slice(0, -2)) fs.rmSync(path.join(cacheDir, d), { recursive: true, force: true }); } catch {}
    return { ...meta, js: path.join(folder, FILES[0]), css: path.join(folder, FILES[1]) };
  } catch (error) {
    if (cached) return { ...cached, source: 'cache', error: error.message };
    return { ...vendored(vendorDir), error: error.message };
  }
}

module.exports = { resolve, sha1 };
