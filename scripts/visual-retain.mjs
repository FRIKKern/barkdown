// Current owner instructions preserve evidence. Inventory older bytes in place;
// immutable receipts detect corruption without deleting media or rewriting links.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function safe(base, relative) {
  const file = path.resolve(base, relative), boundary = path.resolve(base);
  if (!file.startsWith(boundary + path.sep)) throw Error('Outside evidence root: ' + relative);
  for (let current = file; current !== boundary; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked evidence path: ' + relative);
  }
  return file;
}
function bytesOf(base, file) {
  const bytes = fs.readFileSync(safe(base, file)), text = bytes.toString('utf8');
  // Git normalises text to LF; binary pixels remain byte-for-byte.
  return !bytes.includes(0) && Buffer.from(text).equals(bytes) ? Buffer.from(text.replace(/\r\n/g, '\n')) : bytes;
}
function filesUnder(base, relative) {
  return fs.readdirSync(safe(base, relative), { withFileTypes: true }).flatMap(e => {
    const file = relative + '/' + e.name;
    if (e.isSymbolicLink()) throw Error('Linked evidence path: ' + file);
    if (e.isDirectory()) return filesUnder(base, file);
    if (!e.isFile()) throw Error('Non-file evidence: ' + file);
    return [file];
  });
}
export function coldEvidence(base = root) {
  const read = name => JSON.parse(fs.readFileSync(safe(base, name), 'utf8'));
  const visual = 'docs/visual', runsDir = visual + '/runs', statusDir = 'docs/images/status';
  const runs = fs.readdirSync(safe(base, runsDir)).filter(n => /^\d{4}-\d\d-\d\dT/.test(n)).sort();
  const active = new Set(), platforms = new Map();
  for (const file of fs.readdirSync(safe(base, visual)).filter(n => /^approved(\.[a-z0-9]+)?\.json$/.test(n))) {
    const approval = read(visual + '/' + file);
    const named = /runs\/([^/]+)\//.exec(approval.manifest || '');
    if (named) active.add(named[1]);
    if (approval.report) {
      const baseline = /runs\/([^/]+)\//.exec(read(approval.report).baseline || '');
      if (baseline) active.add(baseline[1]);
    }
  }
  if (fs.existsSync(path.join(base, visual, 'pending.json'))) active.add(read(visual + '/pending.json').run);
  for (const run of runs) {
    const manifest = runsDir + '/' + run + '/manifest.json';
    if (!fs.existsSync(path.join(base, manifest))) continue; // Partial attempts still inventory below.
    const platform = read(manifest).environment?.platform || 'win32';
    if (!platforms.has(platform)) platforms.set(platform, []);
    platforms.get(platform).push(run);
  }
  for (const list of platforms.values()) for (const run of list.slice(-2)) active.add(run);
  const manifests = [read(statusDir + '/manifest.json')], history = statusDir + '/history';
  if (fs.existsSync(path.join(base, history))) {
    for (const name of fs.readdirSync(safe(base, history)).filter(n => /^\d{4}-\d\d-\d\dT.*\.json$/.test(n)).sort().reverse()) {
      const candidate = read(history + '/' + name);
      if (candidate.capturedAt !== manifests[0].capturedAt) { manifests.push(candidate); break; }
    }
  }
  const activeStatus = new Set(manifests.flatMap(m => (m.shots || []).map(s => s.file)));
  const coldStatus = fs.readdirSync(safe(base, statusDir)).filter(n => /\.[0-9a-f]{8}\.(png|gif)$/.test(n) && !activeStatus.has(n));
  return [...runs.filter(r => !active.has(r)).flatMap(r => filesUnder(base, runsDir + '/' + r)), ...coldStatus.map(n => statusDir + '/' + n)].sort();
}
const receiptDir = 'docs/visual/retention';
export function retainEvidence(base = root, { check = false } = {}) {
  const inventory = new Map(), dir = path.join(base, receiptDir);
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(safe(base, receiptDir)).filter(n => n.endsWith('.json'))) {
    const file = receiptDir + '/' + name, bytes = fs.readFileSync(safe(base, file));
    if (name !== digest(bytes) + '.json') throw Error('Retention receipt changed: ' + file);
    const receipt = JSON.parse(bytes);
    if (receipt.version !== 1 || !Array.isArray(receipt.files)) throw Error('Invalid retention receipt: ' + file);
    for (const entry of receipt.files) {
      const actual = bytesOf(base, entry.file);
      if (actual.length !== entry.bytes || digest(actual) !== entry.sha256) throw Error('Retained evidence changed or missing: ' + entry.file);
      inventory.set(entry.file, entry);
    }
  }
  const missing = coldEvidence(base).filter(file => !inventory.has(file));
  if (check && missing.length) throw Error(missing.length + ' older evidence files need a preserving inventory; run node scripts/visual-retain.mjs');
  if (missing.length) {
    const files = missing.map(file => { const bytes = bytesOf(base, file); return { file, bytes: bytes.length, sha256: digest(bytes) }; });
    const bytes = Buffer.from(JSON.stringify({ version: 1, recordedAt: new Date().toISOString(), policy: 'Preserve older evidence in place; no visual approval or disk-space reduction implied', textEncoding: 'UTF8 with Git LF normalisation; binary bytes unchanged', files }, null, 2) + '\n');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, digest(bytes) + '.json'), bytes, { flag: 'wx' });
  }
  return { retainedFiles: inventory.size + missing.length, newlyInventoried: missing.length, deleted: 0 };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log('Picture retention:', JSON.stringify(retainEvidence(root, { check: process.argv.includes('--check') }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
