import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pin = JSON.parse(fs.readFileSync(new URL('./windows-terminal-notices-pin.json', import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const nativePattern = /\.(?:node|exe|dll|so|dylib)$/i;
export const terminalOriginalsPath = 'docs/third-party/windows-runtime-inputs/app-terminal-f54-01';

export function verifyTerminalNoticeInputs({ lock, manifest, nativeInventory, readOriginal }) {
  for (const key of ['version', 'resolved', 'integrity', 'license']) {
    if (lock?.[key] !== pin.lock[key]) throw Error('Terminal dependency lock differs: ' + key);
  }
  if (manifest?.name !== pin.component || manifest.version !== pin.lock.version || manifest.license !== pin.lock.license) {
    throw Error('Terminal package manifest differs');
  }
  if (!Array.isArray(nativeInventory) || nativeInventory.some(file => !file || typeof file.path !== 'string' ||
      !Number.isSafeInteger(file.bytes) || !/^[a-f0-9]{64}$/.test(file.sha256 || '') ||
      JSON.stringify(Object.keys(file).sort()) !== JSON.stringify(['bytes', 'path', 'sha256']))) {
    throw Error('Terminal native inventory is malformed');
  }
  const order = files => [...files].sort((a, b) => a.path.localeCompare(b.path))
    .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
  if (JSON.stringify(order(nativeInventory)) !== JSON.stringify(order(pin.native))) {
    throw Error('Terminal native roster differs from reviewed package');
  }
  const notices = pin.originals.map(file => {
    const supplied = readOriginal(file.path);
    if (!Buffer.isBuffer(supplied)) throw Error('Terminal original must be bytes: ' + file.path);
    const bytes = Buffer.from(supplied);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('Terminal original differs: ' + file.path);
    return { path: file.path, bytes };
  });
  return { notices, attribution: structuredClone({ component: pin.component, version: pin.lock.version,
    lock: pin.lock, native: pin.native, originals: pin.originals, publisher: pin.publisher,
    complete: false, limits: pin.limits }) };
}

function noLinks(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Terminal input traverses a link');
    if (current === path.dirname(current)) break;
  }
  if (fs.readdirSync(directory, { recursive: true, withFileTypes: true }).some(entry => entry.isSymbolicLink())) {
    throw Error('Terminal input contains a link');
  }
}

export function readTerminalNoticeInputs(repository) {
  const packageRoot = path.join(repository, 'app/node_modules/node-pty');
  const originals = path.join(repository, terminalOriginalsPath);
  noLinks(packageRoot); noLinks(originals);
  // Compute receipts from actual bytes here; callers cannot replace this filesystem scan with a claimed digest.
  const nativeInventory = fs.readdirSync(packageRoot, { recursive: true }).filter(file => nativePattern.test(file))
    .map(file => { const bytes = fs.readFileSync(path.join(packageRoot, file));
      return { path: 'node_modules/node-pty/' + file.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }; });
  const lock = JSON.parse(fs.readFileSync(path.join(repository, 'app/package-lock.json'))).packages['node_modules/node-pty'];
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json')));
  return verifyTerminalNoticeInputs({ lock, manifest, nativeInventory,
    readOriginal: file => fs.readFileSync(path.join(originals, file)) });
}

export function verifyPackagedTerminalNotices({ asar, archive, resources, expected }) {
  const nativePaths = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''))
    .filter(file => file.startsWith('node_modules/node-pty/') && nativePattern.test(file));
  const nativeInventory = nativePaths.map(file => { const bytes = asar.extractFile(archive, path.normalize(file));
    return { path: file, bytes: bytes.length, sha256: sha(bytes) }; });
  const manifest = JSON.parse(asar.extractFile(archive, path.normalize('node_modules/node-pty/package.json')));
  const result = verifyTerminalNoticeInputs({ lock: expected.attribution.lock, manifest, nativeInventory,
    readOriginal: file => fs.readFileSync(path.join(resources, 'licenses/app-terminal', file)) });
  const directory = path.join(resources, 'licenses/app-terminal');
  if (JSON.stringify(fs.readdirSync(directory).sort()) !==
      JSON.stringify([...pin.originals.map(file => file.path), 'attribution.json'].sort())) {
    throw Error('Packaged terminal notice roster differs');
  }
  const attribution = JSON.parse(fs.readFileSync(path.join(directory, 'attribution.json')));
  if (JSON.stringify(attribution) !== JSON.stringify(result.attribution)) throw Error('Packaged terminal attribution differs');
  return { nativeFiles: pin.native.length, originalFiles: result.notices.length, originalsExact: true,
    nativeExact: true, complete: false, limits: [...pin.limits] };
}
