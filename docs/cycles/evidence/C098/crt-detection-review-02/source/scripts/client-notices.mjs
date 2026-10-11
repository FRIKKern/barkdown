// Reviewed whole Phoenix/xterm client associations and original notices. Source
// correspondence and exact npm dist entries have distinct recorded limits.
import fs from 'node:fs';
import crypto from 'node:crypto';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-clients-pin.json', import.meta.url)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function exact(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected).sort();
  return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(keys) && keys.every(key => exact(actual[key], expected[key]));
}

export function bindClientNotices(prepared, payload, read) {
  if (prepared === undefined) return null;
  if (!exact(prepared, pin.provenance)) throw Error('Unsupported/changed client notice provenance');
  if (payload?.upstream !== pin.provenance.upstream) throw Error('Client upstream differs from reviewed bundles');
  if (!exact(payload.assets, pin.provenance.clients.map(row => row.asset))) throw Error('Client asset bytes differ from reviewed bundles');
  const notices = pin.provenance.files.map(file => {
    const supplied = read(structuredClone(file));
    if (!Buffer.isBuffer(supplied)) throw Error('Client notice must be original bytes: ' + file.path);
    const bytes = Buffer.from(supplied);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('Changed client original notice: ' + file.path);
    if (!bytes.length || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw Error('Client notice is not nonempty UTF8: ' + file.path);
    return { file: structuredClone(file), bytes };
  });
  return { notices, attribution: structuredClone({ component: pin.provenance.component,
    upstream: pin.provenance.upstream, clients: pin.provenance.clients,
    texts: pin.provenance.files.map(file => 'licenses/' + file.path), limits: pin.limits }) };
}
