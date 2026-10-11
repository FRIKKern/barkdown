import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMediaRowsSql, parseMediaRowsSnapshot } from './media-row-snapshot.mjs';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const types = { id: 'uuid', filename: 'varchar', original_name: 'varchar', path: 'varchar', mime_type: 'varchar', size: 'int4', dataset: 'varchar',
  inserted_at: 'timestamp', updated_at: 'timestamp', workspace_id: 'uuid', project_id: 'uuid', dataset_id: 'uuid', object_key: 'varchar' };
const expected = (maxRows = 20000) => ({ database: 'barkdown', dataDirectoryHex: '433a2f6f776e6564', maxRows });
const row = n => ({ id: id(n), filename: n + '.png', original_name: n + '.png', path: 'published/' + n + '.png', mime_type: 'image/png', size: 10,
  dataset: n % 2 ? 'production' : 'drafts', inserted_at: '2026-10-09T01:02:03.123456', updated_at: '2026-10-09T01:02:03',
  workspace_id: id(n % 2 + 90), project_id: null, dataset_id: id(n % 2 + 80), object_key: 'd/' + n + '.png' });
const snapshot = (rows = [], maxRows = 20000, rowCount = rows.length) => ({ version: 1, maxRows, database: 'barkdown', dataDirectoryHex: expected().dataDirectoryHex,
  readOnly: 'on', isolation: 'repeatable read', serverEncoding: 'UTF8', clientEncoding: 'UTF8', snapshot: '100:101:', schema: { name: 'public', table: 'media_files', kind: 'r',
    columns: Object.entries(types).map(([name, type]) => ({ name, type, notNull: ['id', 'filename', 'original_name', 'path', 'dataset'].includes(name) })) }, rowCount, rows });
test('static SQL is bounded readonly/repeatable-read/schema-qualified and never a public scope filter', () => {
  const sql = buildMediaRowsSql(); assert.ok(sql.startsWith('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;'));
  assert.ok(sql.includes('SELECT * FROM public.media_files ORDER BY id LIMIT 20001'));
  assert.ok(sql.includes('count(*) FROM public.media_files')); assert.ok(sql.endsWith('COMMIT;\n'));
  assert.ok(sql.includes("SET LOCAL client_encoding = 'UTF8';"));
  assert.ok(!/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(sql)); assert.ok(!sql.includes('WHERE dataset'));
  for (const n of [0, -1, 100000, 1.5, '1; DROP TABLE public.media_files', NaN]) assert.throws(() => buildMediaRowsSql(n));
});
test('whole bounded raw snapshot retains every scope/stored-key and opaque native directory bytes', () => {
  const input = snapshot([row(1), row(2)]), before = JSON.stringify(input), r = parseMediaRowsSnapshot(input, expected());
  assert.equal(r.status, 'rows_complete'); assert.equal(r.completeRows, true); assert.equal(r.rowCount, 2);
  assert.deepEqual(r.rows, input.rows); assert.equal(r.rows[1].dataset, 'drafts'); assert.equal(r.dataDirectoryHex, input.dataDirectoryHex);
  assert.equal(JSON.stringify(input), before); r.rows[0].path = 'changed'; assert.equal(input.rows[0].path, 'published/1.png');
  for (const field of ['inventoryComplete', 'reconciled', 'deletionAllowed', 'recoveryAllowed']) assert.equal(r[field], false);
});
test('empty raw database is a bounded row result, never an empty successful whole inventory', () => {
  const r = parseMediaRowsSnapshot(snapshot(), expected()); assert.equal(r.rowCount, 0); assert.equal(r.completeRows, true);
  assert.equal(r.inventoryComplete, false); assert.equal(r.recoveryAllowed, false);
});
test('more than10000rows survive one snapshot, exhausted bounds explicitly stay incomplete', () => {
  const rows = Array.from({ length: 10001 }, (_, n) => row(n + 1)), r = parseMediaRowsSnapshot(snapshot(rows), expected());
  assert.equal(r.rows.length, 10001); assert.equal(r.completeRows, true);
  const incomplete = parseMediaRowsSnapshot(snapshot(rows, 10000, 10002), expected(10000));
  assert.equal(incomplete.status, 'rows_partial'); assert.equal(incomplete.completeRows, false); assert.equal(incomplete.rowCount, 10002);
  assert.ok(incomplete.limitations.some(s => s.includes('missing claimant')));
});
test('missing/repeated/changed columns and unknown relation refuse rather than fallback to public metadata', () => {
  const cases = [x => x.schema.columns.pop(), x => x.schema.columns.push(x.schema.columns[0]), x => x.schema.columns[0].type = 'varchar',
    x => x.schema.columns.push({ name: 'new_owner', type: 'uuid', notNull: false }), x => x.schema.kind = 'p', x => x.schema.name = 'other',
    x => x.schema.columns[0].notNull = false];
  for (const change of cases) { const x = snapshot([row(1)]); change(x); assert.throws(() => parseMediaRowsSnapshot(x, expected())); }
});
test('database/directory/bound/read mode/isolation/snapshot identity mismatch refuses', () => {
  for (const change of [x => x.database = 'shared', x => x.dataDirectoryHex = '00', x => x.maxRows = 1, x => x.readOnly = 'off',
    x => x.isolation = 'read committed', x => x.serverEncoding = 'SQL_ASCII', x => x.clientEncoding = 'WIN1252',
    x => delete x.clientEncoding, x => x.snapshot = 'unknown', x => x.version = 2, x => x.complete = true]) {
    const x = snapshot([row(1)]); change(x); assert.throws(() => parseMediaRowsSnapshot(x, expected()));
  }
});

