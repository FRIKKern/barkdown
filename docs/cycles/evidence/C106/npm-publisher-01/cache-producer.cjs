const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const base = __dirname;
const proof = JSON.parse(fs.readFileSync(base + '/C106-package-transform-344/result.json'));
const corpus = JSON.parse(fs.readFileSync(base + '/C106-package-source-338/result.json'));
const cache = 'C:/Users/Frikk/AppData/Local/npm-cache/_cacache';
const inputs = new Map();
for (const pkg of proof.packages) {
  const owner = corpus.owners.find(p => p.root === pkg.root);
  for (const candidateRoot of pkg.consistentCandidates) {
    const candidate = owner.candidates.find(c => c.root === candidateRoot);
    assert.equal(new URL(candidate.resolved).origin, 'https://registry.npmjs.org');
    const key = candidate.resolved + '#' + candidate.integrity;
    if (!inputs.has(key)) inputs.set(key, { name: pkg.name, version: pkg.version, resolved: candidate.resolved, integrity: candidate.integrity, archivedRoots: [] });
    if (!inputs.get(key).archivedRoots.includes(pkg.root)) inputs.get(key).archivedRoots.push(pkg.root);
  }
}
const started = Date.now();
const records = [];
for (const input of inputs.values()) {
  const value = input.integrity.split(/\s+/).find(x => /^(sha512|sha256|sha1)-/.test(x));
  assert(value);
  const [, algorithm, encoded] = value.match(/^(sha512|sha256|sha1)-([A-Za-z0-9+/=]+)$/) || [];
  assert(algorithm);
  const digest = Buffer.from(encoded, 'base64').toString('hex');
  const file = path.resolve(cache, 'content-v2', algorithm, digest.slice(0, 2), digest.slice(2, 4), digest.slice(4));
  assert(file.startsWith(path.resolve(cache) + path.sep));
  const record = { ...input, algorithm, cacheFile: file, state: 'missing' };
  if (fs.existsSync(file)) {
    for (let at = file; ; at = path.dirname(at)) {
      assert(!fs.lstatSync(at).isSymbolicLink(), 'Linked dependency cache input');
      if (path.resolve(at) === path.resolve(cache)) break;
    }
    assert(fs.statSync(file).isFile());
    const bytes = fs.readFileSync(file);
    assert.equal(crypto.createHash(algorithm).update(bytes).digest('base64'), encoded, 'Dependency cache digest differs: ' + input.name);
    Object.assign(record, { state: 'integrity-verified', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  records.push(record);
}
const result = { at: new Date().toISOString(), status: 'measured', elapsedMs: Date.now() - started, uniqueInputs: records.length, cachedAndIntegrityVerified: records.filter(r => r.state === 'integrity-verified').length, missing: records.filter(r => r.state === 'missing').map(r => ({ name: r.name, version: r.version })), bytes: records.reduce((n, r) => n + (r.bytes || 0), 0), records, limits: 'Read-only preparation of known public locked publisher inputs in the existing dependency cache. No downloads, extraction, archived code execution, source/cache mutation, tar-member correspondence, publisher/full-source or notice acceptance.' };
fs.writeFileSync(base + '/C106-publisher-cache-inputs359.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log({ inputs: result.uniqueInputs, cached: result.cachedAndIntegrityVerified, missing: result.missing, bytes: result.bytes, elapsedMs: result.elapsedMs });
