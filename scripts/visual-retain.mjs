// Current owner instructions preserve evidence. Older bytes are inventoried in place: nothing is deleted and no link
// is rewritten. Immutable receipts in docs/visual/retention pin each older file's bytes, so corruption or any other
// change to a pinned file is caught. The one allowed change is a recorded redaction: a redaction record in the same
// folder carries the "redaction" field of scripts/redaction-note.mjs and, per path, the receipt's bytes (from) and
// the file's new bytes (to). A pinned file whose bytes differ passes only when exactly one redaction names its path,
// its old hash is the receipt's and its new hash is the file's. A redaction of a path no receipt pins, or of a file
// whose bytes did not change, is refused, and every other change is refused as before. A record whose only change
// is its pins of redacted copies and the field goes in a redaction record of the record kind, which is proved, not
// trusted: the check takes out the field, puts back the old hash in each pin of a redacted file, and the result
// must be the receipt's bytes exactly. Old hashes come from file and video redactions and from record entries already
// proved; proving repeats until a pass proves nothing new, so a record pinning a proved record is proved too, and an
// entry left unproved (a cycle among records grounded in no file or video redaction among them) is refused by name.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { REDACTION_FIELD, REDACTION_NOTE, noteKind, redactionValue } from './redaction-note.mjs';
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
const isPin = p => p && Number.isInteger(p.bytes) && typeof p.sha256 === 'string' && /^[0-9a-f]{64}$/.test(p.sha256);
const samePin = (a, b) => a.bytes === b.bytes && a.sha256 === b.sha256;
const RECORD_NOTE = JSON.stringify([REDACTION_NOTE.record]);
// Receipts and redaction records, both content-addressed. Redactions map a path to its one { file, from, to, kind }:
// kind 'record' for an entry of a record-kind redaction record, 'copy' for a redacted file or video.
function readRetention(base) {
  const receipts = [], redactions = new Map(), dir = path.join(base, receiptDir);
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(safe(base, receiptDir)).filter(n => n.endsWith('.json'))) {
    const file = receiptDir + '/' + name, bytes = fs.readFileSync(safe(base, file));
    if (name !== digest(bytes) + '.json') throw Error('Retention receipt changed: ' + file);
    const record = JSON.parse(bytes);
    if (!Object.hasOwn(record, REDACTION_FIELD)) {
      if (record.version !== 1 || !Array.isArray(record.files)) throw Error('Invalid retention receipt: ' + file);
      receipts.push(record);
      continue;
    }
    if (record.version !== 1 || !Array.isArray(record.files) || !record.files.length ||
      !record.files.every(e => e && typeof e.file === 'string' && isPin(e.from) && isPin(e.to))) throw Error('Invalid redaction record: ' + file);
    const note = JSON.stringify(record[REDACTION_FIELD]), kind = note === RECORD_NOTE ? 'record' : 'copy';
    if (kind === 'copy' && note !== JSON.stringify(redactionValue(new Set(record.files.map(e => noteKind(e.file)))))) throw Error('Redaction record without its fixed sentences: ' + file);
    for (const entry of record.files) {
      if (redactions.has(entry.file)) throw Error('Two redaction records for one path: ' + entry.file);
      redactions.set(entry.file, { ...entry, kind });
    }
  }
  const pinned = new Set(receipts.flatMap(r => r.files.map(e => e.file)));
  for (const file of redactions.keys()) if (!pinned.has(file)) throw Error('Redaction names a path no receipt pins: ' + file);
  return { receipts, redactions };
}
// A record entry: the record, without the field and with the old hash back in each pin found in `back` (a redacted
// file's new hash -> the old hashes it came from), must be the receipt's bytes, in the layout records are written in.
// Boxing can make copies byte-identical, so one new hash may have several old ones: each such pin tries each of them,
// and the record is proved when one assignment gives the receipt's bytes (the receipt's hash makes a match
// conclusive). At most ASSIGNMENTS are tried per record; stats.worst keeps the most any record needed. Returns why
// not, or null when it is proved.
const ASSIGNMENTS = 4096;
function proveRecord(actual, from, back, stats = {}) {
  let value;
  try { value = JSON.parse(actual.toString('utf8')); } catch { return 'not JSON'; }
  if (JSON.stringify(value, null, 2) + '\n' !== actual.toString('utf8')) return 'not in its written layout';
  const carriers = Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && Object.hasOwn(v, REDACTION_FIELD)) : Object.hasOwn(value, REDACTION_FIELD) ? [value] : [];
  if (!carriers.length) return 'does not carry the field';
  for (const obj of carriers) delete obj[REDACTION_FIELD];
  const pins = []; // [holder, key, old hashes to try]
  const find = v => {
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) typeof x === 'string' && back.has(x) ? pins.push([v, k, back.get(x)]) : find(x);
  };
  find(value);
  if (!pins.length) return 'pins no redacted file';
  const total = pins.reduce((n, p) => n * p[2].length, 1);
  stats.worst = Math.max(stats.worst || 0, total);
  if (total > ASSIGNMENTS) return `more than ${ASSIGNMENTS} ways to put back its pins`;
  for (let i = 0; i < total; i += 1) {
    let rest = i;
    for (const [holder, key, olds] of pins) { holder[key] = olds[rest % olds.length]; rest = Math.floor(rest / olds.length); }
    const old = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    if (samePin({ bytes: old.length, sha256: digest(old) }, from)) return null;
  }
  return 'changed more than its pins of redacted files';
}
const addBack = (back, to, from) => back.set(to, [...new Set([...(back.get(to) || []), from])]);
// Proves entries by fixpoint. `known` holds the [new hash, old hash] pairs of file and video redactions; each pass
// proves every entry that `prove(entry, back)` accepts with the pairs known so far, and adds its own. Passes stop when
// one proves nothing new, and are at most one per entry. A cycle never proves itself: none of its members can be
// proved first.
export function proveByFixpoint(entries, known, prove) {
  const back = new Map(), why = new Map();
  for (const [to, from] of known) addBack(back, to, from);
  let left = entries, passes = 0;
  while (left.length && passes < entries.length) {
    passes += 1;
    const next = left.filter(e => { const failure = prove(e, back); if (failure) why.set(e, failure); else addBack(back, e.to.sha256, e.from.sha256); return failure; });
    const progress = next.length < left.length;
    left = next;
    if (!progress) break;
  }
  return { passes, unproved: left.map(e => [e, why.get(e)]) };
}
export function retainEvidence(base = root, { check = false } = {}) {
  const inventory = new Map(), dir = path.join(base, receiptDir), { receipts, redactions } = readRetention(base);
  const copies = [...redactions.values()].filter(r => r.kind === 'copy').map(r => [r.to.sha256, r.from.sha256]), records = new Map();
  for (const receipt of receipts) for (const entry of receipt.files) {
    const actual = bytesOf(base, entry.file), now = { bytes: actual.length, sha256: digest(actual) }, redaction = redactions.get(entry.file);
    if (samePin(now, entry)) {
      if (redaction) throw Error('Redaction names a file whose bytes did not change: ' + entry.file);
    } else if (!redaction) throw Error('Retained evidence changed or missing: ' + entry.file);
    else if (!samePin(redaction.from, entry)) throw Error('Redaction old hash is not the receipt\'s: ' + entry.file);
    else if (!samePin(redaction.to, now)) throw Error('Redaction new hash is not the file\'s: ' + entry.file);
    else if (redaction.kind === 'record') records.set(entry.file, { ...redaction, actual });
    inventory.set(entry.file, entry);
  }
  const stats = { worst: 0 };
  const { passes, unproved } = proveByFixpoint([...records.values()], copies, (e, back) => proveRecord(e.actual, e.from, back, stats));
  if (unproved.length) throw Error('Redacted records not proved: ' + unproved.map(([e, why]) => e.file + ' (' + why + ')').join('; '));
  const missing = coldEvidence(base).filter(file => !inventory.has(file));
  if (check && missing.length) throw Error(missing.length + ' older evidence files need a preserving inventory; run node scripts/visual-retain.mjs');
  if (missing.length) {
    const files = missing.map(file => { const bytes = bytesOf(base, file); return { file, bytes: bytes.length, sha256: digest(bytes) }; });
    const bytes = Buffer.from(JSON.stringify({ version: 1, recordedAt: new Date().toISOString(), policy: 'Preserve older evidence in place; no visual approval or disk-space reduction implied', textEncoding: 'UTF8 with Git LF normalisation; binary bytes unchanged', files }, null, 2) + '\n');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, digest(bytes) + '.json'), bytes, { flag: 'wx' });
  }
  return { retainedFiles: inventory.size + missing.length, newlyInventoried: missing.length, redacted: redactions.size, recordPasses: passes, recordWorstWays: stats.worst, deleted: 0 };
}
// Writes one redaction record for files already redacted in place: each must be pinned by a receipt, have no
// redaction yet and differ from its receipt's bytes. The check above then holds it to those two hashes.
export function recordRedaction(base, files, { records = false } = {}) {
  const { receipts, redactions } = readRetention(base), pins = new Map(receipts.flatMap(r => r.files.map(e => [e.file, e])));
  const entries = [...new Set(files)].sort().map(file => {
    const pin = pins.get(file);
    if (!pin) throw Error('No receipt pins: ' + file);
    if (redactions.has(file)) throw Error('Already redacted: ' + file);
    const actual = bytesOf(base, file), to = { bytes: actual.length, sha256: digest(actual) };
    if (samePin(to, pin)) throw Error('Bytes did not change: ' + file);
    return { file, from: { bytes: pin.bytes, sha256: pin.sha256 }, to };
  });
  if (!entries.length) throw Error('No files to record');
  const note = records ? [REDACTION_NOTE.record] : redactionValue(new Set(entries.map(e => noteKind(e.file))));
  const bytes = Buffer.from(JSON.stringify({ [REDACTION_FIELD]: note, version: 1,
    recordedAt: new Date().toISOString(), files: entries }, null, 2) + '\n');
  fs.writeFileSync(path.join(base, receiptDir, digest(bytes) + '.json'), bytes, { flag: 'wx' });
  return { recorded: entries.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // --redact reads the redacted paths, one per line, from standard input; --redact-records the records whose only
    // change is their pins of those files and the field.
    const redact = ['--redact', '--redact-records'].find(a => process.argv.includes(a));
    if (redact) console.log('Picture redaction:', JSON.stringify(recordRedaction(root, fs.readFileSync(0, 'utf8').split('\n').filter(Boolean), { records: redact === '--redact-records' })));
    else console.log('Picture retention:', JSON.stringify(retainEvidence(root, { check: process.argv.includes('--check') })));
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
