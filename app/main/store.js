// JSON persistence helpers. Everything Barkdown remembers lives under the Electron userData folder.
const fs = require('fs');
const path = require('path');

let baseDir = null;

function init(dir) {
  baseDir = dir;
  fs.mkdirSync(path.join(baseDir, 'documents'), { recursive: true });
  return baseDir;
}

function dir() {
  if (!baseDir) throw new Error('store not initialised');
  return baseDir;
}

function filePath(name) {
  return path.join(dir(), name);
}

function readJson(name, fallback) {
  try {
    const text = fs.readFileSync(filePath(name), 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('store: could not read', name, error.message);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function writeJson(name, value) {
  const target = filePath(name);
  const tmp = target + '.tmp';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}

function remove(name) {
  try { fs.unlinkSync(filePath(name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function list(subdir, extension) {
  try {
    return fs.readdirSync(path.join(dir(), subdir)).filter(f => f.endsWith(extension)).map(f => path.join(subdir, f));
  } catch {
    return [];
  }
}

module.exports = { init, dir, filePath, readJson, writeJson, remove, list };
