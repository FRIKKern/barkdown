// Offline component attribution for the carried Windows PostgreSQL payload.
// An original notice and matching resource version do not establish vendor build
// flags, embedded components or completion of redistribution/source obligations.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unusedDestination, programs } from './runtime-postgres-bundle.mjs';
import { peArchitecture } from './audit-windows-imports.mjs';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const contains = (base, child) => {
  if (process.platform === 'win32') { base = base.toLowerCase(); child = child.toLowerCase(); }
  return child === base || child.startsWith(base + path.sep);
};
const repositories = {
  icu: ['unicode-org/icu', v => 'release-' + v.replaceAll('.', '-')],
  wxwidgets: ['wxWidgets/wxWidgets', v => 'v' + v],
  openssl: ['openssl/openssl', v => 'openssl-' + v],
  curl: ['curl/curl', v => 'curl-' + v.replaceAll('.', '_')],
  lz4: ['lz4/lz4', v => 'v' + v],
  libxml2: ['GNOME/libxml2', v => 'v' + v],
  zstd: ['facebook/zstd', v => 'v' + v],
  zlib: ['madler/zlib', v => 'v' + v],
  postgresql: ['postgres/postgres', v => 'REL_' + v.replaceAll('.', '_')]
};
function noLinks(file) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked notice input/output: ' + current); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (current === path.dirname(current)) break;
  }
}
function relativeFile(base, name) {
  // Notice paths must also be safe when later copied to Windows. A colon can
  // name an NTFS alternate data stream rather than a delivered notice file.
  if (typeof name !== 'string' || !name || name.split('/').some(p => !p || p === '.' || p === '..' || /[\\:<>"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p))) throw Error('Unsafe notice path: ' + name);
  const file = path.resolve(base, name);
  if (!contains(base, file) || file === base) throw Error('Escaped notice path: ' + name);
  noLinks(file); return file;
}
function record(base, name, expected) {
  const file = relativeFile(base, name), bytes = fs.readFileSync(file);
  if (!fs.statSync(file).isFile()) throw Error('Expected notice file: ' + name);
  const row = { path: name, bytes: bytes.length, sha256: sha(bytes) };
  if (expected && (row.bytes !== expected.bytes || row.sha256 !== expected.sha256)) throw Error('Changed notice/payload input: ' + name);
  return { bytes, row };
}
function walk(base, dir = base) {
  noLinks(dir);
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(e => {
    const file = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw Error('Linked payload entry: ' + file);
    if (e.isDirectory()) return walk(base, file);
    if (!e.isFile()) throw Error('Unsupported payload entry: ' + file);
    return [path.relative(base, file).split(path.sep).join('/')];
  });
}
function versionKey(version) {
  if (typeof version !== 'string' || !/^\d+(?:[.,] ?\d+)*$/.test(version.trim())) return null;
  const parts = version.match(/\d+/g).map(Number);
  while (parts.length > 1 && parts.at(-1) === 0) parts.pop();
  return parts.join('.');
}
export function parseModuleDeclarations(sourcePath, raw) {
  const text = raw.replace(/\\\r?\n/g, ' '), rows = [];
  for (const match of text.matchAll(/^(MODULES|MODULE_big|NAME)\s*(?:=|:=)\s*([^#\r\n]+)/gm)) {
    if (match[1] === 'NAME' && !text.includes('Makefile.shlib') && !text.includes('$(srcdir)/../proc.mk')) continue;
    const tokens = match[2].trim().split(/\s+/);
    const location = { declaration:match[1], sourcePath, logicalLine:text.slice(0,match.index).split('\n').length };
    for (const name of tokens) {
      if (/^[a-zA-Z0-9_-]+$/.test(name)) rows.push({ name, ...location });
      else {
        // Match a declared Python-major suffix without executing or assigning a
        // Make variable. This remains a source candidate, not a runtime guarantee.
        const pattern = /^([a-zA-Z0-9_-]+)\$\(python_majorversion\)$/.exec(name);
        if (pattern) rows.push({ prefix:pattern[1], variable:'python_majorversion', ...location });
      }
    }
  }
  return rows;
}
function moduleDeclaration(name, declarations) {
  return declarations.find(r => r.name?.toLowerCase() === name || (r.variable === 'python_majorversion' && name.startsWith(r.prefix.toLowerCase()) && /^\d+$/.test(name.slice(r.prefix.length))));
}
export function parsePgxsPrograms(sourcePath, raw) {
  const text = raw.replace(/\\\r?\n/g, ' '), lines = text.split(/\r?\n/);
  const subdir = /^subdir\s*(?:=|:=)\s*(src\/test\/[a-zA-Z0-9_/-]+)\s*$/m.exec(text)?.[1];
  if (!subdir || path.posix.dirname(sourcePath) !== subdir) return [];
  const all = lines.filter(line => /^all:/.test(line)).flatMap(line => line.slice(4).split('#')[0].trim().split(/\s+/));
  return lines.flatMap((line, index) => {
    const name = /^([a-zA-Z0-9_-]+)\$\(X\):/.exec(line)?.[1];
    if (!name || !all.includes(name + '$(X)')) return [];
    const install = '$(INSTALL_PROGRAM) ' + name + "$(X) '$(DESTDIR)$(pgxsdir)/$(subdir)/" + name + "$(X)'";
    const installIndex = lines.findIndex(candidate => /^\t/.test(candidate) && candidate.trim() === install);
    if (installIndex < 0) return [];
    return [{ name, sourcePath, payloadPath:'lib/pgxs/' + subdir + '/' + name + '.exe', declaration:'PGXS build/install target', logicalLine:index + 1, installLogicalLine:installIndex + 1 }];
  });
}
function component(file, declarations, pgxsPrograms) {
  const name = path.posix.basename(file).toLowerCase();
  if (pgxsPrograms.some(row => row.payloadPath.toLowerCase() === file.toLowerCase())) return 'postgresql';
  if (/^lib\/[^/]+\.dll$/.test(file) && moduleDeclaration(name.slice(0,-4), declarations)) return 'postgresql';
  if (/^bin\/[^/]+\.exe$/.test(file) && programs.includes(name.slice(0,-4))) return 'postgresql';
  if (/^icu(?:dt|in|io|tu|uc)77\.dll$/.test(name)) return 'icu';
  if (/^wx(?:base|msw)3210u_.*\.dll$/.test(name)) return 'wxwidgets';
  return ({ 'libcrypto-3-x64.dll':'openssl', 'libssl-3-x64.dll':'openssl', 'libcurl.dll':'curl', 'libiconv-2.dll':'libiconv', 'libintl-9.dll':'gettext', 'liblz4.dll':'lz4', 'libpq.dll':'postgresql', 'libecpg.dll':'postgresql', 'libecpg_compat.dll':'postgresql', 'libpgtypes.dll':'postgresql', 'libwinpthread-1.dll':'mingw-w64', 'libxml2.dll':'libxml2', 'libxslt.dll':'libxslt', 'libzstd.dll':'zstd', 'zlib1.dll':'zlib' })[name] || null;
}

export function auditPostgresNotices({ runtime, provenance, gnu, modules, output }) {
  const inputs = [runtime, provenance, gnu, modules].map(p => path.resolve(p));
  for (const p of inputs) noLinks(p);
  [runtime, provenance, gnu, modules] = inputs.map(p => fs.realpathSync(p));
  output = unusedDestination(output);
  let parent = path.dirname(output), suffix = [path.basename(output)];
  while (!fs.existsSync(parent)) { suffix.unshift(path.basename(parent)); parent = path.dirname(parent); }
  output = path.join(fs.realpathSync(parent), ...suffix);
  if ([runtime, provenance, gnu, modules].some(p => contains(p, output) || contains(output, p))) throw Error('Output overlaps notice input');
  const marker = record(runtime, 'barkdown-postgres.json'), mark = JSON.parse(marker.bytes);
  if (mark.version !== 1 || mark.platform !== 'win32' || mark.arch !== 'x64' || !/^\d+\.\d+$/.test(mark.postgres) || !/^[a-f0-9]{64}$/.test(mark.sourceSha256) || !Array.isArray(mark.files)) throw Error('Expected stamped Windows PostgreSQL payload');
  const expected = new Map();
  for (const row of mark.files) {
    relativeFile(runtime, row.path);
    if (expected.has(row.path.toLowerCase())) throw Error('Duplicate payload record');
    expected.set(row.path.toLowerCase(), row);
  }
  const actual = walk(runtime).filter(p => p !== 'barkdown-postgres.json');
  if (actual.length !== expected.size || actual.some(p => !expected.has(p.toLowerCase()))) throw Error('Payload roster differs from stamp');
  const payload = actual.map(p => record(runtime, p, expected.get(p.toLowerCase())).row);
  const primary = record(provenance, 'provenance.json'), prepared = JSON.parse(primary.bytes), gnuRecord = record(gnu, 'provenance.json'), archives = JSON.parse(gnuRecord.bytes);
  if ([prepared, archives].some(r => r.version !== 1 || r.status !== 'incomplete-preparation' || r.distributionReady !== false || !Array.isArray(r.sources))) throw Error('Notice preparation is unfinished/invalid');
  if (prepared.postgresMarker?.sha256 !== marker.row.sha256 || prepared.postgresMarker?.archiveSha256 !== mark.sourceSha256) throw Error('Version evidence belongs to another payload');
  if (prepared.versionEvidence?.path !== 'versions.json' || !Number.isSafeInteger(prepared.versionEvidence.bytes) || prepared.versionEvidence.bytes <= 0 || !/^[a-f0-9]{64}$/.test(prepared.versionEvidence.sha256)) throw Error('Missing byte-bound native version evidence');
  const versionInput = record(provenance, 'versions.json', prepared.versionEvidence), versions = JSON.parse(versionInput.bytes), byFile = new Map();
  if (!Array.isArray(versions) || !Array.isArray(prepared.nativeFiles)) throw Error('Missing native version evidence');
  const binDlls = payload.filter(r => /^bin\/[^/]+\.dll$/i.test(r.path));
  for (const row of versions) {
    if (typeof row.file !== 'string' || row.file.includes('/') || byFile.has(row.file.toLowerCase())) throw Error('Invalid/duplicate native version record');
    relativeFile(provenance, row.file); byFile.set(row.file.toLowerCase(), row);
  }
  const declared = new Map();
  for (const row of prepared.nativeFiles) {
    if (declared.has(row.path.toLowerCase())) throw Error('Duplicate version-bound binary');
    declared.set(row.path.toLowerCase(), row);
  }
  if (byFile.size !== binDlls.length || declared.size !== binDlls.length || binDlls.some(r => !byFile.has(path.posix.basename(r.path).toLowerCase()) || declared.get(r.path.toLowerCase())?.sha256 !== r.sha256 || declared.get(r.path.toLowerCase())?.bytes !== r.bytes)) throw Error('Native version roster/hash differs from payload');
  const texts = new Map(), sources = new Map();
  const keep = (base, file, metadata) => {
    const { bytes, row } = record(base, file.path, file);
    if (!bytes.length || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw Error('Notice is not nonempty UTF8');
    const target = 'licenses/' + metadata.kind + '/' + file.path, key = target.toLowerCase();
    relativeFile(output, target);
    if (texts.has(key)) throw Error('Duplicate notice destination');
    texts.set(key, { bytes, row: { ...row, path: target, ...metadata } }); return target;
  };
  for (const row of prepared.sources) {
    const known = repositories[row.name];
    if (!known || row.repo !== known[0] || !/^\d+(?:\.\d+)+$/.test(row.version) || row.tag !== known[1](row.version) || !/^[a-f0-9]{40}$/.test(row.commit) || sources.has(row.name)) throw Error('Invalid exact upstream source identity');
    const chain = row.tagChain;
    if (!Array.isArray(chain) || !chain.length || chain[0].kind !== 'ref' || chain[0].body.ref !== 'refs/tags/' + row.tag) throw Error('Missing retained tag resolution');
    let object = chain[0].body.object;
    for (const next of chain.slice(1)) {
      if (object.type !== 'tag' || next.kind !== 'tag' || next.body.sha !== object.sha) throw Error('Broken annotated tag resolution');
      object = next.body.object;
    }
    if (object.type !== 'commit' || object.sha !== row.commit || !Array.isArray(row.files) || !row.files.length) throw Error('Source commit/texts not established');
    const paths = row.files.map(file => {
      relativeFile(provenance, file.sourcePath);
      if (file.path !== row.name + '/' + file.sourcePath || file.url !== 'https://raw.githubusercontent.com/' + row.repo + '/' + row.commit + '/' + file.sourcePath) throw Error('Notice URL does not bind original source');
      return keep(provenance, file, { component: row.name, version: row.version, source: file.url, commit: row.commit, tag: row.tag, kind:'upstream' });
    });
    sources.set(row.name, { name:row.name, version:row.version, source:row.repo, texts:paths });
  }
  for (const row of archives.sources) {
    if (!['libiconv','gettext'].includes(row.name) || !/^\d+(?:\.\d+)+$/.test(row.version) || sources.has(row.name) || row.url !== `https://ftp.gnu.org/gnu/${row.name}/${row.name}-${row.version}.tar.gz` || !/^[a-f0-9]{64}$/.test(row.archive?.sha256) || !Number.isSafeInteger(row.archive.bytes) || row.archive.bytes <= 0 || !Array.isArray(row.files) || !row.files.length) throw Error('Invalid official source archive identity');
    const paths = row.files.map(file => {
      if (file.url !== row.url || file.archivePath !== row.name + '-' + row.version + '/' + file.path.slice(row.name.length + 1) || !file.path.startsWith(row.name + '/')) throw Error('Notice archive path/source mismatch');
      return keep(gnu, file, { component:row.name, version:row.version, source:row.url, archiveSha256:row.archive.sha256, kind:'gnu' });
    });
    sources.set(row.name, { name:row.name, version:row.version, source:row.url, texts:paths });
  }
  const moduleInput = record(modules, 'provenance.json'), modulePrepared = JSON.parse(moduleInput.bytes), pgCommit = prepared.sources.find(r => r.name === 'postgresql')?.commit;
  if (modulePrepared.version !== 1 || modulePrepared.status !== 'incomplete-preparation' || modulePrepared.distributionReady !== false || modulePrepared.repo !== 'postgres/postgres' || modulePrepared.tag !== repositories.postgresql[1](mark.postgres) || modulePrepared.commit !== pgCommit || modulePrepared.url !== 'https://codeload.github.com/postgres/postgres/tar.gz/' + pgCommit || !/^[a-f0-9]{64}$/.test(modulePrepared.archive?.sha256) || !Array.isArray(modulePrepared.files)) throw Error('Module source does not bind PostgreSQL release');
  const moduleFiles = new Set(), declarations = [], buildTexts = new Map();
  for (const row of modulePrepared.files) {
    if (moduleFiles.has(row.path.toLowerCase()) || row.archivePath !== 'postgres-' + pgCommit + '/' + row.path || (!/(?:^|\/)(?:GNUmakefile|Makefile|proc\.mk)$/.test(row.path) && row.path !== 'COPYRIGHT')) throw Error('Invalid/duplicate module source record: ' + row.path);
    moduleFiles.add(row.path.toLowerCase());
    const original = record(modules, row.path, row).bytes;
    if (original.includes(0) || !Buffer.from(original.toString('utf8')).equals(original)) throw Error('Module declaration is not UTF8 text');
    buildTexts.set(row.path, original.toString('utf8'));
    if (/\/(?:GNUmakefile|Makefile)$/.test(row.path)) declarations.push(...parseModuleDeclarations(row.path, original.toString('utf8')));
  }
  const observedDeclarations = modulePrepared.modules;
  if (!moduleFiles.has('copyright') || !declarations.length || JSON.stringify(observedDeclarations) !== JSON.stringify(declarations)) throw Error('Module declarations differ from original build sources');
  if (declarations.some(r => r.sourcePath.includes('/conversion_procs/') && !moduleFiles.has('src/backend/utils/mb/conversion_procs/proc.mk'))) throw Error('Missing conversion module include');
  // GNU make selects GNUmakefile before Makefile. Do not attribute a program
  // from an ignored companion file or merely from the executable's basename.
  const pgxsPrograms = [...buildTexts].flatMap(([file, text]) => {
    if (!/\/(?:GNUmakefile|Makefile)$/.test(file) || (file.endsWith('/Makefile') && buildTexts.has(path.posix.dirname(file) + '/GNUmakefile'))) return [];
    return parsePgxsPrograms(file, text);
  });
  if (!Array.isArray(mark.licenses) || !mark.licenses.length) throw Error('No supplied vendor notices');
  for (const name of mark.licenses) keep(runtime, { ...record(runtime, name).row }, { source:mark.sourceUrl, archiveSha256:mark.sourceSha256, kind:'vendor' });
  const gaps = [], native = payload.filter(r => /\.(dll|exe)$/i.test(r.path)).map(row => {
    const bytes = record(runtime, row.path, row).bytes, name = component(row.path, declarations, pgxsPrograms), source = sources.get(name), basename=path.posix.basename(row.path).toLowerCase(), resource = byFile.get(basename);
    const attribution = { ...row, arch:peArchitecture(bytes), component:name, resourceVersion:resource?.fileVersion ?? null, sourceVersion:source?.version ?? null, texts:source?.texts || [], moduleDeclaration:row.path.startsWith('lib/') ? moduleDeclaration(basename.slice(0,-4), declarations) ?? null : null, programDeclaration:pgxsPrograms.find(r => r.payloadPath.toLowerCase() === row.path.toLowerCase()) ?? null };
    if (!name || !source) gaps.push({ path:row.path, component:name, reason:'No exact component source/notice version established' });
    else if (/^bin\/.*\.dll$/i.test(row.path)) {
      const version = versionKey(resource?.fileVersion);
      if (!version) gaps.push({ path:row.path, component:name, reason:'Missing/non-release resource version; filename family is only an attribution candidate' });
      else if (version !== versionKey(source.version)) throw Error('Native resource version differs from source release: ' + row.path);
    } else if (name === 'postgresql' && source.version !== mark.postgres) throw Error('PostgreSQL source differs from vendor release');
    return attribution;
  });
  gaps.push({ component:'vendor build provenance', reason:'Resource versions/archive lineage do not prove compiler flags, patches or complete embedded/static component applicability' }, { component:'GNU libraries', reason:'Exact original source archives are retained privately; source delivery/offers, modifications and relinking obligations remain unproven' }, { component:'optional PostgreSQL language modules', reason:'Perl/Python/Tcl imports remain in carried modules; external runtime selection/deployment remains separate' }, { component:'Windows prerequisites', reason:'Ordinary VC runtime deployment and clean-machine installation remain unaccepted' });
  const report = { version:1, status:'incomplete-preparation', distributionReady:false, postgres:mark.postgres, archiveSha256:mark.sourceSha256, marker:marker.row, primaryProvenance:primary.row, gnuProvenance:gnuRecord.row, moduleProvenance:moduleInput.row, moduleDeclarations:declarations, pgxsPrograms, versionEvidence:versionInput.row, payload, native, sources:[...sources.values()], notices:[...texts.values()].map(t => t.row), gaps, limits:['Offline notice attribution only, no legal/distribution approval','Payload, source notices and previous outputs are immutable; missing attribution is explicit','Native versions are measured Windows resources bound to full payload hashes, not a reproducible vendor build','Source declaration line numbers are logical lines after joining Make continuations; they are not physical source positions'] };
  fs.mkdirSync(output, { recursive:true });
  for (const text of texts.values()) { const file=relativeFile(output,text.row.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text.bytes,{flag:'wx'}); }
  fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'}); return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [runtime,provenance,gnu,modules,output,...extra] = process.argv.slice(2);
    if (!runtime || !provenance || !gnu || !modules || !output || extra.length) throw Error('Usage: node scripts/audit-postgres-notices.mjs <carried-postgres> <original-upstream-inputs> <original-gnu-inputs> <module-source-inputs> <new-output>');
    const r=auditPostgresNotices({runtime,provenance,gnu,modules,output});console.log(JSON.stringify({status:r.status,payloadFiles:r.payload.length,nativeFiles:r.native.length,sources:r.sources.length,noticeTexts:r.notices.length,gaps:r.gaps.length,distributionReady:false}));
  } catch(e) { console.error(e.message);process.exitCode=1; }
}
