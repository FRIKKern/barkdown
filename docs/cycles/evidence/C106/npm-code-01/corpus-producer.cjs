const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { createRequire } = require('module');
const { execFileSync } = require('child_process');
const base = __dirname;
const repository = 'C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown';
const archive = base + '/C106-extract-05/payload/resources/app.asar';
const out = base + '/C106-package-source-338';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const asar = createRequire(repository + '/app/package.json')('@electron/asar');
const map = JSON.parse(fs.readFileSync(repository + '/docs/cycles/evidence/C106/app-notices-01/source-map.json'));
const lockBytes = fs.readFileSync(repository + '/app/package-lock.json');
const lock = JSON.parse(lockBytes).packages;
const started = Date.now();
assert.equal(sha(fs.readFileSync(archive)), map.artifactSha256);
assert(!fs.existsSync(out));
fs.mkdirSync(out);
const entry = {
  at: new Date().toISOString(), goal: 'Measure whole archived npm-file correspondence to consistent locked installed-source candidates, beyond prior name/version and notice-only checks.',
  source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
  sourceStatus: execFileSync('git', ['status', '--porcelain'], { cwd: repository, encoding: 'utf8' }).trim(),
  archive, archiveSha256: map.artifactSha256, archiveBytes: fs.statSync(archive).size,
  lockSha256: sha(lockBytes), budget: 'One read-only corpus pass and review, planning ceiling30 minutes; no product edit or artifact rebuild.',
  limits: ['No binary execution, installation, code/lock/pin/capture changes, real content or new downloads', 'Installed-source byte correspondence is not publisher-tarball verification, full source/relinking, notice applicability or A5 acceptance', 'Do not grow the frozen PR79 installer/provider behavior batch'],
};
fs.writeFileSync(out + '/entry.json', JSON.stringify(entry, null, 2) + '\n');
fs.copyFileSync(__filename, out + '/producer.cjs');
const sourceHashes = new Map();
function observe(file) {
  if (sourceHashes.has(file)) return sourceHashes.get(file);
  const appRoot = path.resolve(repository, 'app');
  assert(path.resolve(file).startsWith(appRoot + path.sep));
  for (let at = file; ; at = path.dirname(at)) {
    const stat = fs.lstatSync(at);
    assert(!stat.isSymbolicLink(), 'Linked source input: ' + at);
    if (path.resolve(at) === appRoot) break;
  }
  const stat = fs.statSync(file);
  if (!stat.isFile()) return null;
  const data = fs.readFileSync(file);
  const value = { bytes: data.length, sha256: sha(data) };
  sourceHashes.set(file, value);
  return value;
}
try {
  const owners = map.packages.map(pkg => {
    const candidates = pkg.sourceCandidates.filter(c => c.sourceLockMatched).map(c => {
      const file = path.join(repository, 'app', c.root, 'package.json');
      observe(file);
      const manifest = JSON.parse(fs.readFileSync(file));
      assert.equal(manifest.name, pkg.name);
      assert.equal(manifest.version, pkg.version);
      assert.equal(lock[c.root]?.version, pkg.version);
      return { root: c.root, resolved: lock[c.root].resolved || null, integrity: lock[c.root].integrity || null };
    });
    assert(candidates.length > 0);
    return { root: pkg.root, name: pkg.name, version: pkg.version, candidates, consistentCandidates: candidates.map(c => c.root), files: 0, unmatched: 0 };
  }).sort((a, b) => b.root.length - a.root.length);
  const records = [], unowned = [];
  for (const item of asar.listPackage(archive)) {
    const file = item.replaceAll('\\', '/').replace(/^\//, '');
    if (!file.startsWith('node_modules/')) continue;
    assert(!file.split('/').some(p => p === '..' || p === '.' || p === ''));
    const stat = asar.statFile(archive, path.normalize(file), false);
    assert(!stat.link, 'Linked archive entry: ' + file);
    if (stat.files) continue;
    const owner = owners.find(p => file.startsWith(p.root + '/'));
    if (!owner) { unowned.push(file); continue; }
    const bytes = asar.extractFile(archive, path.normalize(file));
    const digest = sha(bytes), suffix = file.slice(owner.root.length + 1);
    const matches = [], differences = [];
    for (const candidate of owner.candidates) {
      const sourcePath = path.join(repository, 'app', candidate.root, suffix);
      if (!fs.existsSync(sourcePath)) { differences.push({ root: candidate.root, state: 'missing' }); continue; }
      const source = observe(sourcePath);
      if (source?.bytes === bytes.length && source.sha256 === digest) matches.push(candidate.root);
      else differences.push({ root: candidate.root, state: source ? 'different' : 'not-file', ...source });
    }
    owner.files++;
    if (!matches.length) owner.unmatched++;
    owner.consistentCandidates = owner.consistentCandidates.filter(c => matches.includes(c));
    records.push({ file, packageRoot: owner.root, name: owner.name, version: owner.version, bytes: bytes.length, sha256: digest, unpacked: stat.unpacked === true, matches, ...(matches.length ? {} : { differences }) });
  }
  assert.equal(sha(fs.readFileSync(archive)), entry.archiveSha256);
  assert.equal(sha(fs.readFileSync(repository + '/app/package-lock.json')), entry.lockSha256);
  for (const [file, before] of sourceHashes) assert.equal(sha(fs.readFileSync(file)), before.sha256, 'Source changed during audit: ' + file);
  const unmatched = records.filter(r => !r.matches.length);
  const result = {
    at: new Date().toISOString(), status: 'measured', elapsedMs: Date.now() - started,
    entry, packageRoots: owners.length, archivedNpmFiles: records.length, archivedBytes: records.reduce((n, f) => n + f.bytes, 0),
    matched: records.length - unmatched.length, unmatched: unmatched.length,
    consistentPackageCandidates: owners.filter(p => p.files > 0 && p.consistentCandidates.length > 0).length,
    unresolvedPackages: owners.filter(p => !p.files || !p.consistentCandidates.length),
    unowned, owners: owners.sort((a, b) => a.root.localeCompare(b.root)), records,
    sourceFilesObserved: sourceHashes.size, originalArchiveAndLockUnchanged: true,
    limits: entry.limits,
  };
  fs.writeFileSync(out + '/result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, packages: result.packageRoots, files: result.archivedNpmFiles, matched: result.matched, unmatched: result.unmatched, consistentPackages: result.consistentPackageCandidates, unresolved: result.unresolvedPackages.map(p => ({ name: p.name, files: p.files, unmatched: p.unmatched })), unowned: unowned.length, elapsedMs: result.elapsedMs }));
} catch (error) {
  fs.writeFileSync(out + '/failure.json', JSON.stringify({ at: new Date().toISOString(), error: error.stack, elapsedMs: Date.now() - started }, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
}
