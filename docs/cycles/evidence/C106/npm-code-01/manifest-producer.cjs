const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const { createRequire } = require('module');
const base = __dirname;
const repository = 'C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown';
const input = JSON.parse(fs.readFileSync(base + '/C106-package-source-338/result.json'));
const out = base + '/C106-package-manifests-342';
const asar = createRequire(repository + '/app/package.json')('@electron/asar');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert(!fs.existsSync(out));
fs.mkdirSync(out);
const began = Date.now();
const mismatches = input.records.filter(r => !r.matches.length);
assert.equal(mismatches.length, 133);
assert(mismatches.every(r => r.file.endsWith('/package.json')));
function changes(source, packaged, at = '') {
  if (JSON.stringify(source) === JSON.stringify(packaged)) return { removed: [], added: [], changed: [], ordering: [] };
  const result = { removed: [], added: [], changed: [], ordering: [] };
  if (!source || !packaged || Array.isArray(source) || Array.isArray(packaged) || typeof source !== 'object' || typeof packaged !== 'object') {
    result.changed.push(at || '/');
    return result;
  }
  const left = Object.keys(source), right = Object.keys(packaged);
  const sharedLeft = left.filter(k => right.includes(k)), sharedRight = right.filter(k => left.includes(k));
  if (JSON.stringify(sharedLeft) !== JSON.stringify(sharedRight)) result.ordering.push(at || '/');
  for (const key of left) {
    if (!Object.hasOwn(packaged, key)) result.removed.push(at + '/' + key);
    else {
      const nested = changes(source[key], packaged[key], at + '/' + key);
      for (const field of Object.keys(result)) result[field].push(...nested[field]);
    }
  }
  for (const key of right) if (!Object.hasOwn(source, key)) result.added.push(at + '/' + key);
  return result;
}
const records = [];
for (const mismatch of mismatches) {
  const owner = input.owners.find(p => p.root === mismatch.packageRoot);
  const nonManifest = input.records.filter(r => r.packageRoot === owner.root && !r.file.endsWith('/package.json'));
  const consistent = owner.candidates.filter(c => nonManifest.every(r => r.matches.includes(c.root)));
  assert(consistent.length, 'No consistent code source for ' + owner.root);
  const suffix = mismatch.file.slice(owner.root.length + 1);
  const actualBytes = asar.extractFile(input.entry.archive, path.normalize(mismatch.file));
  assert.equal(hash(actualBytes), mismatch.sha256);
  const packaged = JSON.parse(actualBytes);
  const candidates = [];
  for (const candidate of consistent) {
    const file = path.join(repository, 'app', candidate.root, suffix);
    const bytes = fs.readFileSync(file), source = JSON.parse(bytes);
    const delta = changes(source, packaged);
    candidates.push({ root: candidate.root, sourceSha256: hash(bytes), parsedExactIncludingPropertyOrder: JSON.stringify(source) === JSON.stringify(packaged), ...delta });
  }
  records.push({ file: mismatch.file, packageRoot: owner.root, name: owner.name, version: owner.version, packagedSha256: mismatch.sha256, candidates });
}
const removed = [...new Set(records.flatMap(r => r.candidates.flatMap(c => c.removed)))].sort();
const nonRemoval = records.filter(r => r.candidates.every(c => c.added.length || c.changed.length || c.ordering.length));
const result = {
  at: new Date().toISOString(), status: 'measured', elapsedMs: Date.now() - began,
  artifactSha256: input.entry.archiveSha256, input: 'C106-package-source-338/result.json',
  manifestDifferences: records.length, byteExactNonManifestFiles: input.matched,
  onlyRemovedFieldsOrFormatting: records.length - nonRemoval.length,
  removedPaths: removed, remainingSemanticOrOrderingDifferences: nonRemoval, records,
  limits: 'Comparison only. No normalization of the artifact, no assumption that removed fields are safe or notices sufficient, no publisher archive reproduction or installation acceptance.',
};
assert.equal(hash(fs.readFileSync(input.entry.archive)), input.entry.archiveSha256);
fs.writeFileSync(out + '/result.json', JSON.stringify(result, null, 2) + '\n');
fs.copyFileSync(__filename, out + '/producer.cjs');
console.log({ manifests: records.length, removed, onlyRemovedOrFormatting: result.onlyRemovedFieldsOrFormatting, remaining: nonRemoval.map(r => ({ file: r.file, candidateDeltas: r.candidates.map(c => ({ changed: c.changed, added: c.added, ordering: c.ordering })) })), elapsedMs: result.elapsedMs });
