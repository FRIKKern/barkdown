// Offline preparation, not a distribution approval. Preserve exact supplied texts and
// bind them to the payload/lock/source; keep native and frontend applicability explicit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bindReaderNotices } from './reader-notices.mjs';
import { bindLiveViewNotices } from './liveview-notices.mjs';
import { readReaderAssets, readerFiles, readerLoader } from './runtime-wasm-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const relative = (base, p) => path.relative(base, p).split(path.sep).join('/');
const OTP = new Set(['asn1', 'compiler', 'crypto', 'inets', 'kernel', 'os_mon', 'public_key', 'runtime_tools', 'sasl', 'ssl', 'stdlib', 'syntax_tools', 'xmerl']);
const ELIXIR = new Set(['elixir', 'eex', 'iex', 'logger', 'mix', 'ex_unit']);

function safePath(file) {
  let current = path.resolve(file);
  while (true) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error('Linked input/output path: ' + current);
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
function walk(base, dir = base) {
  safePath(dir);
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw Error('Linked payload: ' + p);
    if (e.isDirectory()) return walk(base, p);
    if (!e.isFile()) throw Error('Unsupported payload entry: ' + p);
    return [p];
  });
}
function inputRecord(base, file) {
  safePath(file);
  const bytes = fs.readFileSync(file);
  return { path: relative(base, file), bytes: bytes.length, sha256: sha(bytes) };
}
function within(base, name) {
  // A Windows notice must be a delivered file, not a device, an alternate data
  // stream or a trailing-dot/space alias of another retained input.
  if (typeof name !== 'string' || !name || name.split('/').some(p => !p || p === '.' || p === '..' || /[\\:<>"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p)) || path.isAbsolute(name)) throw Error('Unsafe relative input: ' + name);
  const p = path.resolve(base, name);
  if (!p.startsWith(path.resolve(base) + path.sep)) throw Error('Escaped input: ' + name);
  safePath(p);
  return p;
}
function contained(base, dest) {
  // Windows casing does not create a separate destination; refusing overlap keeps
  // original payloads and notice inputs immutable even with differently cased argv.
  if (process.platform === 'win32') { base = base.toLowerCase(); dest = dest.toLowerCase(); }
  return dest === base || dest.startsWith(base + path.sep);
}

export function auditWindowsNotices({ runtime, checkout, provenance, output }) {
  [runtime, checkout, provenance, output] = [runtime, checkout, provenance, output].map(p => path.resolve(p));
  for (const p of [runtime, checkout, provenance, output]) safePath(p);
  if (fs.existsSync(output)) throw Error('Output already exists; preserve prior evidence: ' + output);
  if ([runtime, checkout, provenance].some(p => contained(p, output) || contained(output, p))) throw Error('Output overlaps an input');
  const mark = json(path.join(runtime, 'barkdown-release.json'));
  if (mark.platform !== 'win32' || mark.arch !== 'x64' || !/^[0-9a-f]{40}$/.test(mark.upstream)) throw Error('Expected stamped Windows x64 release');
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
  if (actual !== mark.upstream) throw Error('Checkout does not match release upstream');
  execFileSync('git', ['diff', '--exit-code', 'HEAD'], { cwd: checkout, stdio: 'pipe' });
  const lock = inputRecord(checkout, path.join(checkout, 'api/mix.lock'));
  if (lock.sha256 !== mark.mixLockSha256) throw Error('Lock does not match built release');
  const fetched = json(path.join(provenance, 'result.json'));
  if (!Array.isArray(fetched.results)) throw Error('Missing exact-version notice provenance');
  const texts = new Map();
  const keep = (source, target, metadata) => {
    const bytes = fs.readFileSync(source);
    if (!bytes.length || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw Error('Notice is not nonempty UTF8 text: ' + source);
    if (texts.has(target)) throw Error('Duplicate notice target: ' + target);
    const record = { path: target, bytes: bytes.length, sha256: sha(bytes), ...metadata };
    texts.set(target, { bytes, record });
    return target;
  };
  // The fetch is a separate, reviewed step. This auditor never follows a branch,
  // goes online, substitutes copyright, or accepts a changed retained text.
  const supplied = new Map();
  for (const row of fetched.results) {
    if (!/^[\w-]+$/.test(row.name) || !/^[\w.-]+\/[\w.-]+$/.test(row.repo) || !/^[0-9a-f]{40}$/.test(row.commit)) throw Error('Invalid retained source identity');
    if (![row.version, 'v' + row.version, 'OTP-' + row.version].includes(row.tag)) throw Error('Notice source is not an exact version tag');
    if (supplied.has(row.name)) throw Error('Duplicate retained source');
    const files = [];
    for (const file of [...(row.files || []), ...(row.embeddedLicenseInputs || [])]) {
      if (!file.url.startsWith('https://raw.githubusercontent.com/' + row.repo + '/' + row.commit + '/')) throw Error('Notice URL does not bind its immutable commit');
      const source = within(provenance, file.path);
      if (sha(fs.readFileSync(source)) !== file.sha256 || fs.statSync(source).size !== file.bytes) throw Error('Changed retained notice: ' + file.path);
      files.push(keep(source, 'licenses/retained/' + file.path, { source: file.url, tag: row.tag, commit: row.commit, kind: file.kind || 'exact-version original text' }));
    }
    supplied.set(row.name, { ...row, texts: files });
  }
  if (fetched.standardTerms) {
    const t = fetched.standardTerms, file = within(provenance, t.path);
    if (sha(fs.readFileSync(file)) !== t.sha256 || fs.statSync(file).size !== t.bytes || t.url !== 'https://www.apache.org/licenses/LICENSE-2.0.txt') throw Error('Changed or unreviewed referenced Apache terms');
    keep(file, 'licenses/referenced/Apache-2.0.txt', { source: t.url, kind: 'unmodified full terms referenced by original package declarations; original copyrights retained separately' });
  }
  const gaps = [], applications = [];
  for (const dir of fs.readdirSync(path.join(runtime, 'lib')).sort()) {
    const parsed = /^([a-z][a-z0-9_]*)-([0-9][\w.+-]*)$/.exec(dir);
    if (!parsed) throw Error('Unrecognized carried application: ' + dir);
    const [, name, version] = parsed, dep = path.join(checkout, 'api/deps', name), metaFile = path.join(dep, 'hex_metadata.config');
    const app = { name, version, directory: 'lib/' + dir, texts: [] };
    if (fs.existsSync(metaFile)) {
      safePath(metaFile);
      const meta = fs.readFileSync(metaFile, 'utf8');
      if (!meta.includes('{<<"name">>,<<"' + name + '">>}') || !meta.includes('{<<"version">>,<<"' + version + '">>}')) throw Error('Package metadata version/name differs from payload: ' + name);
      app.metadata = inputRecord(checkout, metaFile);
      app.kind = 'Hex package';
      for (const file of fs.readdirSync(dep).filter(f => /^(LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT)(\.|$)/i.test(f)).sort()) {
        const p = path.join(dep, file); safePath(p);
        if (fs.statSync(p).isFile()) app.texts.push(keep(p, 'licenses/packages/' + name + '/' + file, { source: 'pinned checkout api/deps/' + name + '/' + file, kind: 'unmodified package-supplied notice' }));
      }
      if (!app.texts.length) {
        const source = supplied.get(name);
        const repository = /GitHub">>,<<"https:\/\/github\.com\/([\w.-]+\/[\w.-]+)"/.exec(meta)?.[1];
        if (source && source.repo !== repository) throw Error('Retained source differs from package repository: ' + name);
        if (!source || source.version !== version || !source.texts.length) gaps.push({ component: name, reason: 'No retained exact-version original license/declaration' });
        else app.texts.push(...source.texts);
      }
    } else if (name === 'barkpark') {
      app.kind = 'private upstream';
      const file = path.join(checkout, 'LICENSE');
      if (fs.existsSync(file)) app.texts.push(keep(file, 'licenses/barkpark-LICENSE', { source: 'pinned upstream ' + mark.upstream, kind: 'original upstream license; dependency coverage separate' }));
      else gaps.push({ component: name, reason: 'Pinned upstream license missing' });
    } else {
      const group = OTP.has(name) ? 'erlang-otp' : ELIXIR.has(name) ? 'elixir' : null;
      app.kind = group || 'unknown carried application';
      const suppliedRow = group && supplied.get(group);
      if (group === 'elixir' && suppliedRow && suppliedRow.version !== version) throw Error('Elixir notice version differs from payload');
      if (group === 'erlang-otp' && suppliedRow && mark.toolchain?.otp && suppliedRow.version.split('.')[0] !== mark.toolchain.otp) throw Error('OTP notice major differs from build');
      if (suppliedRow?.texts.length) app.texts.push(...suppliedRow.texts);
      else gaps.push({ component: name, reason: 'Unknown runtime application or missing runtime license input' });
    }
    applications.push(app);
  }
  if (!mark.postgres || !Array.isArray(mark.postgres.licenses)) throw Error('Carried PostgreSQL notices missing from stamp');
  for (const name of mark.postgres.licenses) {
    const p = within(path.join(runtime, 'postgres'), name);
    keep(p, 'licenses/postgres/' + name, { source: mark.postgres.sourceUrl, archiveSha256: mark.postgres.sourceSha256, kind: 'unchanged supplied archive notice; per-DLL applicability remains open' });
  }
  let reader = null;
  const frontendInputs = [];
  if (fetched.reader !== undefined) {
    const apps = applications.filter(app => app.name === 'barkpark');
    if (apps.length !== 1) throw Error('Reader application is ambiguous or missing');
    const assets = within(runtime, apps[0].directory + '/priv/static/assets');
    const readAssets = readReaderAssets(assets); // Validate bytes before metadata binding.
    const assetBytes = [readAssets.wasm, readAssets.gzip, readAssets.loader];
    const actualFiles = [...readerFiles, readerLoader].map((name, index) => {
      const bytes = assetBytes[index];
      const record = { name, bytes: bytes.length, sha256: sha(bytes) };
      frontendInputs.push({ path: relative(runtime, within(assets, name)), bytes: record.bytes, sha256: record.sha256 });
      return record;
    });
    const bound = bindReaderNotices(fetched.reader, { upstream: mark.upstream, readerAssets: mark.readerAssets, files: actualFiles },
      file => fs.readFileSync(within(provenance, file.path)));
    for (const notice of bound.notices) {
      keep(within(provenance, notice.file.path), 'licenses/' + notice.file.path, {
        component: notice.file.component, componentVersion: notice.file.version,
        source: 'pinned reader upstream ' + bound.attribution.source.upstream,
        readerSource: bound.attribution.source, artifact: bound.attribution.artifact,
        kind: 'unmodified reviewed reader build-input notice; embedded coverage separate'
      });
      // A source changed between validation and retention must refuse before output.
      const retained = texts.get('licenses/' + notice.file.path);
      if (!retained.bytes.equals(notice.bytes)) throw Error('Reader original changed during retention');
    }
    reader = bound.attribution;
  }
  let liveview = null;
  if (fetched.liveview !== undefined) {
    const apps = applications.filter(app => app.name === 'barkpark');
    if (apps.length !== 1) throw Error('LiveView application is ambiguous or missing');
    const assetPath = within(runtime, apps[0].directory + '/priv/static/assets/phoenix_live_view.js');
    const bytes = fs.readFileSync(assetPath);
    const asset = { name: 'phoenix_live_view.js', bytes: bytes.length, sha256: sha(bytes) };
    const bound = bindLiveViewNotices(fetched.liveview, { upstream: mark.upstream, asset },
      file => fs.readFileSync(within(provenance, file.path)));
    frontendInputs.push({ path: relative(runtime, assetPath), bytes: asset.bytes, sha256: asset.sha256 });
    for (const notice of bound.notices) {
      const target = 'licenses/' + notice.file.path;
      keep(within(provenance, notice.file.path), target, { component: notice.file.component,
        componentVersion: notice.file.version, source: notice.file.source,
        clientAsset: bound.attribution.asset, upstream: bound.attribution.upstream,
        kind: 'unmodified original bound to reviewed whole client; embedded coverage separate' });
      if (!texts.get(target).bytes.equals(notice.bytes)) throw Error('LiveView original changed during retention');
    }
    liveview = bound.attribution;
  }
  const files = walk(runtime).map(p => inputRecord(runtime, p));
  for (const input of frontendInputs) {
    const inventoried = files.find(file => file.path === input.path);
    if (!inventoried || inventoried.bytes !== input.bytes || inventoried.sha256 !== input.sha256) throw Error('Frontend payload changed during audit');
  }
  const native = files.filter(f => /\.(dll|exe)$/i.test(f.path));
  // Inventory is evidence of bytes, not evidence that every embedded component's
  // copyright/notice requirements have been found. Never label this preparation complete.
  gaps.push(
    { component: 'native/static code', reason: 'Review exact OTP28.5 embedded SPDX/asmjit/OpenSSL/ryu/zstd and NIF/libuv/Argon2 source attributions against carried binaries' },
    { component: 'PostgreSQL DLLs', reason: 'Map all carried DLLs to supplied notices and exact component versions; source/redistribution inputs remain to be established' },
    { component: 'frontend assets', reason: liveview
      ? 'Reviewed LiveView/morphdom originals bound to exact client; reader embedded/source, other compiled frontend/editor/font/player and remaining source coverage remain open'
      : reader
      ? 'Reviewed reader build-input notices bound to exact assets; embedded Go and other compiled frontend/editor/font/player coverage remains open'
      : 'Bind actual compiled server assets to exact dependency licenses; historical editor notices alone are insufficient' },
    { component: 'Windows system prerequisites', reason: 'Audit actual PE imports and required MSVC runtimes; developer-host presence is not clean-machine proof' }
  );
  const report = { version: 1, status: 'incomplete-preparation', distributionReady: false, platform: mark.platform, arch: mark.arch, upstream: mark.upstream,
    release: inputRecord(runtime, path.join(runtime, 'barkdown-release.json')), lock, applications, payload: files, native, reader, liveview, notices: [...texts.values()].map(t => t.record), gaps,
    limits: ['Offline notice-input audit only; no legal or distribution approval', 'No installed database, real profile, source checkout or existing notice set is changed', 'Language-runtime versions need byte-bound provenance review; individual OTP application versions are not the OTP release version'] };
  fs.mkdirSync(output, { recursive: true });
  for (const [target, text] of texts) {
    const file = within(output, target); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text.bytes, { flag: 'wx' });
  }
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'README.md'), '# Windows runtime notice inputs\n\nIncomplete preparation; do not distribute this as a complete notice set.\n\nThe [audit](audit.json) binds ' + applications.length + ' carried applications, ' + files.length + ' payload files and ' + native.length + ' native binaries to source/lock hashes. Original notice/declaration bytes are preserved; referenced full terms do not replace original copyrights. Existing Mac notices remain untouched. Native, frontend and system-prerequisite gaps are explicit in the audit.\n', { flag: 'wx' });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [runtime, checkout, provenance, output, ...extra] = process.argv.slice(2);
  try {
    if (!runtime || !checkout || !provenance || !output || extra.length) throw Error('Usage: node scripts/audit-runtime-notices-windows.mjs <runtime> <pinned-checkout> <retained-exact-version-texts> <new-output>');
    const mark = json(path.join(path.resolve(runtime), 'barkdown-release.json'));
    if (mark.upstream !== fs.readFileSync(path.join(root, 'app/BARKPARK_REF'), 'utf8').trim()) throw Error('Runtime does not match current app pin');
    const report = auditWindowsNotices({ runtime, checkout, provenance, output });
    console.log(JSON.stringify({ status: report.status, applications: report.applications.length, payloadFiles: report.payload.length, nativeBinaries: report.native.length, noticeTexts: report.notices.length, gaps: report.gaps.length, distributionReady: false }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
