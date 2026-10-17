import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pin = JSON.parse(fs.readFileSync(new URL('./windows-npm-notices-pin.json', import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const npmOriginalsPath = 'docs/third-party/windows-runtime-inputs/app-npm-notices-9a38-01';
export const npmSealedSources = ['scripts/npm-notices-windows.mjs', 'scripts/windows-npm-notices-pin.json',
  ...pin.packages.flatMap(pkg => pkg.originals.map(file => npmOriginalsPath + '/' + file.storedPath))];
const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  return value;
}
function roster(actual, expected) {
  if (!Array.isArray(actual) || actual.some(file => !file || typeof file.path !== 'string' ||
      !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256 || '') ||
      canonical(Object.keys(file).sort()) !== canonical(['bytes', 'path', 'sha256']))) throw Error('Npm file inventory malformed');
  const order = files => [...files].sort((a, b) => a.path.localeCompare(b.path));
  if (canonical(order(actual)) !== canonical(order(expected))) throw Error('Npm file roster differs');
}

export function verifyNpmNoticeInputs({ packages, readOriginal, packaged = false }) {
  if (!Array.isArray(packages) || packages.length !== pin.packages.length ||
      new Set(packages.map(pkg => pkg?.name)).size !== pin.packages.length) throw Error('Npm package roster differs');
  // Validate every identity/file receipt before reading any originals. Real adapters compute receipts from bytes.
  for (const expected of pin.packages) {
    const actual = packages.find(pkg => pkg.name === expected.name);
    if (!actual) throw Error('Npm package roster differs');
    if (!packaged) for (const key of ['version', 'resolved', 'integrity', 'license']) {
      if (actual.lock?.[key] !== expected.lock[key]) throw Error('Npm dependency lock differs: ' + key);
    }
    for (const [key, value] of Object.entries(expected.manifest)) {
      if (canonical(actual.manifest?.[key]) !== canonical(value)) throw Error('Npm package manifest differs: ' + key);
    }
    roster(actual.files, packaged ? expected.files : expected.installedFiles);
  }
  const notices = pin.packages.flatMap(pkg => pkg.originals.map(file => {
    const supplied = readOriginal(file.storedPath);
    if (!Buffer.isBuffer(supplied)) throw Error('Npm original must be bytes');
    const bytes = Buffer.from(supplied);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('Npm original differs: ' + file.storedPath);
    return { path: file.storedPath, bytes };
  }));
  return { notices, attribution: structuredClone({ packages: pin.packages, complete: false, limits: pin.limits }) };
}

function noLinks(target) {
  for (let current = target; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Npm input traverses a link');
    if (current === path.dirname(current)) break;
  }
  if (fs.statSync(target).isDirectory() && fs.readdirSync(target, { recursive: true, withFileTypes: true }).some(entry => entry.isSymbolicLink())) {
    throw Error('Npm input contains a link');
  }
}
export function readNpmNoticeInputs(repository) {
  const originalRoot = path.join(repository, npmOriginalsPath);
  noLinks(originalRoot); noLinks(path.join(repository, 'app/package-lock.json'));
  const lock = JSON.parse(fs.readFileSync(path.join(repository, 'app/package-lock.json'))).packages;
  const packages = pin.packages.map(pkg => {
    const directory = path.join(repository, 'app', pkg.root); noLinks(directory);
    const files = fs.readdirSync(directory, { recursive: true }).filter(file => fs.statSync(path.join(directory, file)).isFile())
      .map(file => { const bytes = fs.readFileSync(path.join(directory, file));
        return { path: pkg.root + '/' + file.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }; });
    return { name: pkg.name, lock: lock[pkg.root], manifest: JSON.parse(fs.readFileSync(path.join(directory, 'package.json'))), files };
  });
  return verifyNpmNoticeInputs({ packages, readOriginal: file => fs.readFileSync(path.join(originalRoot, file)) });
}

export function verifyPackagedNpmNotices({ asar, archive, resources }) {
  noLinks(archive);
  const directory = path.join(resources, 'licenses/app-npm'); noLinks(directory);
  const allPaths = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
  const packages = pin.packages.map(pkg => {
    const files = allPaths.filter(file => file.startsWith(pkg.root + '/')).filter(file => {
      const entry = asar.statFile(archive, path.normalize(file));
      if (entry.link) throw Error('Npm archive contains a link');
      return !entry.files && file !== pkg.root + '/package.json';
    }).map(file => { const bytes = asar.extractFile(archive, path.normalize(file));
      return { path: file, bytes: bytes.length, sha256: sha(bytes) }; });
    const manifest = JSON.parse(asar.extractFile(archive, path.normalize(pkg.root + '/package.json')));
    return { name: pkg.name, manifest, files };
  });
  const result = verifyNpmNoticeInputs({ packages, packaged: true, readOriginal: file => fs.readFileSync(path.join(directory, file)) });
  if (canonical(fs.readdirSync(directory).sort()) !== canonical([...result.notices.map(file => file.path), 'attribution.json'].sort())) {
    throw Error('Packaged npm original roster differs');
  }
  if (canonical(JSON.parse(fs.readFileSync(path.join(directory, 'attribution.json')))) !== canonical(result.attribution)) {
    throw Error('Packaged npm attribution differs');
  }
  return { packages: pin.packages.length, codeFiles: pin.packages.reduce((n, pkg) => n + pkg.files.length, 0),
    originalFiles: result.notices.length, originalBytes: result.notices.reduce((n, f) => n + f.bytes.length, 0),
    filesExact: true, originalsExact: true, complete: false, limits: [...pin.limits] };
}
