const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { createRequire } = require('module');
const base = __dirname;
const repository = 'C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown';
const app = path.join(repository, 'app');
const requireApp = createRequire(path.join(app, 'package.json'));
const asar = requireApp('@electron/asar');
const { createTransformer } = requireApp('app-builder-lib/out/fileTransformer');
const source = JSON.parse(fs.readFileSync(base + '/C106-package-source-338/result.json'));
const manifests = JSON.parse(fs.readFileSync(base + '/C106-package-manifests-342/result.json'));
const out = base + '/C106-package-transform-344';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lockBytes = fs.readFileSync(app + '/package-lock.json');
const lock = JSON.parse(lockBytes).packages;
const builder = JSON.parse(fs.readFileSync(app + '/node_modules/app-builder-lib/package.json'));
assert.equal(builder.version, lock['node_modules/app-builder-lib'].version);
assert.equal(hash(lockBytes), source.entry.lockSha256);
assert.equal(hash(fs.readFileSync(source.entry.archive)), source.entry.archiveSha256);
assert(!fs.existsSync(out));
fs.mkdirSync(out);
const began = Date.now();
const transformerFile = app + '/node_modules/app-builder-lib/out/fileTransformer.js';
const transformerSha256 = hash(fs.readFileSync(transformerFile));
const transform = createTransformer(app, {}, null, null);
const records = [];
(async () => {
  for (const item of manifests.records) {
    const suffix = item.file.slice(item.packageRoot.length + 1);
    const packaged = asar.extractFile(source.entry.archive, path.normalize(item.file));
    assert.equal(hash(packaged), item.packagedSha256);
    const candidates = [];
    for (const candidate of item.candidates) {
      const file = path.join(app, candidate.root, suffix);
      const before = fs.readFileSync(file);
      assert.equal(hash(before), candidate.sourceSha256);
      const changed = await transform(file);
      assert.equal(typeof changed, 'string');
      const bytes = Buffer.from(changed);
      assert.equal(hash(fs.readFileSync(file)), candidate.sourceSha256);
      candidates.push({ root: candidate.root, originalBytes: before.length, originalSha256: candidate.sourceSha256, outputBytes: bytes.length, outputSha256: hash(bytes), exact: bytes.equals(packaged), removed: candidate.removed });
    }
    assert(candidates.some(c => c.exact), 'Actual transformer did not reproduce ' + item.file);
    records.push({ file: item.file, packageRoot: item.packageRoot, name: item.name, version: item.version, packagedSha256: item.packagedSha256, candidates });
  }
  const packages = source.owners.map(owner => {
    let consistent = owner.candidates.map(c => c.root);
    for (const file of source.records.filter(r => r.packageRoot === owner.root)) {
      const transformed = records.find(r => r.file === file.file);
      const roots = transformed ? transformed.candidates.filter(c => c.exact).map(c => c.root) : file.matches;
      consistent = consistent.filter(c => roots.includes(c));
    }
    assert(consistent.length, 'No one consistent source candidate reproduces ' + owner.root);
    return { root: owner.root, name: owner.name, version: owner.version, archivedFiles: owner.files, consistentCandidates: consistent };
  });
  assert.equal(hash(fs.readFileSync(transformerFile)), transformerSha256);
  assert.equal(hash(fs.readFileSync(app + '/package-lock.json')), source.entry.lockSha256);
  assert.equal(hash(fs.readFileSync(source.entry.archive)), source.entry.archiveSha256);
  const result = {
    at: new Date().toISOString(), status: 'passed', elapsedMs: Date.now() - began,
    artifactSha256: source.entry.archiveSha256, lockSha256: source.entry.lockSha256,
    packageRoots: packages.length, archivedFiles: source.archivedNpmFiles,
    exactUntransformedFiles: source.matched, exactTransformedManifests: records.length,
    allPackagesHaveOneConsistentSource: true,
    transformer: { name: builder.name, version: builder.version, lock: lock['node_modules/app-builder-lib'], file: 'node_modules/app-builder-lib/out/fileTransformer.js', sha256: transformerSha256, options: { removePackageScripts: 'default true', removePackageKeywords: 'default true', isMain: false } },
    contributorMetadataRemoved: records.filter(r => r.candidates.some(c => c.removed.includes('/contributors'))).map(r => r.file),
    packages, records, originalInputsUnchanged: true,
    limits: ['Byte correspondence to locked installed source candidates and the actual installed packaging helper, not a verified publisher-tarball or full-build/source reproduction', 'Observed contributor metadata removal is recorded, not treated as notice/attribution clearance', 'Lazy-val original, full embedded/native/vendor/source/relinking, CRT minimum and permitted clean-machine installation/A5 remain open', 'No native executable/DLL execution, installer/package change, real content, pin change, public binary or deployment'],
  };
  fs.writeFileSync(out + '/result.json', JSON.stringify(result, null, 2) + '\n');
  fs.copyFileSync(__filename, out + '/producer.cjs');
  console.log({ status: result.status, packages: result.packageRoots, archivedFiles: result.archivedFiles, direct: result.exactUntransformedFiles, transformed: result.exactTransformedManifests, consistent: packages.length, contributorMetadataRemoved: result.contributorMetadataRemoved, elapsedMs: result.elapsedMs });
})().catch(error => {
  fs.writeFileSync(out + '/failure.json', JSON.stringify({ at: new Date().toISOString(), error: error.stack, elapsedMs: Date.now() - began }, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
});
