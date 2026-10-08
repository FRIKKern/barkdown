// Build-time payload ownership. Never inspect or copy an installed PostgreSQL data directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const programs = ['initdb', 'pg_ctl', 'postgres', 'psql', 'createdb', 'pg_dump', 'pg_restore'];
export const licenses = ['server_license.txt', 'commandlinetools_3rd_party_licenses.txt', 'pgAdmin_license.txt', 'pgAdmin_3rd_party_licenses.txt', 'StackBuilder_3rd_party_licenses.txt'];
export const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const requireFile = file => { if (!fs.statSync(file).isFile()) throw new Error('Required file missing: ' + file); };
export function unusedDestination(destination) {
  const absolute = path.resolve(destination);
  // Refuse even an empty existing destination: interrupted attempts remain reviewable.
  try {
    fs.lstatSync(absolute);
    throw new Error('Output already exists; nothing is overwritten: ' + absolute);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let current = path.dirname(absolute); ; current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Output cannot traverse a link: ' + current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current === path.dirname(current)) break;
  }
  return absolute;
}
export function inventory(directory) {
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => {
    const file = path.join(e.parentPath, e.name);
    return { path: path.relative(directory, file).split(path.sep).join('/'), bytes: fs.statSync(file).size, sha256: sha256(file) };
  }).sort((a,b) => a.path.localeCompare(b.path));
}
export function copyWindowsPayload(source, destination) {
  const out = unusedDestination(destination);
  // A distributable payload must not carry links back into a build host.
  for (const dir of ['bin', 'lib', 'share']) {
    const base = path.join(source, dir);
    if (fs.lstatSync(base).isSymbolicLink() || fs.readdirSync(base, { recursive: true, withFileTypes: true }).some(e => e.isSymbolicLink())) throw new Error('Windows payload cannot contain links');
  }
  for (const file of [...programs.map(p => `bin/${p}.exe`), ...licenses, ...['citext','pg_trgm','pgcrypto'].flatMap(e => [`lib/${e}.dll`, `share/extension/${e}.control`])]) requireFile(path.join(source, file));
  const dlls = fs.readdirSync(path.join(source, 'bin')).filter(n => n.toLowerCase().endsWith('.dll'));
  if (!dlls.includes('libpq.dll')) throw new Error('Required libpq.dll is missing');
  fs.mkdirSync(path.join(out, 'bin'), { recursive: true });
  for (const name of [...programs.map(p => p + '.exe'), ...dlls]) fs.copyFileSync(path.join(source, 'bin', name), path.join(out, 'bin', name), fs.constants.COPYFILE_EXCL);
  for (const dir of ['lib','share']) fs.cpSync(path.join(source, dir), path.join(out, dir), { recursive: true, errorOnExist: true, force: false });
  for (const name of licenses) fs.copyFileSync(path.join(source, name), path.join(out, name), fs.constants.COPYFILE_EXCL);
  return inventory(out);
}
export function attachPostgres(release, postgres) {
  const markFile = path.join(release, 'barkdown-release.json');
  const mark = JSON.parse(fs.readFileSync(markFile, 'utf8'));
  const pg = JSON.parse(fs.readFileSync(path.join(postgres, 'barkdown-postgres.json'), 'utf8'));
  if (mark.version !== 1 || pg.version !== 1 || !['x64', 'arm64'].includes(pg.arch)) throw new Error('Unsupported runtime metadata');
  if (mark.platform !== pg.platform || mark.arch !== pg.arch || !['darwin','linux','win32'].includes(pg.platform)) throw new Error('PostgreSQL platform/architecture does not match release');
  const target = unusedDestination(path.join(release, 'postgres'));
  const win = pg.platform === 'win32';
  for (const name of programs) requireFile(path.join(postgres, 'bin', name + (win ? '.exe' : '')));
  // Windows executables need DLLs beside them; only extra programs are filtered.
  const bin = path.join(postgres, 'bin');
  fs.cpSync(postgres, target, { recursive: true, verbatimSymlinks: true, filter: from => {
    if (path.dirname(from) !== bin || fs.statSync(from).isDirectory()) return true;
    const name = path.basename(from);
    return win ? !name.toLowerCase().endsWith('.exe') || programs.includes(name.slice(0,-4)) : programs.includes(name);
  } });
  fs.writeFileSync(markFile, JSON.stringify({ ...mark, postgres: { ...pg, programs } }, null, 2) + '\n');
  return target;
}