test('Unicode names and stored keys stay exact; encoding fields grant no transport authority', () => {
  const r = row(1); r.filename = r.original_name = 'Chø 日本語.png'; r.object_key = 'originals/Chø 日本語.png';
  const result = parseMediaRowsSnapshot(snapshot([r]), expected());
  assert.deepEqual(result.rows[0], r); assert.equal(result.serverEncoding, 'UTF8'); assert.equal(result.clientEncoding, 'UTF8');
  assert.ok(result.limitations.some(s => s.includes('fatal UTF8'))); assert.equal(result.recoveryAllowed, false);
});
test('wrong row count, filtered prefix, duplicates and reordering refuse', () => {
  for (const x of [snapshot([row(1)], 20000, 2), snapshot([row(1), row(1)]), snapshot([row(2), row(1)]), snapshot([], 20000, 1)]) assert.throws(() => parseMediaRowsSnapshot(x, expected()));
  const x = snapshot([row(1)]); x.rowCount = Number.MAX_SAFE_INTEGER + 1; assert.throws(() => parseMediaRowsSnapshot(x, expected()));
});
test('raw shape/type/scope/unsafe stored-key violations refuse; null key and size remain exact', () => {
  for (const change of [r => delete r.workspace_id, r => r.object_key = '../other.png', r => r.size = '10', r => r.id = 'wrong',
    r => r.mime_type = [], r => r.inserted_at = 'yesterday', r => r.filename = '', r => r.new_field = 'unknown']) {
    const r = row(1); change(r); assert.throws(() => parseMediaRowsSnapshot(snapshot([r]), expected()));
  }
  const r = row(1); r.object_key = null; r.size = null; const parsed = parseMediaRowsSnapshot(snapshot([r]), expected());
  assert.equal(parsed.rows[0].object_key, null); assert.equal(parsed.rows[0].size, null);
});
test('duplicate physical claimants are retained; a row snapshot never chooses a new physical owner', () => {
  const a = row(1), b = row(2); b.object_key = a.object_key; b.path = a.path;
  const r = parseMediaRowsSnapshot(snapshot([a, b]), expected()); assert.equal(r.rows.length, 2); assert.equal(r.rows[1].object_key, a.object_key);
  assert.equal(r.rows[1].dataset, 'drafts'); assert.equal(r.reconciled, false);
});
