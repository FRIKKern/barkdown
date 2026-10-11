import { compareMediaObservations } from './media-ownership-observations.mjs';

// Static internal collection primitive, not an endpoint or a connection owner.
// A caller must independently bind/exclude its owned runtime before execution.
const columnTypes = { id: 'uuid', filename: 'varchar', original_name: 'varchar', path: 'varchar', mime_type: 'varchar',
  size: 'int4', dataset: 'varchar', inserted_at: 'timestamp', updated_at: 'timestamp', workspace_id: 'uuid', project_id: 'uuid',
  dataset_id: 'uuid', object_key: 'varchar' };
function bound(n) { if (!Number.isInteger(n) || n < 1 || n > 99999) throw Error('Raw media row bound must be1..99999'); return n; }
export function buildMediaRowsSql(maxRows = 20000) {
  const n = bound(maxRows);
  // Count and rows use one transaction snapshot across every dataset/scope.
  // No public filtered list, keyset cursor, search or cache population is used.
  return `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL client_encoding = 'UTF8';
SELECT pg_catalog.json_build_object(
  'version',1,'maxRows',${n},'database',pg_catalog.current_database(),
  'dataDirectoryHex',pg_catalog.encode(pg_catalog.textsend(pg_catalog.current_setting('data_directory')),'hex'),
  'readOnly',pg_catalog.current_setting('transaction_read_only'),'isolation',pg_catalog.current_setting('transaction_isolation'),
  'serverEncoding',pg_catalog.current_setting('server_encoding'),'clientEncoding',pg_catalog.current_setting('client_encoding'),
  'snapshot',pg_catalog.txid_current_snapshot()::text,
  'schema',pg_catalog.json_build_object('name','public','table','media_files',
    'kind',(SELECT relkind::text FROM pg_catalog.pg_class WHERE oid='public.media_files'::regclass),
    'columns',(SELECT pg_catalog.json_agg(pg_catalog.json_build_object('name',a.attname,'type',t.typname,'notNull',a.attnotnull) ORDER BY a.attnum)
      FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
      WHERE a.attrelid='public.media_files'::regclass AND a.attnum>0 AND NOT a.attisdropped)),
  'rowCount',(SELECT count(*) FROM public.media_files),
  'rows',(SELECT coalesce(pg_catalog.json_agg(pg_catalog.row_to_json(m) ORDER BY m.id),'[]'::json)
    FROM (SELECT * FROM public.media_files ORDER BY id LIMIT ${n + 1}) m)
);
COMMIT;
`;
}
function record(value, names, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join('\0') !== [...names].sort().join('\0')) throw Error('Unsupported ' + label);
}
export function parseMediaRowsSnapshot(value, expected) {
  record(expected, ['database', 'dataDirectoryHex', 'maxRows'], 'expected row identity');
  bound(expected.maxRows);
  if (typeof expected.database !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(expected.database) ||
    typeof expected.dataDirectoryHex !== 'string' || !/^(?:[0-9a-f]{2}){1,32768}$/.test(expected.dataDirectoryHex)) throw Error('Invalid expected row identity');
  record(value, ['version', 'maxRows', 'database', 'dataDirectoryHex', 'readOnly', 'isolation', 'serverEncoding', 'clientEncoding', 'snapshot', 'schema', 'rowCount', 'rows'], 'row snapshot');
  if (value.version !== 1 || value.maxRows !== expected.maxRows || value.database !== expected.database || value.dataDirectoryHex !== expected.dataDirectoryHex ||
    value.readOnly !== 'on' || value.isolation !== 'repeatable read' || value.serverEncoding !== 'UTF8' || value.clientEncoding !== 'UTF8') throw Error('Row snapshot identity, encoding or read mode differs');
  if (typeof value.snapshot !== 'string' || !/^\d+:\d+:(?:\d+(?:,\d+)*)?$/.test(value.snapshot) || value.snapshot.length > 1024 * 1024) throw Error('Invalid transaction snapshot');
  record(value.schema, ['name', 'table', 'kind', 'columns'], 'media schema');
  if (value.schema.name !== 'public' || value.schema.table !== 'media_files' || value.schema.kind !== 'r' || !Array.isArray(value.schema.columns)) throw Error('Unknown media relation');
  const seen = new Set();
  for (const c of value.schema.columns) {
    record(c, ['name', 'type', 'notNull'], 'media column');
    if (!Object.hasOwn(columnTypes, c.name) || seen.has(c.name) || c.type !== columnTypes[c.name] || typeof c.notNull !== 'boolean') throw Error('Unknown or duplicate media column');
    if (['id', 'filename', 'original_name', 'path', 'dataset'].includes(c.name) && !c.notNull) throw Error('Required media column is nullable');
    seen.add(c.name);
  }
  if (seen.size !== Object.keys(columnTypes).length) throw Error('Incomplete media schema');
  if (!Number.isSafeInteger(value.rowCount) || value.rowCount < 0 || !Array.isArray(value.rows) || value.rows.length !== Math.min(value.rowCount, expected.maxRows + 1)) throw Error('Incomplete or inconsistent row count');
  let previous = '';
  const rows = value.rows.map(r => {
    record(r, Object.keys(columnTypes), 'raw media row');
    if (typeof r.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.id) || r.id <= previous) throw Error('Duplicate or unordered raw media id');
    previous = r.id;
    for (const field of ['filename', 'original_name']) if (typeof r[field] !== 'string' || !r[field].length || r[field].length > 4096 || !r[field].isWellFormed()) throw Error('Invalid raw media name');
    if (r.mime_type !== null && (typeof r.mime_type !== 'string' || r.mime_type.length > 4096 || !r.mime_type.isWellFormed())) throw Error('Invalid raw media MIME');
    for (const field of ['inserted_at', 'updated_at']) if (typeof r[field] !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?$/.test(r[field])) throw Error('Unsupported raw media timestamp');
    return { ...r };
  });
  // Reuse the audited scope/stored-key validator; never recompute addresses.
  compareMediaObservations({ version: 1, source: { id: 'raw-sql-snapshot', platform: 'win32' }, bounds: { maxRows: 100000, maxFiles: 1 }, rows, files: [] });
  const completeRows = value.rowCount <= expected.maxRows;
  return { version: 1, status: completeRows ? 'rows_complete' : 'rows_partial', completeRows,
    database: value.database, dataDirectoryHex: value.dataDirectoryHex, serverEncoding: value.serverEncoding, clientEncoding: value.clientEncoding,
    snapshot: value.snapshot, schema: structuredClone(value.schema),
    rowCount: value.rowCount, observedRows: rows.length, rows, inventoryComplete: false, reconciled: false, deletionAllowed: false, recoveryAllowed: false,
    limitations: ['SQL rows only; caller must independently validate actual connection/owned cluster and stable exclusion',
      'A bounded complete database snapshot is not a complete filesystem inventory or historical effect settlement',
      'Opaque native directory bytes are preserved, never guessed or transcoded here',
      'Caller must decode transport bytes as fatal UTF8; encoding declarations alone cannot validate transport',
      ...(completeRows ? [] : ['Row bound exhausted; do not interpret a missing claimant in this prefix as absence'])] };
}
