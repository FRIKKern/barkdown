// The canvas bundle Barkdown edits with comes from the Barkpark it is connected to: the server
// serves /assets/bp-paper-editor.bundle.js and .css (a local Phoenix and bp cloud alike), so an
// editor change reaches the app by restarting Phoenix — no copy step. The fetched pair is cached
// under the profile's canvas-bundle/<js-sha>-<css-sha>/ and used when the server is unreachable; the copy in
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

// Cache paths are executable input, not merely a performance hint. Refuse linked
// ancestors as well as linked files, including Windows directory junctions.
function regularPath(target, type, missing = false) {
  const absolute = path.resolve(target), parts = [];
  for (let p = absolute; ; p = path.dirname(p)) { parts.unshift(p); if (path.dirname(p) === p) break; }
  for (const p of parts) {
    let stat;
    try { stat = fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT' && missing) return false; throw e; }
    if (stat.isSymbolicLink() || (p !== absolute && !stat.isDirectory())) throw new Error('Cache path contains a link or non-directory');
    if (p === absolute && (type === 'file' ? !stat.isFile() : !stat.isDirectory())) throw new Error('Cache path has the wrong file type');
  }
  return true;
}

function readCache(dir, server) {
  try {
    if (!regularPath(dir, 'directory', true)) return { info: null };
    const pointer = path.join(dir, 'current.json');
    if (!regularPath(pointer, 'file', true)) return { info: null };
    const current = JSON.parse(fs.readFileSync(pointer, 'utf8'));
    if (!current || current.source !== 'server' || !/^[a-f0-9]{40}$/.test(current.sha) || !/^[a-f0-9]{40}$/.test(current.cssSha)
      || typeof current.server !== 'string' || !/^https?:\/\//.test(current.server)
      || (current.version != null && typeof current.version !== 'string')
      || typeof current.fetchedAt !== 'string' || !Number.isFinite(Date.parse(current.fetchedAt))) throw new Error('Invalid editor cache metadata');
    if (server && current.server !== server) throw new Error('Editor cache belongs to another server');
    const pair = `${current.sha}-${current.cssSha}`;
    if (current.folder !== undefined && current.folder !== pair) throw new Error('Invalid editor cache build path');
    const folder = path.join(dir, current.folder || current.sha.slice(0, 8));
    regularPath(folder, 'directory');
    const [js, css] = FILES.map(f => path.join(folder, f));
    regularPath(js, 'file'); regularPath(css, 'file');
    if (sha1(fs.readFileSync(js)) !== current.sha || sha1(fs.readFileSync(css)) !== current.cssSha) throw new Error('Editor cache content hash mismatch');
    return { info: { source: 'cache', server: current.server, version: current.version, sha: current.sha, cssSha: current.cssSha, fetchedAt: current.fetchedAt, js, css } };
  } catch (error) { return { info: null, error: `Editor cache rejected: ${error.message}` }; }
}

function publishCache(dir, meta, js, css) {
  regularPath(dir, 'directory', true);
  fs.mkdirSync(dir, { recursive: true });
  regularPath(dir, 'directory');
  // Both digests select an immutable pair. CSS-only updates cannot modify a
  // previous build, and interruption before pointer publication leaves it valid.
  const folder = path.join(dir, meta.folder);
  let present = regularPath(folder, 'directory', true);
  if (present) {
    const names = fs.readdirSync(folder);
    if (names.some(name => !FILES.includes(name))) throw new Error('Existing editor build contains unknown files');
    let matches = true;
    for (const [i, data] of [js, css].entries()) {
      const file = path.join(folder, FILES[i]);
      if (!regularPath(file, 'file', true) || !fs.readFileSync(file).equals(data)) matches = false;
    }
    if (!matches) {
      // A healthy server can repair a damaged owned pair without deleting the
      // evidence. Linked/foreign paths were refused above, never quarantined.
      fs.renameSync(folder, path.join(dir, `rejected-${crypto.randomUUID()}`));
      present = false;
    }
  }
  if (!present) {
    const staging = path.join(dir, `pending-${crypto.randomUUID()}`);
    fs.mkdirSync(staging);
    fs.writeFileSync(path.join(staging, FILES[0]), js, { flag: 'wx' });
    fs.writeFileSync(path.join(staging, FILES[1]), css, { flag: 'wx' });
    fs.renameSync(staging, folder);
  }
  for (const [i, data] of [js, css].entries()) {
    const file = path.join(folder, FILES[i]); regularPath(file, 'file');
    if (!fs.readFileSync(file).equals(data)) throw new Error('Existing editor build differs from fetched bytes');
  }
  regularPath(dir, 'directory');
  regularPath(path.join(dir, 'current.json'), 'file', true);
  const temp = path.join(dir, `current-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(meta, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temp, path.join(dir, 'current.json'));
  return { ...meta, js: path.join(folder, FILES[0]), css: path.join(folder, FILES[1]) };
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
  const cached = readCache(cacheDir, server);
  const fallback = error => cached.info ? { ...cached.info, error } : { ...vendored(vendorDir), error: [error, cached.error].filter(Boolean).join('; ') || undefined };
  if (!server || !config?.enabled) return fallback('not connected');
  try {
    const [js, css] = await Promise.all(FILES.map(f => fetchText(`${server}/assets/${f}`, timeoutMs)));
    const sha = sha1(js);
    const cssSha = sha1(css);
    const meta = { source: 'server', server, version: await serverVersion(server), sha, cssSha, folder: `${sha}-${cssSha}`, fetchedAt: new Date().toISOString() };
    return publishCache(cacheDir, meta, js, css);
  } catch (error) {
    // Revalidate after awaiting network: files may have changed while fetching.
    const fresh = readCache(cacheDir, server);
    if (fresh.info) return { ...fresh.info, error: error.message };
    return { ...vendored(vendorDir), error: [error.message, fresh.error].filter(Boolean).join('; ') };
  }
}

module.exports = { resolve, sha1 };
