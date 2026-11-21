// The one allowed change to a pinned file is a recorded redaction (see visual-retain.mjs). Each row builds its own
// fixture: older evidence inventoried by a receipt (a run with a picture, a manifest pinning it and a comparison
// pinning that manifest and a newer picture), then the picture boxed in place.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { proveByFixpoint, recordRedaction, retainEvidence } from './visual-retain.mjs';
import { REDACTION_FIELD, REDACTION_NOTE, redactionValue } from './redaction-note.mjs';

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = n => `docs/visual/runs/2026-10-0${n}T00-00-00-000Z`;
const frame = run(3) + '/frame.png', status = 'docs/images/status/paper.33333333.png';
const manifest = run(3) + '/manifest.json', comparison = run(3) + '/comparison.json', newer = run(4) + '/frame.png';
const pin = bytes => ({ bytes: bytes.length, sha256: digest(bytes) });
const layout = value => JSON.stringify(value, null, 2) + '\n';
const RECORD = [REDACTION_NOTE.record];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-redaction-'));
  const put = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value) + '\n'); };
  for (const n of [1, 2, 3, 4, 5]) { put(run(n) + '/manifest.json', { environment: { platform: 'win32' } }); put(run(n) + '/frame.png', `fixture media ${n}`); }
  put('docs/visual/approved.json', { manifest: run(2) + '/manifest.json', report: run(2) + '/comparison.json' });
  put(run(2) + '/comparison.json', { baseline: run(1) + '/manifest.json' });
  put('docs/visual/pending.json', { run: run(5).split('/').at(-1) });
  put('docs/images/status/manifest.json', { capturedAt: '5', shots: [{ file: 'paper.55555555.png' }] });
  for (const n of [3, 5]) put(`docs/images/status/paper.${String(n).repeat(8)}.png`, `fixture status ${n}`);
  const hash = name => digest(fs.readFileSync(path.join(root, name)));
  put(manifest, layout({ environment: { platform: 'win32' }, shots: [{ file: 'frame.png', width: 10, sha256: hash(frame) }, { file: status, sha256: hash(status) }] }));
  put(comparison, layout({ baseline: { manifest: 'manifest.json', sha256: hash(manifest) }, candidate: { file: '../' + newer.split('/').slice(-2).join('/'), sha256: hash(newer) } }));
  assert.equal(retainEvidence(root).newlyInventoried, 4);
  const before = fs.readFileSync(path.join(root, frame)), receipt = { [frame]: pin(before), [status]: pin(fs.readFileSync(path.join(root, status))) };
  put(frame, 'fixture media 3, boxed');
  const record = (files, note = redactionValue(new Set(['file'])), recordedAt = '1') => {
    const bytes = Buffer.from(JSON.stringify({ [REDACTION_FIELD]: note, version: 1, recordedAt, files }, null, 2) + '\n');
    fs.writeFileSync(path.join(root, 'docs/visual/retention', digest(bytes) + '.json'), bytes);
  };
  // Rewrites a record (change gets its parsed value) and returns its record entry.
  const rewrite = (name, change, write = layout) => {
    const from = pin(fs.readFileSync(path.join(root, name))), value = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    put(name, write(change(value)));
    return { file: name, from, to: pin(fs.readFileSync(path.join(root, name))) };
  };
  // Boxes a pinned picture in place and returns its file entry.
  const box = (name, text) => { const from = receipt[name]; put(name, text); return { file: name, from, to: pin(fs.readFileSync(path.join(root, name))) }; };
  return { root, record, rewrite, box, hash, from: pin(before), to: pin(fs.readFileSync(path.join(root, frame))) };
}
// The manifest as the records tool leaves it: the field first, its pin following the boxed picture.
const followed = (hash, extra = {}) => m => ({ [REDACTION_FIELD]: redactionValue(new Set(['file'])), ...m, shots: [{ ...m.shots[0], ...extra, sha256: hash(frame) }, ...m.shots.slice(1)] });
const check = root => retainEvidence(root, { check: true });

