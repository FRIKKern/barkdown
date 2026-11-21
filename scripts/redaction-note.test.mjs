// Pins the "redaction" field of hash records. The field is always an array of the fixed sentences for the kinds of
// file the object pins: the text/picture sentence, the video sentence, or both in that order. It sits on a record's
// top-level object or on items of a top-level array. The video sentence needs a pinned tracked video with content;
// with both sentences the object also pins a file that is not a video. EXAMPLES names one record per kind of
// redacted file the records hold: the kinds are read from the records that carry the field (a file the redaction
// changed, pinned at its current bytes by an object that carries its sentence); each kind present needs one
// example, an example's file must have content, and a kind no record holds needs none.
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
const R = 'Record of redacted copies: only the pins of the redacted files and this field changed.';
assert.equal(REDACTION_NOTE.record, R);
assert.deepEqual(REDACTION_ORDER, ['file', 'video']);
assert.deepEqual(redactionValue(new Set(['video', 'file'])), [F, V]);
assert.deepEqual(redactionValue(new Set(['file'])), [F]);
assert.equal(noteKind('a/b.webm'), 'video'); assert.equal(noteKind('a/b.png'), 'file'); assert.equal(noteKind('a/b.json'), 'file');
const ALLOWED = [[F], [V], [F, V]].map(v => JSON.stringify(v));
// The record sentence stands alone, and only on a visual-retain.mjs redaction record (see below).
const RETENTION = 'docs/visual/retention/';

const root = new URL('../', import.meta.url);
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex');
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const videoHashes = new Set(tracked.filter(f => noteKind(f) === 'video' && fs.statSync(new URL(f, root)).size > 0).map(sha));
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
    assert.ok(ALLOWED.includes(JSON.stringify(note)) || (record.startsWith(RETENTION) && JSON.stringify(note) === JSON.stringify([R])),
      `${record}: "${REDACTION_FIELD}" must be one of the fixed sentence arrays`);
    const hashes = hashesIn(obj);
    if (note.includes(V)) assert.ok(hashes.some(h => videoHashes.has(h)), `${record}: the video sentence needs a pinned tracked video with content`);
    if (note.includes(V) && note.includes(F)) assert.ok(hashes.some(h => !videoHashes.has(h)), `${record}: the text/picture sentence needs a pinned file that is not a video`);
    checked += 1;
  }
  if (carriers.length) noted.set(record, carriers);
}

// A record that carries the field holds no user folder except <user>, and no personal name as a whole word. The names
// are read at run time and never printed; a failure names the record and the kind of match only. Where no name is
// set (and always in CI) the name half is skipped, and the output says so.
const gitValue = args => { try { return git(args).trim(); } catch { return ''; } };
const personal = process.env.CI ? [] : [...new Set([...gitValue(['config', 'user.name']).split(/\s+/),
  gitValue(['config', 'user.email']).split('@')[0], process.env.USER || ''].map(w => w.toLowerCase()).filter(w => w.length >= 4))];
