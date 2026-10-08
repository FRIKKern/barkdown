// Real disposable PostgreSQL proof, never an installed cluster or system service.
// Usage: node scripts/test-runtime-postgres-windows.mjs <bundle> <new evidence directory>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { attachPostgres, unusedDestination, sha256 } from './runtime-postgres-bundle.mjs';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 native proof required');
if (process.argv.length !== 4) throw new Error('Usage: <bundle> <new evidence directory>');
const bundle = fs.realpathSync(process.argv[2]);
const evidence = unusedDestination(process.argv[3]);
fs.mkdirSync(evidence, { recursive: true });
const startedAt = new Date().toISOString();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'Barkdown PG relocation '));
const release = path.join(root, 'Application resources');
fs.mkdirSync(release);
fs.writeFileSync(path.join(release, 'barkdown-release.json'), JSON.stringify({ version: 1, platform: 'win32', arch: 'x64', purpose: 'synthetic container for actual PostgreSQL relocation proof' }));
const source = JSON.parse(fs.readFileSync(path.join(bundle, 'barkdown-postgres.json')));
const report = { status: 'running', startedAt, host: os.hostname(), os: os.release(), node: process.version, root, sourceArchiveSha256: source.sourceSha256, checks: [], limits: ['Developer host with minimal PATH, not a clean Windows machine', 'Synthetic release container; no Barkpark server, application or installer tested'] };
const log = (name, result = {}) => { report.checks.push({ name, ...result }); console.log(name); };
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key) && key.toLowerCase() !== 'path'));
env.PATH = [path.join(process.env.SystemRoot, 'System32'), process.env.SystemRoot].join(path.delimiter);
env.PGCLIENTENCODING = 'UTF8';
env.PGPASSWORD = crypto.randomBytes(30).toString('hex');
const data = path.join(root, 'Disposable cluster');
const passwordFile = path.join(root, 'bootstrap-password');
fs.writeFileSync(passwordFile, env.PGPASSWORD, { flag: 'wx', mode: 0o600 });
let relocated;
let attemptedStart = false;
const tool = (name, args, input) => {
  const executable = path.join(relocated, 'bin', name + '.exe');
  // On Windows the server can inherit pg_ctl's pipe handles after pg_ctl exits.
  // File-backed output prevents waiting for that server to close a capture pipe.
  if (name === 'pg_ctl') {
    const fd = fs.openSync(path.join(evidence, 'pg-ctl.log'), 'a');
    try { execFileSync(executable, args, { env, cwd: root, windowsHide: true, stdio: ['ignore', fd, fd], timeout: 60000 }); return ''; }
    finally { fs.closeSync(fd); }
  }
  return execFileSync(executable, args, { env, cwd: root, windowsHide: true, encoding: 'utf8', input, timeout: 60000 });
};
try {
  relocated = attachPostgres(release, bundle);
  for (const item of source.files) assert.equal(sha256(path.join(relocated, item.path)), item.sha256, item.path);
  log('relocated payload bytes match inventory', { files: source.files.length, bundle: relocated });
  assert.equal(tool('postgres', ['--version']).trim(), `postgres (PostgreSQL) ${source.postgres}`);
  log('binary starts with developer PATH removed', { path: env.PATH });
  tool('initdb', ['-D', data, '-U', 'barkdown_probe', '--pwfile=' + passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
  log('fresh disposable cluster initialized with SCRAM authentication');
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)); });
  });
  const connection = ['-h', '127.0.0.1', '-p', String(port), '-U', 'barkdown_probe'];
  const start = () => { attemptedStart = true; tool('pg_ctl', ['-D',data,'-l',path.join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']); };
  const stop = () => tool('pg_ctl', ['-D',data,'-m','fast','-w','stop']);
  const sql = (db, query) => tool('psql', [...connection, '-X', '-w', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', db], query).trim();
  start();
  tool('createdb', [...connection, '-w', 'original']);
  sql('original', "CREATE EXTENSION citext; CREATE EXTENSION pg_trgm; CREATE EXTENSION pgcrypto; CREATE TABLE proof (name citext, payload bytea); INSERT INTO proof VALUES ('Chø 🐕', decode('00ff01a5','hex'));");
  const query = "SELECT json_build_object('name',name::text,'bytes',encode(payload,'hex'),'same',name='CHØ 🐕','digest',encode(digest(payload,'sha256'),'hex'),'similarity',similarity('barkdown','barkdown')) FROM proof;";
  const expected = { name: 'Chø 🐕', bytes: '00ff01a5', same: true, digest: crypto.createHash('sha256').update(Buffer.from('00ff01a5','hex')).digest('hex'), similarity: 1 };
  // C locale only folds ASCII: use the unchanged ø and exercise the ASCII portion.
  const read = db => JSON.parse(sql(db, query.replace('CHØ', 'CHø')));
  assert.deepEqual(read('original'), expected);
  log('citext, pg_trgm, pgcrypto and Unicode/binary content work', { extensions: sql('original', "SELECT extname || ':' || extversion FROM pg_extension ORDER BY extname;").split(/\r?\n/) });
  const dump = path.join(root, 'logical-backup.dump');
  tool('pg_dump', [...connection,'-w','-Fc','-f',dump,'original']);
  tool('createdb', [...connection,'-w','restored']);
  tool('pg_restore', [...connection,'-w','--exit-on-error','-d','restored',dump]);
  assert.deepEqual(read('restored'), expected);
  log('custom-format logical dump restores exact content', { dumpBytes: fs.statSync(dump).size, dumpSha256: sha256(dump) });
  stop(); start();
  assert.deepEqual(read('original'), expected); assert.deepEqual(read('restored'), expected);
  log('both databases preserve content across restart');
  stop();
  const stopped = spawnSync(path.join(relocated,'bin/pg_ctl.exe'), ['-D',data,'status'], { env, windowsHide: true, encoding: 'utf8', timeout: 10000 });
  assert.equal(stopped.status, 3, stopped.stdout + stopped.stderr);
  attemptedStart = false;
  log('owned cluster stopped', { statusExitCode: stopped.status });
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.message; process.exitCode = 1;
} finally {
  if (attemptedStart && relocated) {
    const stop = spawnSync(path.join(relocated,'bin/pg_ctl.exe'), ['-D',data,'-m','fast','-w','stop'], { env, windowsHide: true, encoding: 'utf8', timeout: 60000 });
    report.cleanup = { exitCode: stop.status, stdout: stop.stdout, stderr: stop.stderr };
  }
  // Credentials are disposable and never included in evidence. Keep diagnostic cluster/logs.
  fs.writeFileSync(passwordFile, 'consumed');
  report.finishedAt = new Date().toISOString();
  report.elapsedMs = Date.parse(report.finishedAt) - Date.parse(startedAt);
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  if (fs.existsSync(path.join(root, 'server.log'))) fs.copyFileSync(path.join(root, 'server.log'), path.join(evidence, 'postgres.log'));
  console.log(JSON.stringify({ status: report.status, evidence, elapsedMs: report.elapsedMs, error: report.error }));
}
