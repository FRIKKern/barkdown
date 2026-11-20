// Folders for the live scripts' app data and working folders, under one fixed root per platform whose path
// holds nothing of this machine: no home folder, temp folder, login name or checkout. A picture that draws one
// of these folders shows only the root, the script's name and a random suffix.
// - Before making a folder, the root is checked against those values, and refused by name if it holds one. It
//   must also be a real folder (or not made yet) at exactly that path: a link, or a link above it, is refused.
// - Each folder has a marker file beside it (<folder>.barkdown-fixture, outside the folder, so the folder's own
//   contents are exactly what the script writes), and is removed when the script exits, pass or fail.
// - Folders left by a crash are swept once they are a day old. The sweep removes only folders this helper made,
//   directly inside its root: see sweep() for the checks. Everything else in the root is left and named.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { machineTraces, findMachineText } from '../visual-machine-text.mjs';

export const ROOTS = Object.freeze({ win32: 'C:\\barkdown-fixture', darwin: '/Users/Shared/barkdown-fixture', linux: '/dev/shm/barkdown-fixture' });
export const MARKER = '.barkdown-fixture';
export const markerOf = folder => folder + MARKER;
const DAY_MS = 24 * 60 * 60 * 1000;
// The one shape of a folder name: a lowercase dash-separated prefix ending in '-', then mkdtemp's six characters.
const PREFIX = '[a-z0-9]+(?:-[a-z0-9]+)*-';
const PREFIX_NAME = new RegExp(`^${PREFIX}$`);
export const FOLDER_NAME = new RegExp(`^${PREFIX}[A-Za-z0-9]{6}$`);
const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const plain = folder => folder.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

// The reason a root would draw something of this machine, or null. The values can be injected for the test.
export function rootProblem(root, { home = os.homedir(), temp = os.tmpdir(), login, top = checkout } = {}) {
  const kind = findMachineText([root], machineTraces({ home, temp, ...(login === undefined ? {} : { login }) }));
  if (kind) return kind;
  const [a, b] = [plain(root), plain(top)];
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/') ? 'checkout folder' : null;
}

// Where a root really is: the real path of its nearest existing folder, with the parts not made yet after it.
// A root is used only when this is the path asked for, so no link in or above it moves the folders elsewhere.
function realRootOf(root) {
  const rest = [];
  for (let head = path.resolve(root); ; head = path.dirname(head)) {
    try { return path.join(fs.realpathSync.native(head), ...rest); } catch {}
    if (path.dirname(head) === head) return path.resolve(root);
    rest.unshift(path.basename(head));
  }
}

// Why an entry of the root is left, or null when the sweep may remove it. The entry comes from the root's own
// listing. Checked in this order: the resolved path is a direct child of the resolved root (so never the root
// itself), it is a real folder (lstat: a link is never followed), its name is FOLDER_NAME, and beside it is the
// marker fixtureFolder wrote for it, a file naming this folder, older than maxAge.
function leftBecause(root, realRoot, entry, now, maxAge) {
  const folder = path.join(root, entry.name);
  let real;
  try { real = fs.realpathSync.native(folder); } catch { return 'unreadable'; }
  if (path.dirname(real) !== realRoot || real === realRoot) return 'outside the root';
  const kind = fs.lstatSync(folder);
  if (!kind.isDirectory()) return kind.isSymbolicLink() ? 'link' : 'not a folder';
  if (!FOLDER_NAME.test(entry.name)) return 'not a fixture name';
  let marker;
  try { if (!fs.lstatSync(markerOf(folder)).isFile()) return 'no marker'; marker = JSON.parse(fs.readFileSync(markerOf(folder), 'utf8')); } catch { return 'no marker'; }
  if (marker?.name !== entry.name || typeof marker.made !== 'number') return 'no marker';
  return now - marker.made > maxAge ? null : 'new';
}

// One entry at a time, never through a link: files and links are unlinked, real folders emptied, then removed.
function removeTree(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && fs.lstatSync(full).isDirectory()) removeTree(full); else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

