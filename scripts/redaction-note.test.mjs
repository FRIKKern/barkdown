// Pins the "redaction" field of hash records. The field is always an array of the fixed sentences for the kinds of
// file the object pins: the text/picture sentence, the video sentence, or both in that order. It sits on a record's
// top-level object or on items of a top-level array. The video sentence needs a pinned tracked video; with both
// sentences the object also pins a file that is not a video. EXAMPLES names one record per kind of redacted file.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REDACTION_FIELD, REDACTION_NOTE, REDACTION_ORDER, noteKind, redactionValue } from './redaction-note.mjs';

const F = 'Redacted copy: a user folder, name or email is replaced by <user>, <name> or <email> in text, or covered by a box in a picture; nothing else changed.';
const V = 'Redacted copy: a user folder, name or email is covered by a box; re-encoded losslessly (VP9), so every pixel outside the boxes is unchanged.';
assert.equal(REDACTION_FIELD, 'redaction');
assert.equal(REDACTION_NOTE.file, F);
assert.equal(REDACTION_NOTE.video, V);
assert.deepEqual(REDACTION_ORDER, ['file', 'video']);
assert.deepEqual(redactionValue(new Set(['video', 'file'])), [F, V]);
assert.deepEqual(redactionValue(new Set(['file'])), [F]);
assert.equal(noteKind('a/b.webm'), 'video'); assert.equal(noteKind('a/b.png'), 'file'); assert.equal(noteKind('a/b.json'), 'file');
const ALLOWED = [[F], [V], [F, V]].map(v => JSON.stringify(v));

const root = new URL('../', import.meta.url);
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex');
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const videoHashes = new Set(tracked.filter(f => noteKind(f) === 'video').map(sha));
const hashesIn = obj => [...JSON.stringify(obj).matchAll(/"([0-9a-f]{64})"/g)].map(m => m[1]);
let records = [];
try {
  records = git(['grep', '-l', '-z', '--fixed-strings', `"${REDACTION_FIELD}"`, '--', '*.json', '*.log']).split('\0').filter(Boolean);
} catch (error) {
  if (error.status !== 1) throw error; // 1 = no match
}

// The objects of a record that may carry the field: the top-level object, or each object item of a top-level array.
const objectsOf = value => (Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && !Array.isArray(v)) : [value]);

let checked = 0;
const noted = new Map(); // record -> objects carrying the field
for (const record of records) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(new URL(record, root), 'utf8'));
  } catch {
    continue; // the word appears in a file that is not a JSON record
  }
  if (!value || typeof value !== 'object') continue;
  const carriers = objectsOf(value).filter(obj => Object.hasOwn(obj, REDACTION_FIELD));
  for (const obj of carriers) {
    const note = obj[REDACTION_FIELD];
    assert.ok(ALLOWED.includes(JSON.stringify(note)), `${record}: "${REDACTION_FIELD}" must be one of the fixed sentence arrays`);
    const hashes = hashesIn(obj);
    if (note.includes(V)) assert.ok(hashes.some(h => videoHashes.has(h)), `${record}: the video sentence needs a pinned video`);
    if (note.includes(V) && note.includes(F)) assert.ok(hashes.some(h => !videoHashes.has(h)), `${record}: the text/picture sentence needs a pinned file that is not a video`);
    checked += 1;
  }
  if (carriers.length) noted.set(record, carriers);
}

