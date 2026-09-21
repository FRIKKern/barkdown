// JSON persistence helpers. Everything Barkdown remembers lives under the Electron userData folder.
const fs = require('fs');
const path = require('path');

function createStore(initialDir = null, { create = true } = {}) {
let baseDir = null;

function init(dir) {
  if (initialDir && baseDir) throw new Error('A bound store cannot change its root');
  baseDir = path.resolve(dir);
  if (fs.existsSync(baseDir) && fs.lstatSync(baseDir).isSymbolicLink()) throw new Error('Store root cannot be a symbolic link');
  if (create) fs.mkdirSync(filePath('documents'), { recursive: true });
  else if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) throw new Error('Store root is unavailable');
  return baseDir;
}

function dir() {
  if (!baseDir) throw new Error('store not initialised');
  return baseDir;
}

function filePath(name) {
  if (typeof name !== 'string' || !name || path.isAbsolute(name)) throw new Error('Invalid store path');
  const root = dir(), target = path.resolve(root, name), relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Store path escapes its owner');
  let current = root;
  for (const part of relative.split(path.sep)) {
    if (part.includes(':')) throw new Error('Invalid store path');
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Store path cannot traverse a symbolic link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

function readJson(name, fallback) {
  const target = filePath(name);
  try {
    const text = fs.readFileSync(target, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('store: could not read', name, error.message);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function writeJson(name, value) {
  const target = filePath(name);
  const tmp = filePath(name + '.tmp');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}

function remove(name) {
  try { fs.unlinkSync(filePath(name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function list(subdir, extension) {
  const target = filePath(subdir);
  try {
    return fs.readdirSync(target).filter(f => f.endsWith(extension)).map(f => path.join(subdir, f));
  } catch {
    return [];
  }
}

if (initialDir) init(path.resolve(initialDir));
return Object.freeze({ init, dir, filePath, readJson, writeJson, remove, list });
}

module.exports = { ...createStore(), createStore };