// Removes the folders this helper made directly inside root that are older than maxAge, with their markers.
// Every other entry is left, and named with its reason in one line of output. It never throws.
export function sweep(root, { now = Date.now(), maxAge = DAY_MS, log = line => console.error(line) } = {}) {
  let entries = [], realRoot;
  try { realRoot = fs.realpathSync.native(root); entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return { removed: [], left: [] }; }
  const names = new Set(entries.map(entry => entry.name));
  const removed = [], left = [];
  for (const entry of entries) {
    if (entry.name.endsWith(MARKER) && names.has(entry.name.slice(0, -MARKER.length))) continue; // judged with its folder
    if (entry.name.endsWith(MARKER)) { left.push(`${entry.name} (marker with no folder)`); continue; }
    let reason;
    try { reason = leftBecause(root, realRoot, entry, now, maxAge); } catch { reason = 'unreadable'; }
    if (reason) { left.push(`${entry.name} (${reason})`); continue; }
    try { removeTree(path.join(root, entry.name)); fs.unlinkSync(markerOf(path.join(root, entry.name))); removed.push(entry.name); } catch (error) { left.push(`${entry.name} (${error.code || 'not removed'})`); }
  }
  removed.sort(); left.sort();
  log(`fixture sweep ${root}: removed ${removed.length}; left ${left.length ? left.join(', ') : 'nothing'}`);
  return { removed, left };
}

// The root is a real folder, or not made yet, at exactly the path asked for; otherwise the helper refuses by name.
function rootShape(root) {
  let kind = null;
  try { kind = fs.lstatSync(root); } catch {}
  if (kind?.isSymbolicLink()) throw new Error(`Refusing to make a fixture folder: the root ${root} is a link. There is no other root.`);
  if (kind && !kind.isDirectory()) throw new Error(`Refusing to make a fixture folder: the root ${root} is not a folder. There is no other root.`);
  if (realRootOf(root) !== path.resolve(root)) throw new Error(`Refusing to make a fixture folder: the root ${root} resolves to another path. There is no other root.`);
}

const made = [];
let checkedRoot = null;
function onExit() {
  for (const folder of made) {
    let bytes = 0;
    const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (entry.isFile()) bytes += fs.statSync(full).size; } };
    try { walk(folder); } catch {}
    try { fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3 }); fs.rmSync(markerOf(folder), { force: true }); } catch {} // a folder still held is swept later by its marker
    console.error(`fixture folder ${path.basename(folder)}: ${(bytes / 1e6).toFixed(1)} MB`);
  }
}

// A new folder under this platform's root, named <prefix><random>, as mkdtempSync(path.join(os.tmpdir(), prefix)) would make it.
export function fixtureFolder(prefix, { root = ROOTS[process.platform] ?? ROOTS.linux, values } = {}) {
  if (!PREFIX_NAME.test(prefix)) throw new Error(`Refusing to make a fixture folder: the prefix ${JSON.stringify(prefix)} is not lowercase letters, digits and dashes ending in '-'.`);
  if (checkedRoot !== root) {
    const problem = rootProblem(root, values);
    if (problem) throw new Error(`Refusing to make a fixture folder: the root ${root} holds this machine's ${problem}.`);
    rootShape(root);
    try { fs.mkdirSync(root, { recursive: true }); fs.accessSync(root, fs.constants.W_OK); } catch (error) {
      throw new Error(`Refusing to make a fixture folder: the root ${root} cannot be written (${error.code || error.message}). There is no other root.`);
    }
    rootShape(root);
    sweep(root);
    checkedRoot = root;
  }
  let folder;
  try { folder = fs.mkdtempSync(path.join(root, prefix)); } catch (error) {
    throw new Error(`Refusing to make a fixture folder: ${prefix} cannot be made under ${root} (${error.code || error.message}). There is no other root.`);
  }
  // The sweep only knows FOLDER_NAME; a folder of any other shape would never be swept after a crash.
  if (!FOLDER_NAME.test(path.basename(folder))) { fs.rmSync(folder, { recursive: true, force: true }); throw new Error(`Refusing to make a fixture folder: ${path.basename(folder)} is not a name the sweep knows.`); }
  try { fs.writeFileSync(markerOf(folder), JSON.stringify({ name: path.basename(folder), made: Date.now() }) + '\n'); } catch (error) {
    fs.rmSync(folder, { recursive: true, force: true });
    throw new Error(`Refusing to make a fixture folder: ${prefix} cannot be marked under ${root} (${error.code || error.message}). There is no other root.`);
  }
  if (!made.length) process.on('exit', onExit);
  made.push(folder);
  return folder;
}
