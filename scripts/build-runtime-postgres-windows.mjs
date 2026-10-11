// Assemble a pinned EDB Windows binary ZIP. No installer runs; no live data is copied.
// Usage: node scripts/build-runtime-postgres-windows.mjs <archive.zip> [new output folder]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256, unusedDestination, copyWindowsPayload, programs, licenses } from './runtime-postgres-bundle.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pin = JSON.parse(fs.readFileSync(path.join(root, 'scripts/windows-postgres-pin.json'), 'utf8'));
export function checkArchive(archive) {
  if (sha256(archive) !== pin.sha256) throw new Error('Archive SHA256 does not match the recorded Windows PostgreSQL pin');
}
export function build(archiveArg, outputArg) {
  if (process.platform !== pin.platform || process.arch !== pin.arch) throw new Error('This assembler requires Windows x64');
  if (!archiveArg) throw new Error('Usage: <archive.zip> [new output folder]');
  const archive = fs.realpathSync(path.resolve(archiveArg));
  const output = unusedDestination(outputArg || path.join(root, 'runtime', `postgres-${pin.postgres}-win32-x64`));
  checkArchive(archive); // Refuse before creating a destination or invoking archive extraction.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-postgres-assembly-'));
  console.log(JSON.stringify({ archive, output, retainedExtraction: work, sha256: pin.sha256 }));
  const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const tar = path.join(system, 'tar.exe');
  // This exact checksum pin identifies the archive; only distributable payload roots are extracted.
  execFileSync(tar, ['-xf', archive, '-C', work, 'pgsql/bin', 'pgsql/lib', 'pgsql/share', ...licenses.map(n => 'pgsql/' + n)], { windowsHide: true, stdio: 'inherit' });
  const files = copyWindowsPayload(path.join(work, 'pgsql'), output);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key) && key.toLowerCase() !== 'path'));
  env.PATH = system + path.delimiter + (process.env.SystemRoot || 'C:\\Windows');
  const version = execFileSync(path.join(output, 'bin/postgres.exe'), ['--version'], { env, windowsHide: true, encoding: 'utf8' }).trim();
  if (version !== `postgres (PostgreSQL) ${pin.postgres}`) throw new Error('Unexpected PostgreSQL binary version: ' + version);
  const mark = { version: 1, postgres: pin.postgres, sourceSha256: pin.sha256, sourceUrl: pin.url, checksumSource: pin.checksumSource, platform: pin.platform, arch: pin.arch, builtAt: new Date().toISOString(), programs, extensions: ['citext','pg_trgm','pgcrypto'], licenses, files, os: os.release(), limits: ['Redistributed EDB binaries; no source compilation or vendor signature claim', 'A minimal PATH on a developer host does not prove a clean Windows machine has all system DLLs'] };
  fs.writeFileSync(path.join(output, 'barkdown-postgres.json'), JSON.stringify(mark, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'assembled', output, version, files: files.length, bytes: files.reduce((s,f) => s + f.bytes, 0) }));
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { build(...process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