if (!personal.length) console.log('name check skipped: no name set');
const userFolder = /(?:[A-Za-z]:(?:\\{1,2}|\/)+Users(?:\\{1,2}|\/)+|\/Users\/|\/home\/)(?!<user>)[^\\/\s"'<>|:]+/i;
const stillPersonal = [];
for (const record of noted.keys()) {
  const text = fs.readFileSync(new URL(record, root), 'utf8');
  if (userFolder.test(text)) stillPersonal.push(`${record}: a user folder that is not <user>`);
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u));
  if (personal.some(w => words.has(w))) stillPersonal.push(`${record}: a personal name`);
}
assert.deepEqual(stillPersonal, [], `records that carry "${REDACTION_FIELD}" must not still hold what it says was replaced`);
console.log(`replaced: ${noted.size} records hold no user folder${personal.length ? ' and no personal name' : ''}`);

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
// Every file that differs from BASE (added, changed or deleted, renames as both sides) is in exactly one bucket:
// - evidence: a file under docs/. Only evidence is content the redaction can change: its bytes, the same with CRLF as
//   LF, and base64 payloads inside it count as changed content, and a pin that matched one at BASE must follow it.
// - code: any other file with no NUL byte at BASE or now. A code file is never redaction content, so a pin of it is
//   held byte-identical to its pin at BASE, like every pin of unchanged content.
// - anything else (a file outside docs/ with a NUL byte) is red, by name.
const CODE_RULE = 'code file = outside docs/ and no NUL byte at the base or now';
const isEvidence = f => f.startsWith('docs/');
const differing = git(['diff', '--name-only', '-z', '--no-renames', BASE]).split('\0').filter(Boolean);
const outsideBase = atBase(differing.filter(f => !isEvidence(f)));
const hasNul = f => (outsideBase.get(f) || Buffer.alloc(0)).includes(0) || (fs.existsSync(new URL(f, root)) && fs.readFileSync(new URL(f, root)).includes(0));
const bucket = f => (isEvidence(f) ? 'evidence' : hasNul(f) ? 'other' : 'code');
const buckets = { evidence: [], code: [], other: [] };
for (const f of differing) buckets[bucket(f)].push(f);
assert.deepEqual(buckets.other, [], `files that differ from the base and are neither evidence under docs/ nor code (${CODE_RULE})`);
console.log(`differing files: ${buckets.evidence.length} evidence, ${buckets.code.length} code, ${buckets.other.length} other (${CODE_RULE})`);
const changedFiles = git(['diff', '--name-only', '-z', BASE]).split('\0').filter(f => f && fs.existsSync(new URL(f, root)));
const changedBase = atBase(changedFiles);
const moved = new Map(); // sha256 at BASE -> [{ now, lenBase, lenNow }] of evidence content the redaction changed
const redactedNow = new Map(); // current sha256 of an evidence file the redaction changed -> those files
for (const f of changedFiles) {
  if (!changedBase.has(f) || !isEvidence(f)) continue;
  const before = units(changedBase.get(f));
  const after = units(fs.readFileSync(new URL(f, root)));
  const hNow = digest(after[0]);
  redactedNow.set(hNow, [...(redactedNow.get(hNow) || []), f]);
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

// Array items pair with their base item by key (the first of KEYED that every item holds as a string, at the base and
// now, with no two items alike on either side); an array without such a key pairs by position. A base item may be
// gone only from a keyed array, and only when every pin in it is the base bytes of a file this change deletes;
// any other item gone is wrong, by name.
const KEYED = ['path', 'file', 'name'];
// The key must also be unchanged for every item kept: an array whose key values the redaction rewrote (a local path
// made <user>) pairs by position, as before.
const keyOf = (cur, old) => KEYED.find(k => [cur, old].every(a => a.every(v => v && typeof v === 'object' && !Array.isArray(v) &&
  typeof v[k] === 'string') && new Set(a.map(v => v[k])).size === a.length) && cur.every(v => old.some(o => o[k] === v[k])));
// Object keys pair by position (the redaction may rewrite a key that is a local path), after the same rule takes out
// a base key that is gone now: it names a file this change deletes (the key itself, or its value as a name), and a
// pin it holds is that file's base bytes. A pin alone proves nothing: an empty file, or two files with the same
// bytes, share it. Neither an item nor a key may go while the record still names that file somewhere else.
// Deleted files come from git's diff with its rename detection on: a file whose exact bytes were added at another
// path counts as moved, not deleted, so nothing that names it may leave (the strict side, kept on purpose).
const deletedFiles = git(['diff', '--name-only', '-z', '--diff-filter=D', BASE]).split('\0').filter(Boolean);
const deletedSet = new Set(deletedFiles);
const deletedBase = new Map([...atBase(deletedFiles)].map(([f, b]) => [f, new Set(units(b).slice(0, 2).map(digest))]));
const deletedByPin = new Map();   // base digest -> the deleted files with those bytes (more than one when they share them)
for (const [f, ds] of deletedBase) for (const d of ds) deletedByPin.set(d, [...new Set([...(deletedByPin.get(d) || []), f])]);
const isPin = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const deletedNamed = (name, record) => {
  if (typeof name !== 'string' || !name || /\s/.test(name)) return null;
  const parts = name.split(/[\\/]+/).filter(Boolean);
  const direct = parts.join('/');
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(record), direct));
  const top = parts.findIndex(x => ['docs', 'app', 'scripts'].includes(x));
  return [direct, rel, top >= 0 ? parts.slice(top).join('/') : null].find(c => c && deletedSet.has(c)) || null;
};
// A bare name also counts when it is the file name of a deleted file that the record pinned at the base.
const pinnedGone = base => hashesIn(base).flatMap(h => deletedByPin.get(h) || []);
// The deleted file a string names: a path that resolves to it; or, for a string that names no tracked file, its file
// name (a bare name, or a path in another folder layout, as an inventory of a copied folder holds) when that is the
// file name of a deleted file whose base bytes are pinned in `pinned` (the base record, or the item itself), and no
// file still tracked has that file name and those bytes (then the name is ambiguous and names nothing).
const byName = new Map();   // file name -> tracked files with it
for (const f of tracked) { const b = path.posix.basename(f); byName.set(b, [...(byName.get(b) || []), f]); }
const keptTwin = new Map();
const hasKeptTwin = file => {
  if (!keptTwin.has(file)) keptTwin.set(file, (byName.get(path.posix.basename(file)) || []).some(t => !deletedSet.has(t) &&
    fs.existsSync(new URL(t, root)) && units(fs.readFileSync(new URL(t, root))).slice(0, 2).map(digest).some(d => deletedBase.get(file).has(d))));
  return keptTwin.get(file);
};
const nameOf = (value, record, pinned = recordBase) => {
  if (typeof value !== 'string' || isPin(value) || !value || /\s/.test(value)) return null;
  const direct = deletedNamed(value, record);
  if (direct || resolveName(value, record)) return direct;
  const base = value.split(/[\\/]+/).filter(Boolean).pop();
  const file = pinnedGone(pinned).find(f => path.posix.basename(f) === base);
  return file && !hasKeptTwin(file) ? file : null;
};
// For "still names": a name, or a pin of a deleted file's base bytes.
const deletedOf = (value, record) => (typeof value !== 'string' ? null : (deletedByPin.get(value) || [])[0] || nameOf(value, record));
// The deleted file a gone key (k: value) leaves with, or null: the key or its value names it, and every pin the
// value holds is that file's base bytes (a name value with no pin: the name alone).
const goneKey = (k, value, record) => {
  const file = nameOf(k, record) || nameOf(value, record);
  if (!file) return null;
  const hs = isPin(value) ? [value] : value && typeof value === 'object' ? hashesIn(value) : [];
  return hs.every(h => deletedBase.get(file).has(h)) ? file : null;
};
const namedNow = new Map(); // record -> deleted files its current text still names (a pin or a name)
const stillNames = (record, now) => {
  if (!namedNow.has(record)) {
    const seen = new Set();
    const walk = v => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { const d = deletedOf(k, record); if (d) seen.add(d); walk(x); }
      else { const d = deletedOf(v, record); if (d) seen.add(d); }
    };
    walk(now);
    namedNow.set(record, seen);
  }
  return namedNow.get(record);
};
// The deleted files a gone array item leaves with, or null: a string value of the item names them, it holds a pin,
// and every pin in it is the base bytes of one of them.
const goneItem = (v, record) => {
  const hs = hashesIn(v);
  const named = [...new Set(Object.values(v).map(x => nameOf(x, record, v)).filter(Boolean))];
  return hs.length && named.length && hs.every(h => named.some(f => deletedBase.get(f).has(h))) ? named : null;
};
const pins = { moved: 0, sizes: 0, same: 0, namedMatched: 0, namedStale: 0, removed: 0, twins: 0 };
const wrong = [];
const visit = (cur, old, record, where) => {
  if (Array.isArray(cur)) {
    const base = Array.isArray(old) ? old : undefined;
    const key = base && base.length ? keyOf(cur, base) : undefined;
    if (!key) {
      if (base && base.length > cur.length) wrong.push(`${record}${where}: ${base.length - cur.length} item(s) gone from an array without a unique key`);
      return cur.forEach((v, i) => visit(v, base ? base[i] : undefined, record, `${where}[${i}]`));
    }
    const byKey = new Map(base.map(v => [v[key], v]));
    cur.forEach((v, i) => visit(v, byKey.get(v[key]), record, `${where}[${i}]`));
    const now = new Set(cur.map(v => v[key]));
    base.forEach((v, i) => {
      if (now.has(v[key])) return;
      const files = goneItem(v, record);
      if (!files) wrong.push(`${record}${where}: base item ${i} is gone, but it does not name a file this change deletes with that file's base bytes`);
      else if (files.some(f => stillNames(record, recordNow).has(f))) wrong.push(`${record}${where}: base item ${i} is gone, but the record still names its file`);
      else pins.removed += 1;
    });
    return;
  }
  if (!cur || typeof cur !== 'object') return;
  const names = NAME_KEYS.map(k => cur[k]).filter(v => typeof v === 'string');
  const movedHere = [];
  // Keys pair with the base by position: the redaction keeps key order, may rewrite a key that is a local path,
  // and adds the field as the first key.
  const keys = Object.keys(cur).filter(k => !(k === REDACTION_FIELD && !(old && Object.hasOwn(old, k))));
  let oldKeys = old && typeof old === 'object' && !Array.isArray(old) ? Object.keys(old) : [];
  for (const k of oldKeys.filter(k => !Object.hasOwn(cur, k))) {
    const file = goneKey(k, old[k], record);
    if (!file) continue;   // not a reference to a deleted file: it stays in the pairing, and the count below is red
    if (stillNames(record, recordNow).has(file)) { wrong.push(`${record}${where}: a key is gone with its file, but the record still names that file`); continue; }
    pins.removed += 1; oldKeys = oldKeys.filter(x => x !== k);
  }
  if (oldKeys.length && oldKeys.length !== keys.length) wrong.push(`${record}${where}: keys added or removed (${oldKeys.length} at the base, ${keys.length} now)`);
  for (const [i, key] of keys.entries()) {
    const value = cur[key];
    const was = oldKeys.length ? old[oldKeys[i]] : undefined;
    if (typeof value !== 'string' || !HEX.test(value)) { visit(value, was, record, `${where}/${key}`); continue; }
    // Changed content is found by its base bytes, so a file that had the same bytes at the base as a changed
    // evidence file (two docs/ copies of one file, one of them redacted) shares the hash. Such a pin stays when it
    // names that file, the file is unchanged since the base, and the pin is still its bytes. Code files main edited
    // no longer count as changed content, so they make no twins; the twin row of redaction-note.rows.test.mjs
    // holds this case on a fixture.
    const named = (/[\\/.]/.test(key) ? key : HASH_KEYS.includes(key) && names.length === 1 ? names[0] : null);
    const namedFile = named && resolveName(named, record);
    const unchangedTwin = value === was && namedFile && !changedSet.has(namedFile) && baseHashesOf(namedFile).includes(value);
    if (moved.has(was) && unchangedTwin) pins.twins += 1;
    if (moved.has(was) && !unchangedTwin) {
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
// A record that carries the field and did not exist at the base is a redaction record of visual-retain.mjs: it sits
// in docs/visual/retention, and each entry names an evidence file this change redacted, from that file's bytes at
// the base to its bytes now. visual-retain.mjs --check holds the same entry to the receipt that pins the file.
const nowHashesOf = file => units(fs.readFileSync(new URL(file, root))).slice(0, 2).map(digest);
let addedRecords = 0;
for (const record of [...noted.keys()].filter(r => !baseRecords.has(r))) {
  assert.ok(record.startsWith(RETENTION), `${record}: a record that carries the field existed at the base, or is a redaction record in ${RETENTION}`);
  const now = JSON.parse(fs.readFileSync(new URL(record, root), 'utf8'));
  assert.ok(Array.isArray(now.files) && now.files.length, `${record}: a redaction record lists its files`);
  for (const e of now.files) {
    const ok = typeof e?.file === 'string' && isEvidence(e.file) && changedSet.has(e.file) && changedBase.has(e.file) &&
      baseHashesOf(e.file).includes(e.from?.sha256) && nowHashesOf(e.file).includes(e.to?.sha256);
    if (!ok) wrong.push(`${record}: an entry is not an evidence file this change redacted, from its base bytes to its bytes now`);
  }
  addedRecords += 1;
}
let recordNow, recordBase;
for (const record of [...noted.keys()].filter(r => baseRecords.has(r))) {
  const base = JSON.parse(baseRecords.get(record).toString('utf8'));
  const now = JSON.parse(fs.readFileSync(new URL(record, root), 'utf8'));
  recordNow = now; recordBase = base;
  if (Array.isArray(now)) now.forEach((item, i) => item && typeof item === 'object' && Object.hasOwn(item, REDACTION_FIELD) && visit(item, base[i], record, `[${i}]`));
  else visit(now, base, record, '');
}
assert.deepEqual(wrong, [], 'pins that do not follow the rule above');

// One record per kind of redacted file the records hold: [record, the redacted file it pins, kind of that file]. The
// kinds are read from the records that carry the field: a file the redaction changed, pinned at its current bytes by
// an object that carries that file's sentence. Each kind present needs one example; an example's file must have
// content; a kind no record holds needs none.
const kindOf = file => (noteKind(file) === 'video' ? 'video' : /\.(png|jpe?g|gif|webp|svg|icns|ico)$/i.test(file) ? 'picture' : 'text');
const held = new Map(); // kind -> a record that holds it
for (const [record, carriers] of noted) {
  for (const obj of carriers) {
    for (const h of hashesIn(obj)) {
      for (const f of redactedNow.get(h) || []) {
        if (obj[REDACTION_FIELD].includes(REDACTION_NOTE[noteKind(f)]) && !held.has(kindOf(f))) held.set(kindOf(f), record);
      }
    }
  }
}
const EXAMPLES = JSON.parse(fs.readFileSync(new URL('./redaction-note.examples.json', import.meta.url), 'utf8'));
for (const [record, file, kind] of EXAMPLES.kinds) {
  assert.ok(['text', 'picture', 'video'].includes(kind));
  assert.equal(kindOf(file), kind, `${file} is not a ${kind} file`);
  assert.ok(fs.statSync(new URL(file, root)).size > 0, `${record}: its ${kind} example ${file} is empty; an example must have content`);
  const pin = sha(file);
  const carrier = (noted.get(record) || []).find(obj => hashesIn(obj).includes(pin));
  assert.ok(carrier, `${record} must pin ${file} in an object that carries "${REDACTION_FIELD}"`);
  assert.ok(carrier[REDACTION_FIELD].includes(REDACTION_NOTE[noteKind(file)]), `${record} must carry the ${noteKind(file)} sentence`);
}
const exampled = new Set(EXAMPLES.kinds.map(e => e[2]));
const missing = [...held.keys()].filter(k => !exampled.has(k)).sort();
assert.deepEqual(missing, [], `kinds of redacted file the records hold with no example: ${missing.map(k => `${k} (held by ${held.get(k)})`).join(', ')}`);
console.log(`redaction examples: kinds held ${[...held.keys()].sort().join(', ') || 'none'}; examples ${[...exampled].sort().join(', ') || 'none'}`);
console.log(`redaction note: ${checked} objects in ${noted.size} records; pins: ${pins.moved} follow changed content, ${pins.sizes} sizes with them; ${pins.same} unchanged, of which ${pins.namedMatched} name a docs/ file they matched at the base and ${pins.namedStale} were already stale there, and ${pins.twins} are twins; ${pins.removed} items gone with the file this change deletes; ${addedRecords} redaction records added`);
