import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const startedAt = new Date().toISOString(), start = Date.now();
const out = 'docs/cycles/evidence/C098/import-byte-proof-03';
fs.mkdirSync(out, { recursive: false }); fs.copyFileSync(fileURLToPath(import.meta.url), out + '/producer.mjs');
const report = JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/import-scan-05/audit/imports.json'));
const previous = JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/carried-package-02/pe-imports.json'));
assert.equal(report.status, 'incomplete-preparation'); assert.equal(report.distributionReady, false); assert.equal(report.files.length, 186);
for (const file of report.files) {
  const earlier = previous.files.find(row => row.path === file.path);
  assert.ok(earlier); assert.equal(earlier.bytes, file.bytes); assert.equal(earlier.sha256, file.sha256);
}
const base = path.resolve('app/release/C098 Packaged Chø 02/win-unpacked');
const originalInventory = JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/carried-package-02/runtime-inventory.json'));
for (const row of originalInventory) {
  const file = path.join(base, 'resources/runtime', row.path);
  assert.equal(fs.statSync(file).size, row.bytes); assert.equal(sha(file), row.sha256);
}
const packageRecord = JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/carried-package-02/result.json'));
assert.equal(sha(packageRecord.executable.path), packageRecord.executable.sha256);
assert.equal(sha(packageRecord.archive.path), packageRecord.archive.sha256);
const raw = JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/import-scan-05/audit/dumpbin-output.json'));
assert.equal(raw.length, 186);
for (const row of raw) {
  const file = path.resolve('docs/cycles/evidence/C098/import-scan-05/audit', row.output);
  assert.equal(fs.statSync(file).size, row.bytes); assert.equal(sha(file), row.sha256);
}
const snapshot = JSON.parse(fs.readFileSync('docs/cycles/evidence/C098/import-scan-05/tested-source.json'));
for (const file of snapshot.files) assert.equal(sha(file.file), file.sha256);
const oldNames = new Set(previous.files.flatMap(row => row.imports.map(name => name.toLowerCase())));
const additions = report.dependencies.filter(row => !oldNames.has(row.name)).map(row => ({ name: row.name, importers: row.importers.length, kind: [...new Set(row.importers.map(i => i.kind))], category: row.category }));
const result = { status: 'passed', startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - start,
  sameNativeBytes: report.files.length, sameRuntimeFiles: originalInventory.length,
  sameExecutableAndArchive: true, originalRawOutputs: raw.length, sourceSnapshotExact: true,
  additions, categories: report.dependencies.reduce((counts, row) => (counts[row.category] = (counts[row.category] || 0) + 1, counts), {}),
  architectures: report.files.reduce((counts, row) => (counts[row.arch] = (counts[row.arch] || 0) + 1, counts), {}),
  crt: report.dependencies.filter(row => row.category === 'visual-c-runtime').map(row => ({ name: row.name, importers: row.importers.length, carriedCandidates: row.candidates.length })),
  limits: ['Static preparation only; previous package bytes preserved, no installation or loader resolution acceptance'] };
fs.writeFileSync(out + '/result.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result));
