// Private engineering source inputs, never a corresponding-source or release acknowledgement.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unusedDestination, inventory } from './runtime-postgres-bundle.mjs';

const pin = JSON.parse(fs.readFileSync(new URL('./windows-gnu-source-pin.json', import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const gnuOriginalsPath = 'docs/third-party/windows-runtime-inputs/postgres-18.4-gnu-05';
const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  return value;
}
function receipts(actual, expected, label) {
  if (!Array.isArray(actual) || actual.some(file => !file || typeof file.path !== 'string' ||
      !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256 || '') ||
      canonical(Object.keys(file).sort()) !== canonical(['bytes', 'path', 'sha256']))) throw Error(label + ' inventory malformed');
  const order = files => [...files].sort((a, b) => a.path.localeCompare(b.path));
  if (canonical(order(actual)) !== canonical(order(expected))) throw Error(label + ' roster differs');
}
const publicSource = source => ({ name: source.name, version: source.version, url: source.url,
  archive: { bytes: source.archive?.bytes, sha256: source.archive?.sha256 }, originals: source.files });
const attribution = () => structuredClone({ version: 1, sources: pin.sources, native: pin.native, postgresMarker: pin.postgresMarker,
  complete: false, limits: pin.limits });

export function verifyGnuSourceInputs({ provenance, archiveInventory, nativeInventory, markerInventory, readOriginal }) {
  if (provenance?.version !== 1 || provenance.status !== 'incomplete-preparation' || provenance.distributionReady !== false ||
      !Array.isArray(provenance.sources) || provenance.sources.some(source => !source || typeof source.name !== 'string')) {
    throw Error('GNU provenance malformed or overstates readiness');
  }
  const expected = pin.sources.map(source => ({ name: source.name, version: source.version, url: source.url,
    archive: { bytes: source.archive.bytes, sha256: source.archive.sha256 }, originals: source.originals }));
  const order = sources => [...sources].sort((a, b) => a.name.localeCompare(b.name));
  if (canonical(order(provenance.sources.map(publicSource))) !== canonical(order(expected))) throw Error('GNU source provenance differs');
  receipts(archiveInventory, pin.sources.map(source => source.archive), 'GNU archive');
  receipts(nativeInventory, pin.native.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), 'GNU native');
  receipts(markerInventory, [pin.postgresMarker], 'GNU package marker');
  const notices = pin.sources.flatMap(source => source.originals.map(file => {
    const supplied = readOriginal(file.path);
    if (!Buffer.isBuffer(supplied)) throw Error('GNU original must be bytes');
    const bytes = Buffer.from(supplied);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('GNU original differs: ' + file.path);
    return { path: file.path, bytes };
  }));
  return { notices, attribution: attribution() };
}

function noLinks(target, recursive = true) {
  for (let current = target; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('GNU input traverses a link');
    if (current === path.dirname(current)) break;
  }
  if (recursive && fs.statSync(target).isDirectory() && fs.readdirSync(target, { recursive: true, withFileTypes: true }).some(entry => entry.isSymbolicLink())) {
    throw Error('GNU input contains a link');
  }
}
function disjoint(input, output) {
  const a = process.platform === 'win32' ? input.toLowerCase() : input;
  const b = process.platform === 'win32' ? output.toLowerCase() : output;
  const inside = (parent, child) => { const r = path.relative(parent, child);
    return !r || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)); };
  if (inside(a, b) || inside(b, a)) throw Error('GNU output overlaps an input directory');
}