// Pins, judged against BASE, the commit the redaction started from. A pin is a sha256 value (or a size next to one)
// in an object that carries the field. Each one is compared with the value at the same place in the record at BASE:
// - a pin that matched content the redaction changed (a file's bytes, the same with CRLF as LF, or a base64 payload
//   inside the file) must now match that content's current bytes, and a size next to it its current length;
// - every other pin is byte-identical to BASE. Among those, a pin that names a docs/ file either matched it at BASE
//   (and still does) or was already stale at BASE (it pins an earlier version) and is left as it was.
const BASE = 'eeae412efd570d3d81ba196e450ce2f34acfb586';
const NAME_KEYS = ['file', 'name', 'path', 'relative', 'target'];
const HASH_KEYS = ['sha256', 'hash', 'digest'];
const SIZE_KEYS = ['bytes', 'size', 'capturedBytes', 'length', 'byteLength'];
const HEX = /^[0-9a-f]{64}$/;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const atBase = paths => { // bytes of each path at BASE (undefined when it did not exist), one git process
  const out = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: paths.map(p => `${BASE}:${p}\n`).join(''), maxBuffer: 2 ** 31 - 1 });
  const result = new Map();
  let at = 0;
  for (const p of paths) {
    const end = out.indexOf(10, at);
    const header = out.subarray(at, end).toString();
    at = end + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    result.set(p, out.subarray(at, at + size));
    at += size + 1;
  }
  return result;
};
// The content units of a file, in a fixed order: raw bytes, the same with CRLF as LF, then each base64 payload
// (a whole-file payload, or base64 string values of a JSON file).
const units = bytes => {
  const raw = Buffer.from(bytes);
  const out = [raw, Buffer.from(raw.toString('latin1').replaceAll('\r\n', '\n'), 'latin1')];
  const text = raw.toString('latin1');
  const flat = text.replace(/\s+/g, '');
  const b64 = s => s.length >= 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
  if (b64(flat)) out.push(Buffer.from(flat, 'base64'));
  else if (/^\s*[[{]/.test(text)) {
    try {
      const strings = [];
      JSON.parse(raw.toString('utf8'), (k, v) => { if (typeof v === 'string') strings.push(v.replace(/\s+|\\n/g, '')); return v; });
      for (const s of strings) if (b64(s) && !HEX.test(s)) out.push(Buffer.from(s, 'base64'));
    } catch { /* not JSON */ }
  }
  return out;
};
const changedFiles = git(['diff', '--name-only', '-z', BASE]).split('\0').filter(f => f && fs.existsSync(new URL(f, root)));
const changedBase = atBase(changedFiles);
const moved = new Map(); // sha256 at BASE -> [{ now, lenBase, lenNow }] of content the redaction changed
for (const f of changedFiles) {
  if (!changedBase.has(f)) continue;
  const before = units(changedBase.get(f));
  const after = units(fs.readFileSync(new URL(f, root)));
  if (before.length !== after.length) continue;
  before.forEach((b, i) => {
    const hb = digest(b), ha = digest(after[i]);
    if (hb !== ha) moved.set(hb, [...(moved.get(hb) || []), { now: ha, lenBase: b.length, lenNow: after[i].length }]);
  });
}

const trackedSet = new Set(tracked);
const changedSet = new Set(changedFiles);
const resolveName = (name, record) => {
  const parts = name.split(/[\\/]+/).filter(Boolean);
  const direct = parts.join('/');
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(record), direct));
  const top = parts.findIndex(x => ['docs', 'app', 'scripts'].includes(x));
  return [direct, rel, top >= 0 ? parts.slice(top).join('/') : null].find(c => c && trackedSet.has(c)) || null;
};
const baseHashesOf = file => units(changedSet.has(file) ? changedBase.get(file) || Buffer.alloc(0) : fs.readFileSync(new URL(file, root))).slice(0, 2).map(digest);

