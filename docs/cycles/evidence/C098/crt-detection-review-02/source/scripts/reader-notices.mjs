// Reviewed build-input notices bound to whole reader assets. This is not proof
// that all embedded copyright or frontend distribution obligations are closed.
import fs from 'node:fs';
import crypto from 'node:crypto';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-reader-pin.json', import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function exact(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected).sort();
  return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(keys) && keys.every(key => exact(actual[key], expected[key]));
}

export function bindReaderNotices(prepared, payload, read) {
  if (prepared === undefined) return null;
  if (!exact(prepared, pin.provenance)) throw Error('Unsupported/changed reader notice provenance');
  const source = pin.provenance.source;
  if (payload?.upstream !== source.upstream) throw Error('Reader upstream differs from reviewed source');
  const artifact = pin.artifacts.find(row => exact(payload.files, row.files));
  if (!artifact) throw Error('Reader asset bytes differ from reviewed payload');
  const stamp = { goVersion: source.goVersion, compilerSha256: source.compilerSha256,
    sourceArchiveSha256: source.sourceArchiveSha256, files: artifact.files };
  if (!exact(payload.readerAssets, stamp)) throw Error('Reader release stamp differs from actual reviewed assets/source');
  // Validate all supplied originals before the caller can create output. Neither
  // callback inputs nor the returned report expose mutable aliases to the pin.
  const notices = pin.provenance.files.map(file => {
    const supplied = read(structuredClone(file));
    if (!Buffer.isBuffer(supplied)) throw Error('Reader notice must be original bytes: ' + file.path);
    const bytes = Buffer.from(supplied);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('Changed reader original notice: ' + file.path);
    if (!bytes.length || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw Error('Reader notice is not nonempty UTF8: ' + file.path);
    return { file: structuredClone(file), bytes };
  });
  return { notices, attribution: structuredClone({ component: pin.provenance.component, source,
    artifact: artifact.name, assets: artifact.files, modules: pin.provenance.modules,
    texts: pin.provenance.files.map(file => 'licenses/' + file.path),
    limits: [...artifact.limits, 'Exact retained reader build-input notices only; embedded Go and other frontend/static coverage remains open'] }) };
}