export function readGnuSourceInputs({ inputs, provenanceRoot, runtimeRoot }) {
  if (!Array.isArray(inputs) || inputs.length !== pin.sources.length || inputs.some(input => !input ||
      typeof input.name !== 'string' || typeof input.file !== 'string' || !input.file) ||
      canonical(inputs.map(input => input.name).sort()) !== canonical(pin.sources.map(source => source.name).sort())) {
    throw Error('GNU archive inputs must name exactly the two reviewed components');
  }
  if (typeof provenanceRoot !== 'string' || !provenanceRoot || typeof runtimeRoot !== 'string' || !runtimeRoot) {
    throw Error('Explicit GNU original and PostgreSQL roots required');
  }
  const originals = path.resolve(provenanceRoot), runtime = path.resolve(runtimeRoot);
  // Only named build inputs are read; do not walk a PostgreSQL tree that may contain database state.
  noLinks(originals, false); noLinks(runtime, false);
  const markerFile = path.join(runtime, pin.postgresMarker.path); noLinks(markerFile);
  const markerBytes = fs.readFileSync(markerFile);
  const markerInventory = [{ path: pin.postgresMarker.path, bytes: markerBytes.length, sha256: sha(markerBytes) }];
  receipts(markerInventory, [pin.postgresMarker], 'GNU package marker');
  const provenanceFile = path.join(originals, 'provenance.json'); noLinks(provenanceFile);
  const archives = pin.sources.map(source => {
    const file = path.resolve(inputs.find(input => input.name === source.name).file); noLinks(file);
    if (!fs.statSync(file).isFile()) throw Error('GNU archive input must be a regular file');
    const bytes = fs.readFileSync(file);
    return { file, path: source.archive.path, bytes, receipt: { path: source.archive.path, bytes: bytes.length, sha256: sha(bytes) } };
  });
  const nativeInventory = pin.native.map(file => { const target = path.join(runtime, file.path); noLinks(target); const bytes = fs.readFileSync(target);
    return { path: file.path, bytes: bytes.length, sha256: sha(bytes) }; });
  const verified = verifyGnuSourceInputs({ provenance: JSON.parse(fs.readFileSync(provenanceFile)),
    archiveInventory: archives.map(file => file.receipt), nativeInventory, markerInventory,
    readOriginal: file => { const target = path.join(originals, file); noLinks(target); return fs.readFileSync(target); } });
  return { ...verified, archives, inputDirectories: [originals, runtime, ...archives.map(file => path.dirname(file.file))] };
}

export function verifyGnuSourceBundle(directory) {
  noLinks(directory);
  const expected = [
    ...pin.sources.map(source => ({ ...source.archive, path: 'sources/' + source.archive.path })),
    ...pin.sources.flatMap(source => source.originals.map(file => ({ path: 'originals/' + file.path, bytes: file.bytes, sha256: file.sha256 })))
  ];
  const actual = inventory(directory);
  receipts(actual.filter(file => !['attribution.json', 'README.md'].includes(file.path)), expected, 'GNU bundle');
  if (canonical(JSON.parse(fs.readFileSync(path.join(directory, 'attribution.json')))) !== canonical(attribution())) throw Error('GNU bundle attribution differs');
  if (fs.readFileSync(path.join(directory, 'README.md'), 'utf8') !== bundleReadme) throw Error('GNU bundle scope differs');
  return { status: 'passed', archives: pin.sources.length, originalFiles: expected.length - pin.sources.length,
    sourceBytes: pin.sources.reduce((n, source) => n + source.archive.bytes, 0),
    totalFiles: actual.length, totalBytes: actual.reduce((n, file) => n + file.bytes, 0),
    complete: false, limits: [...pin.limits] };
}
const bundleReadme = '# GNU upstream source inputs\n\nPrivate engineering preparation: two complete retained upstream archives and original texts, associated with exact carried libiconv/gettext DLL fingerprints. No archive/code is executed or downloaded.\n\nThese are upstream source inputs. Vendor compiler/patch/static-component correspondence, a corresponding-source offer and relinking obligations remain unresolved. Do not publish this as complete corresponding source or use it to accept installation or A5. See attribution.json for exact versions, original hashes and remaining limits.\n';

export function prepareGnuSourceBundle({ output, ...args }) {
  if (typeof output !== 'string' || !output) throw Error('Explicit unused GNU output required');
  const destination = unusedDestination(output), input = readGnuSourceInputs(args);
  for (const directory of input.inputDirectories) disjoint(directory, destination);
  fs.mkdirSync(destination, { recursive: true });
  for (const archive of input.archives) {
    const file = path.join(destination, 'sources', archive.path); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, archive.bytes, { flag: 'wx' });
  }
  for (const notice of input.notices) {
    const file = path.join(destination, 'originals', notice.path); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, notice.bytes, { flag: 'wx' });
  }
  fs.writeFileSync(path.join(destination, 'attribution.json'), JSON.stringify(input.attribution, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(destination, 'README.md'), bundleReadme, { flag: 'wx' });
  // The output is checked from disk; an input changed during copying retains the attempt as a failure.
  readGnuSourceInputs(args);
  return verifyGnuSourceBundle(destination);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [iconv, gettext, provenanceRoot, runtimeRoot, output, ...extra] = process.argv.slice(2);
  if (!iconv || !gettext || !provenanceRoot || !runtimeRoot || !output || extra.length) {
    console.error('Usage: node scripts/prepare-gnu-sources.mjs <libiconv archive> <gettext archive> <originals root> <PostgreSQL root> <new output>'); process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(prepareGnuSourceBundle({ inputs: [{ name: 'libiconv', file: iconv }, { name: 'gettext', file: gettext }], provenanceRoot, runtimeRoot, output }))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
