// Whole carried client/source correspondence and original texts. This does not
// close embedded source or the other frontend distribution obligations.
import fs from 'node:fs';
import crypto from 'node:crypto';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-liveview-pin.json', import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function exact(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected).sort();
  return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(keys) && keys.every(key => exact(actual[key], expected[key]));
}

export function bindLiveViewNotices(prepared, payload, read) {
  if (prepared === undefined) return null;
  if (!exact(prepared, pin.provenance)) throw Error('Unsupported/changed LiveView notice provenance');
  if (payload?.upstream !== pin.provenance.upstream) throw Error('LiveView upstream differs from reviewed client');
  if (!exact(payload.asset, pin.asset)) throw Error('LiveView asset bytes differ from reviewed client');
  const notices = pin.provenance.files.map(file => {
    const supplied = read(structuredClone(file));
    if (!Buffer.isBuffer(supplied)) throw Error('LiveView notice must be original bytes: ' + file.path);
    const bytes = Buffer.from(supplied);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('Changed LiveView original notice: ' + file.path);
    if (!bytes.length || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw Error('LiveView notice is not nonempty UTF8: ' + file.path);
    return { file: structuredClone(file), bytes };
  });
  return { notices, attribution: structuredClone({ component: pin.provenance.component,
    upstream: pin.provenance.upstream, asset: pin.asset, packages: pin.provenance.packages,
    reproduction: pin.provenance.reproduction, texts: pin.provenance.files.map(file => 'licenses/' + file.path),
    limits: pin.limits }) };
}