const pins = { moved: 0, sizes: 0, same: 0, namedMatched: 0, namedStale: 0 };
const wrong = [];
const visit = (cur, old, record, where) => {
  if (Array.isArray(cur)) return cur.forEach((v, i) => visit(v, Array.isArray(old) ? old[i] : undefined, record, `${where}[${i}]`));
  if (!cur || typeof cur !== 'object') return;
  const names = NAME_KEYS.map(k => cur[k]).filter(v => typeof v === 'string');
  const movedHere = [];
  // Keys pair with the base by position: the redaction keeps key order, may rewrite a key that is a local path,
  // and adds the field as the first key.
  const keys = Object.keys(cur).filter(k => !(k === REDACTION_FIELD && !(old && Object.hasOwn(old, k))));
  const oldKeys = old && typeof old === 'object' && !Array.isArray(old) ? Object.keys(old) : [];
  if (oldKeys.length && oldKeys.length !== keys.length) wrong.push(`${record}${where}: keys added or removed`);
  for (const [i, key] of keys.entries()) {
    const value = cur[key];
    const was = oldKeys.length ? old[oldKeys[i]] : undefined;
    if (typeof value !== 'string' || !HEX.test(value)) { visit(value, was, record, `${where}/${key}`); continue; }
    if (moved.has(was)) {
      const hit = moved.get(was).find(m => m.now === value);
      if (hit) { pins.moved += 1; movedHere.push(hit); } else wrong.push(`${record}${where}/${key}: matched changed content at the base, not its current bytes`);
      continue;
    }
    if (value !== was) { wrong.push(`${record}${where}/${key}: changed, but it did not pin changed content at the base`); continue; }
    pins.same += 1;
    const name = /[\\/.]/.test(key) ? key : HASH_KEYS.includes(key) && names.length === 1 ? names[0] : null;
    const file = name && resolveName(name, record);
    if (file && file.startsWith('docs/')) baseHashesOf(file).includes(was) ? (pins.namedMatched += 1) : (pins.namedStale += 1);
  }
  for (const key of SIZE_KEYS.filter(k => Number.isInteger(cur[k]))) {
    const was = oldKeys.length ? old[oldKeys[keys.indexOf(key)]] : undefined;
    const hit = movedHere.find(m => m.lenBase === was);
    if (hit && hit.lenBase !== hit.lenNow) {
      if (cur[key] === hit.lenNow) pins.sizes += 1; else wrong.push(`${record}${where}/${key}: still the length at the base`);
    } else if (cur[key] !== was) wrong.push(`${record}${where}/${key}: changed without a changed pin of that length`);
  }
};
const baseRecords = atBase([...noted.keys()]);
for (const record of noted.keys()) {
  assert.ok(baseRecords.has(record), `${record}: a record that carries the field existed at the base`);
  const base = JSON.parse(baseRecords.get(record).toString('utf8'));
  const now = JSON.parse(fs.readFileSync(new URL(record, root), 'utf8'));
  if (Array.isArray(now)) now.forEach((item, i) => item && typeof item === 'object' && Object.hasOwn(item, REDACTION_FIELD) && visit(item, base[i], record, `[${i}]`));
  else visit(now, base, record, '');
}
assert.deepEqual(wrong, [], 'pins that do not follow the rule above');

// One record per kind of redacted file: [record, the redacted file it pins, kind of that file].
const EXAMPLES = JSON.parse(fs.readFileSync(new URL('./redaction-note.examples.json', import.meta.url), 'utf8'));
for (const [record, file, kind] of EXAMPLES.kinds) {
  assert.ok(['text', 'picture', 'video'].includes(kind));
  const pin = sha(file);
  const carrier = (noted.get(record) || []).find(obj => hashesIn(obj).includes(pin));
  assert.ok(carrier, `${record} must pin ${file} in an object that carries "${REDACTION_FIELD}"`);
  assert.ok(carrier[REDACTION_FIELD].includes(REDACTION_NOTE[noteKind(file)]), `${record} must carry the ${noteKind(file)} sentence`);
}
assert.deepEqual([...new Set(EXAMPLES.kinds.map(e => e[2]))].sort(), ['picture', 'text', 'video']);
console.log(`redaction note: ${checked} objects in ${noted.size} records; pins: ${pins.moved} follow changed content, ${pins.sizes} sizes with them; ${pins.same} unchanged, of which ${pins.namedMatched} name a docs/ file they matched at the base and ${pins.namedStale} were already stale there`);
