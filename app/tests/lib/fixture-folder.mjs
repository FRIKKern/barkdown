// Folders for the live scripts' app data and working folders, under one fixed root per platform whose path
// holds nothing of this machine: no home folder, temp folder, login name or checkout. A picture that draws one
// of these folders shows only the root, the script's name and a random suffix.
// - Before making a folder, the root itself is checked against those values, and refused by name if it holds one.
// - Each folder has a marker file beside it (<folder>.barkdown-fixture, outside the folder, so the folder's own
//   contents are exactly what the script writes), and is removed when the script exits, pass or fail.
// - Folders left by a crash are swept once they are a day old; only folders with a marker are ever removed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { machineTraces, findMachineText } from '../visual-machine-text.mjs';

export const ROOTS = Object.freeze({ win32: 'C:\\barkdown-fixture', darwin: '/Users/Shared/barkdown-fixture', linux: '/dev/shm/barkdown-fixture' });
export const MARKER = '.barkdown-fixture';
export const markerOf = folder => folder + MARKER;
const DAY_MS = 24 * 60 * 60 * 1000;
const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const plain = folder => folder.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

// The reason a root would draw something of this machine, or null. The values can be injected for the test.
export function rootProblem(root, { home = os.homedir(), temp = os.tmpdir(), login, top = checkout } = {}) {
  const kind = findMachineText([root], machineTraces({ home, temp, ...(login === undefined ? {} : { login }) }));
  if (kind) return kind;
  const [a, b] = [plain(root), plain(top)];
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/') ? 'checkout folder' : null;
}

// Removes the marked folders in root older than maxAge, with their markers; leaves every other entry alone.
export function sweep(root, { now = Date.now(), maxAge = DAY_MS } = {}) {
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  const removed = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(MARKER)) continue;
    const marker = path.join(root, entry.name), folder = marker.slice(0, -MARKER.length);
    let made;
    try { made = JSON.parse(fs.readFileSync(marker, 'utf8')).made; } catch { continue; }
    if (typeof made !== 'number' || now - made <= maxAge) continue;
    fs.rmSync(folder, { recursive: true, force: true }); fs.rmSync(marker, { force: true }); removed.push(path.basename(folder));
  }
  return removed.sort();
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
  if (checkedRoot !== root) {
    const problem = rootProblem(root, values);
    if (problem) throw new Error(`Refusing to make a fixture folder: the root ${root} holds this machine's ${problem}.`);
    try { fs.mkdirSync(root, { recursive: true }); fs.accessSync(root, fs.constants.W_OK); } catch (error) {
      throw new Error(`Refusing to make a fixture folder: the root ${root} cannot be written (${error.code || error.message}). There is no other root.`);
    }
    sweep(root);
    checkedRoot = root;
  }
  let folder;
  try { folder = fs.mkdtempSync(path.join(root, prefix)); fs.writeFileSync(markerOf(folder), JSON.stringify({ made: Date.now() }) + '\n'); } catch (error) {
    throw new Error(`Refusing to make a fixture folder: ${prefix} cannot be made under ${root} (${error.code || error.message}). There is no other root.`);
  }
  if (!made.length) process.on('exit', onExit);
  made.push(folder);
  return folder;
}
