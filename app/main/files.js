// Agent working-folder access. Every path is confined to the folder the chat's agent was given.
const fs = require('fs');
const path = require('path');

const IGNORE = new Set(['node_modules', '.git', 'dist', 'release', 'build', '.next', 'coverage', '__pycache__', '.DS_Store', 'test-results']);
const MAX_FILE = 2 * 1024 * 1024;

function resolveInside(root, relative) {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relative || '.');
  if (target !== absoluteRoot && !target.startsWith(absoluteRoot + path.sep)) {
    throw new Error(`Path escapes the working folder: ${relative}`);
  }
  return target;
}

function tree(root, options = {}) {
  // A missing or inaccessible selected folder is not an empty successful tree.
  const absoluteRoot = path.resolve(root);
  if (!fs.statSync(absoluteRoot).isDirectory()) throw new Error('Working folder is not a directory: ' + root);
  fs.readdirSync(absoluteRoot);
  const maxDepth = options.maxDepth ?? 6;
  const maxEntries = options.maxEntries ?? 2500;
  let count = 0;
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    const out = [];
    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name.startsWith('.') && entry.isDirectory() && entry.name !== '.github') continue;
      if (++count > maxEntries) break;
      const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/');
      if (entry.isDirectory()) out.push({ name: entry.name, path: rel, type: 'dir', children: depth < maxDepth ? walk(path.join(dir, entry.name), depth + 1) : [] });
      else if (entry.isFile()) out.push({ name: entry.name, path: rel, type: 'file' });
    }
    return out;
  };
  return { root: path.resolve(root), name: path.basename(root), children: walk(path.resolve(root), 0), truncated: count > maxEntries };
}

function read(root, relative) {
  const target = resolveInside(root, relative);
  const stat = fs.statSync(target);
  if (stat.size > MAX_FILE) throw new Error(`File is larger than ${MAX_FILE / 1024 / 1024} MB`);
  const buffer = fs.readFileSync(target);
  const binary = buffer.subarray(0, 8000).includes(0);
  return { path: relative, size: stat.size, mtime: stat.mtimeMs, binary, text: binary ? null : buffer.toString('utf8') };
}

function write(root, relative, text, expectedMtime) {
  if (!fs.statSync(path.resolve(root)).isDirectory()) throw new Error('Working folder is not a directory: ' + root);
  const target = resolveInside(root, relative);
  if (expectedMtime != null) {
    try {
      const stat = fs.statSync(target);
      if (Math.abs(stat.mtimeMs - expectedMtime) > 1) return { conflict: true, mtime: stat.mtimeMs, text: fs.readFileSync(target, 'utf8') };
    } catch (error) { if (error.code !== 'ENOENT') throw error; return { conflict: true, missing: true, mtime: null, text: null }; }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
  return { ok: true, mtime: fs.statSync(target).mtimeMs };
}

function exists(root, relative) {
  try { return fs.existsSync(resolveInside(root, relative)); } catch { return false; }
}

function search(root, query, limit = 60) {
  const results = [];
  const needle = query.toLowerCase();
  const walk = dir => {
    if (results.length >= limit) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (IGNORE.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.size > 512 * 1024) continue;
      let text;
      try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
      if (text.includes('\0')) continue;
      const lines = text.split('\n');
      for (let n = 0; n < lines.length && results.length < limit; n++) {
        if (lines[n].toLowerCase().includes(needle)) results.push({ path: path.relative(root, full).split(path.sep).join('/'), line: n + 1, text: lines[n].trim().slice(0, 200) });
      }
    }
  };
  walk(path.resolve(root));
  return results;
}

module.exports = { tree, read, write, exists, search, resolveInside };