test('a correct redaction record passes', () => {
  const { root, record, from, to } = fixture();
  record([{ file: frame, from, to }]);
  assert.deepEqual(check(root), { retainedFiles: 4, newlyInventoried: 0, redacted: 1, recordPasses: 0, recordWorstWays: 0, deleted: 0 });
});
test('recordRedaction writes the record the check accepts', () => {
  const { root } = fixture();
  assert.deepEqual(recordRedaction(root, [frame]), { recorded: 1 });
  assert.equal(check(root).redacted, 1);
  assert.throws(() => recordRedaction(root, [frame]), /Already redacted/);
  assert.throws(() => recordRedaction(root, [status]), /Bytes did not change/);
});
test('a pinned file changed with no record is red', () => {
  assert.throws(() => check(fixture().root), /Retained evidence changed or missing/);
});
test('a record with a wrong old hash is red', () => {
  const { root, record, to } = fixture();
  record([{ file: frame, from: to, to }]);
  assert.throws(() => check(root), /Redaction old hash is not the receipt's/);
});
test('a record with a wrong new hash is red', () => {
  const { root, record, from } = fixture();
  record([{ file: frame, from, to: from }]);
  assert.throws(() => check(root), /Redaction new hash is not the file's/);
});
test('a record naming a path no receipt pins is red', () => {
  const { root, record, from, to } = fixture();
  record([{ file: frame, from, to }, { file: run(4) + '/frame.png', from, to }]);
  assert.throws(() => check(root), /Redaction names a path no receipt pins/);
});
test('two records for one path are red', () => {
  const { root, record, from, to } = fixture();
  record([{ file: frame, from, to }]);
  record([{ file: frame, from, to }], undefined, '2'); // the same entry in a second record
  assert.throws(() => check(root), /Two redaction records for one path/);
});
test('a record naming a file whose bytes did not change is red', () => {
  const { root, record, from, to } = fixture();
  const kept = pin(fs.readFileSync(path.join(root, status)));
  record([{ file: frame, from, to }, { file: status, from: kept, to: kept }]);
  assert.throws(() => check(root), /Redaction names a file whose bytes did not change/);
});
test('a record without the fixed sentences is red', () => {
  const { root, record, from, to } = fixture();
  record([{ file: frame, from, to }], ['boxed']);
  assert.throws(() => check(root), /Redaction record without its fixed sentences/);
});
const field = v => ({ [REDACTION_FIELD]: redactionValue(new Set(['file'])), ...v });
const unproved = (file, why) => new RegExp(`Redacted records not proved: .*${file.replace(/[.]/g, '\\.')} \\(${why}\\)`);
test('a record entry whose record changed only its pins of redacted files and the field passes', () => {
  const { root, record, rewrite, hash, from, to } = fixture();
  record([{ file: frame, from, to }]);
  record([rewrite(manifest, followed(hash))], RECORD);
  assert.equal(check(root).redacted, 2);
});
test('a record entry where one other value also changed is red', () => {
  const { root, record, rewrite, hash, from, to } = fixture();
  record([{ file: frame, from, to }]);
  record([rewrite(manifest, followed(hash, { width: 11 }))], RECORD);
  assert.throws(() => check(root), unproved(manifest, 'changed more than its pins of redacted files'));
});
test('a record entry for a record that pins no redacted file is red', () => {
  const { root, record, rewrite, from, to } = fixture();
  record([{ file: frame, from, to }]);
  record([rewrite(comparison, field)], RECORD);
  assert.throws(() => check(root), unproved(comparison, 'pins no redacted file'));
});
test('a pin to a file with no entry, or with an entry that is not proved, is red', () => {
  const a = fixture(); // a newer picture changed with no entry at all
  a.record([{ file: frame, from: a.from, to: a.to }]);
  fs.writeFileSync(path.join(a.root, newer), 'fixture media 4, boxed');
  a.record([a.rewrite(comparison, c => ({ ...field(c), candidate: { ...c.candidate, sha256: a.hash(newer) } }))], RECORD);
  assert.throws(() => check(a.root), unproved(comparison, 'pins no redacted file'));
  const b = fixture(); // the manifest's own entry is not proved (not in its written layout)
  b.record([{ file: frame, from: b.from, to: b.to }]);
  const m = b.rewrite(manifest, followed(b.hash), v => JSON.stringify(v) + '\n');
  b.record([m, b.rewrite(comparison, c => ({ ...field(c), baseline: { ...c.baseline, sha256: b.hash(manifest) } }))], RECORD);
  assert.throws(() => check(b.root), unproved(comparison, 'pins no redacted file'));
});
test('a comparison pinning a manifest whose own proof fails is red', () => {
  const { root, record, rewrite, hash, from, to } = fixture();
  record([{ file: frame, from, to }]);
  const m = rewrite(manifest, followed(hash, { width: 11 }));
  record([m, rewrite(comparison, c => ({ ...field(c), baseline: { ...c.baseline, sha256: hash(manifest) } }))], RECORD);
  assert.throws(() => check(root), unproved(manifest, 'changed more than its pins of redacted files'));
  assert.throws(() => check(root), unproved(comparison, 'pins no redacted file'));
});
test('two record entries that pin only each other prove nothing: a cycle never proves itself', () => {
  // A real cycle cannot be planted (each would hold the other's final hash), so the fixpoint is given one directly.
  const a = { file: 'a.json', from: { sha256: 'a0' }, to: { sha256: 'a1' } }, b = { file: 'b.json', from: { sha256: 'b0' }, to: { sha256: 'b1' } };
  const needs = { 'a.json': 'b1', 'b.json': 'a1' };
  const result = proveByFixpoint([a, b], [['p1', 'p0']], (e, back) => (back.has(needs[e.file]) ? null : 'pins no redacted file'));
  assert.deepEqual(result.unproved.map(([e]) => e.file), ['a.json', 'b.json']);
  assert.equal(result.passes, 1);
  const chain = proveByFixpoint([a, b], [['p1', 'p0']], (e, back) => (back.has(e.file === 'a.json' ? 'b1' : 'p1') ? null : 'pins no redacted file'));
  assert.deepEqual(chain, { passes: 2, unproved: [] }); // b grounds in the file entry, then a in b
});
test('a two-deep chain that is right passes: comparison -> manifest -> picture', () => {
  const { root, record, rewrite, hash, from, to } = fixture();
  record([{ file: frame, from, to }]);
  const m = rewrite(manifest, followed(hash));
  record([m, rewrite(comparison, c => ({ ...field(c), baseline: { ...c.baseline, sha256: hash(manifest) } }))], RECORD);
  const result = check(root);
  assert.equal(result.redacted, 3);
  assert.ok(result.recordPasses >= 1 && result.recordPasses <= 2);
});
test('two pictures boxed to the same bytes, pinned by one manifest, pass', () => {
  const { root, record, rewrite, box, hash } = fixture();
  const one = box(frame, 'boxed alike'), two = box(status, 'boxed alike');
  assert.equal(one.to.sha256, two.to.sha256);
  record([one, two]);
  record([rewrite(manifest, mf => ({ ...field(mf), shots: [{ ...mf.shots[0], sha256: hash(frame) }, { ...mf.shots[1], sha256: hash(status) }] }))], RECORD);
  const result = check(root);
  assert.equal(result.redacted, 3);
  assert.equal(result.recordWorstWays, 4);
});
test('a manifest pinning two pictures with their new values swapped is red', () => {
  const { root, record, rewrite, box, hash } = fixture();
  const one = box(frame, 'boxed one'), two = box(status, 'boxed two');
  record([one, two]);
  record([rewrite(manifest, mf => ({ ...field(mf), shots: [{ ...mf.shots[0], sha256: hash(status) }, { ...mf.shots[1], sha256: hash(frame) }] }))], RECORD);
  assert.throws(() => check(root), unproved(manifest, 'changed more than its pins of redacted files'));
});
test('a record with more than 4096 ways to put back its pins is red', () => {
  const { root, record, rewrite, box, hash } = fixture();
  record([box(frame, 'boxed alike'), box(status, 'boxed alike')]); // one new hash, two old ones
  record([rewrite(manifest, mf => ({ ...field(mf), shots: [{ ...mf.shots[0], sha256: hash(frame) }, { ...mf.shots[1], sha256: hash(status) }],
    many: Array.from({ length: 11 }, () => hash(frame)) }))], RECORD); // 13 pins, 2 ** 13 ways
  assert.throws(() => check(root), unproved(manifest, 'more than 4096 ways to put back its pins'));
});
test('a record entry for a record not in its written layout, or without the field, is red', () => {
  const { root, record, rewrite, hash, from, to } = fixture();
  record([{ file: frame, from, to }]);
  record([rewrite(manifest, followed(hash), v => JSON.stringify(v) + '\n')], RECORD);
  assert.throws(() => check(root), unproved(manifest, 'not in its written layout'));
  const bare = fixture();
  bare.record([{ file: frame, from: bare.from, to: bare.to }]);
  bare.record([bare.rewrite(manifest, m => ({ ...m, shots: [{ ...m.shots[0], sha256: bare.hash(frame) }, m.shots[1]] }))], RECORD);
  assert.throws(() => check(bare.root), unproved(manifest, 'does not carry the field'));
});
test('recordRedaction writes a record-kind record the check proves', () => {
  const { root, rewrite, hash } = fixture();
  recordRedaction(root, [frame]);
  rewrite(manifest, followed(hash));
  assert.deepEqual(recordRedaction(root, [manifest], { records: true }), { recorded: 1 });
  assert.equal(check(root).redacted, 2);
});
