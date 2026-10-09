BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL client_encoding = 'UTF8';
SELECT pg_catalog.json_build_object(
  'version',1,'maxRows',500,'database',pg_catalog.current_database(),
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
    FROM (SELECT * FROM public.media_files ORDER BY id LIMIT 501) m)
);
COMMIT;
