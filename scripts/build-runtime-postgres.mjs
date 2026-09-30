// Build a Postgres that Barkdown can carry: the official source, checked against the published
// checksum, configured small, with OpenSSL linked statically and its libraries addressed
// relative to the binaries, so the folder runs from anywhere on a machine with no Postgres.
// The server needs three standard extensions (citext, pg_trgm, pgcrypto); nothing else is built.
// Usage: node scripts/build-runtime-postgres.mjs [version] [output folder]
// macOS only for now. Needs the Xcode command line tools and a static OpenSSL 3 (Homebrew's).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (process.platform !== 'darwin') { console.error('This script builds the macOS folder only.'); process.exit(2); }
const version = process.argv[2] || '15.18';
if (!/^\d+\.\d+$/.test(version)) { console.error('Version looks like 15.18'); process.exit(2); }
const out = path.resolve(process.argv[3] || path.join(root, 'runtime', `postgres-${version}-${process.platform}-${process.arch}`));
if (fs.existsSync(out) && fs.readdirSync(out).length) { console.error('The output folder is not empty; nothing is overwritten: ' + out); process.exit(2); }
const openssl = process.env.BARKDOWN_OPENSSL_PREFIX || '/opt/homebrew/opt/openssl@3';
for (const lib of ['lib/libssl.a', 'lib/libcrypto.a', 'include/openssl/ssl.h']) if (!fs.existsSync(path.join(openssl, lib))) { console.error(`A static OpenSSL 3 is needed at ${openssl} (missing ${lib}); set BARKDOWN_OPENSSL_PREFIX.`); process.exit(2); }
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-postgres-build-')));
const base = `https://ftp.postgresql.org/pub/source/v${version}/postgresql-${version}.tar.bz2`;
const sh = (command, args, options = {}) => execFileSync(command, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options });
const tarball = path.join(work, 'postgresql.tar.bz2');
sh('curl', ['-fsSL', '--max-time', '600', '-o', tarball, base]);
const published = execFileSync('curl', ['-fsSL', '--max-time', '60', base + '.sha256'], { encoding: 'utf8' }).trim().split(/\s+/)[0];
const actual = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
if (!/^[0-9a-f]{64}$/.test(published) || published !== actual) { console.error(`Checksum mismatch for the Postgres source: published ${published}, downloaded ${actual}`); process.exit(1); }
sh('tar', ['-xjf', tarball, '-C', work]);
const src = path.join(work, `postgresql-${version}`);
// Only the static OpenSSL archives are visible to the linker, so nothing links the dylibs.
const staticSsl = path.join(work, 'openssl-static'); fs.mkdirSync(path.join(staticSsl, 'lib'), { recursive: true });
for (const lib of ['libssl.a', 'libcrypto.a']) fs.copyFileSync(path.join(openssl, 'lib', lib), path.join(staticSsl, 'lib', lib));
fs.symlinkSync(path.join(openssl, 'include'), path.join(staticSsl, 'include'));
// The static OpenSSL was built for this machine's macOS; the folder targets the same major version.
const deploymentTarget = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim().split('.')[0] + '.0';
const env = { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', CFLAGS: '-O2', MACOSX_DEPLOYMENT_TARGET: deploymentTarget };
sh('./configure', [`--prefix=${out}`, '--without-icu', '--with-openssl', '--with-libedit-preferred', '--without-zstd', '--without-lz4', '--disable-nls',
  `--with-includes=${path.join(staticSsl, 'include')}`, `--with-libraries=${path.join(staticSsl, 'lib')}`], { cwd: src, env });
// libpq checks that it references nothing that exits the process. A statically linked OpenSSL
// brings atexit and pthread_exit with it; those two are OpenSSL's, not libpq's, and are excepted.
{ const makefile = path.join(src, 'src', 'interfaces', 'libpq', 'Makefile'), text = fs.readFileSync(makefile, 'utf8'), guard = "grep -v __cxa_atexit | grep exit";
  if (!text.includes(guard)) { console.error('The libpq exit check changed; review the exception before building.'); process.exit(1); }
  fs.writeFileSync(makefile, text.replace(guard, "grep -v __cxa_atexit | grep -v -w -e _atexit -e _pthread_exit | grep exit")); }
const jobs = String(Math.max(2, os.cpus().length - 2));
sh('make', ['-j', jobs], { cwd: src, env });
sh('make', ['install'], { cwd: src, env });
for (const extension of ['citext', 'pg_trgm', 'pgcrypto']) { sh('make', ['-j', jobs], { cwd: path.join(src, 'contrib', extension), env }); sh('make', ['install'], { cwd: path.join(src, 'contrib', extension), env }); }
// Address the folder's own libraries relative to each binary, so the folder can be moved.
const tool = args => execFileSync('install_name_tool', args, { stdio: ['ignore', 'ignore', 'pipe'] });
const linked = file => execFileSync('otool', ['-L', file], { encoding: 'utf8' }).split('\n').slice(1).map(line => line.trim().split(' ')[0]).filter(Boolean);
const libDir = path.join(out, 'lib');
// Every library and loadable module under lib, at any depth, and every program in bin.
const under = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? under(path.join(dir, entry.name)) : entry.isFile() ? [path.join(dir, entry.name)] : []);
const modules = under(libDir).filter(file => /\.(dylib|so)$/.test(file));
for (const file of modules) {
  if (file.endsWith('.dylib')) tool(['-id', '@rpath/' + path.basename(file), file]);
  for (const dep of linked(file)) if (dep.startsWith(libDir + '/')) tool(['-change', dep, '@loader_path/' + path.relative(path.dirname(file), path.join(libDir, path.basename(dep))), file]);
}
for (const name of fs.readdirSync(path.join(out, 'bin'))) { const file = path.join(out, 'bin', name); if (fs.lstatSync(file).isSymbolicLink()) continue; for (const dep of linked(file)) if (dep.startsWith(libDir + '/')) tool(['-change', dep, '@loader_path/../lib/' + path.basename(dep), file]); }
// Re-sign after editing load commands (required on Apple silicon), and drop what a runtime never uses.
for (const file of [...modules, ...under(path.join(out, 'bin'))]) execFileSync('codesign', ['--force', '--sign', '-', file], { stdio: 'ignore' });
for (const dir of ['include', 'share/doc', 'share/man', 'lib/pkgconfig', 'lib/pgxs']) fs.rmSync(path.join(out, dir), { recursive: true, force: true });
for (const name of fs.readdirSync(libDir)) if (name.endsWith('.a')) fs.rmSync(path.join(libDir, name));
const foreign = [];
for (const file of [...under(libDir).filter(f => /\.(dylib|so)$/.test(f)), ...under(path.join(out, 'bin'))]) { let deps = []; try { deps = linked(file); } catch { continue; } for (const dep of deps) if (!dep.startsWith('/usr/lib/') && !dep.startsWith('/System/') && !dep.startsWith('@')) foreign.push(`${path.relative(out, file)} -> ${dep}`); }
if (foreign.length) { console.error('The folder still depends on libraries outside the system:\n' + foreign.join('\n')); process.exit(1); }
const mark = { version: 1, postgres: version, sourceSha256: actual, openssl: execFileSync(path.join(openssl, 'bin', 'openssl'), ['version'], { encoding: 'utf8' }).trim(), extensions: ['citext', 'pg_trgm', 'pgcrypto'], builtAt: new Date().toISOString(), platform: process.platform, arch: process.arch, deploymentTarget };
fs.writeFileSync(path.join(out, 'barkdown-postgres.json'), JSON.stringify(mark, null, 2) + '\n');
fs.rmSync(work, { recursive: true, force: true });
console.log(`Postgres ${version} for Barkdown at ${out}`);
