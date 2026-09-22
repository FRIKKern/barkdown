// Distribution fidelity: do not let a future copy omit licenses or replace host overrides.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '../..');
const vendor = path.join(root, 'app/renderer/vendor');
const read = p => fs.readFileSync(p);
const hash = p => crypto.createHash('sha256').update(read(p)).digest('hex');
const json = p => JSON.parse(read(p));

test('consumed editor pin/assets and preserved host overrides match audited provenance', () => {
  const provenance = json(path.join(vendor, 'paper-editor-provenance.json'));
  const audit = json(path.join(root, 'docs/editor-consumption-audit.json'));
  assert.equal(read(path.join(root, 'app/BARKPARK_REF')).toString().trim(), provenance.sourceCommit);
  assert.equal(provenance.sourceCommit, audit.source);
  for (const [file, expected] of Object.entries({ ...provenance.consumedAssets, ...provenance.preservedAssets })) {
    assert.equal(hash(path.join(vendor, file)), expected, file);
    const item = audit.assets.find(a => a.file === file);
    if (item.preserveSha256) assert.equal(expected, item.preserveSha256, file);
    else assert.equal(crypto.createHash('sha1').update(read(path.join(vendor, file))).digest('hex'), item.upstreamSha1, file);
  }
  assert.equal(hash(path.join(vendor, provenance.dependencyNotices)), provenance.dependencyManifestSha256);
});

test('all exact bundled notices and source attribution ship beside the consumed bundle', () => {
  const shipped = path.join(vendor, 'paper-editor-notices');
  const archive = path.join(root, 'docs/third-party/paper-editor');
  assert.deepEqual(read(path.join(shipped, 'manifest.json')), read(path.join(archive, 'manifest.json')));
  const manifest = json(path.join(shipped, 'manifest.json'));
  assert.equal(hash(path.join(vendor, 'bp-paper-editor.bundle.js')), manifest.bundleSha256);
  assert.equal(manifest.packages.length, 49);
  for (const pkg of manifest.packages) {
    assert.ok(pkg.notices.length, pkg.name);
    assert.equal(pkg.unavailable, undefined);
    for (const notice of pkg.notices) {
      assert.equal(hash(path.join(shipped, notice.file)), notice.sha256, pkg.name);
      assert.deepEqual(read(path.join(shipped, notice.file)), read(path.join(archive, notice.file)));
    }
  }
  for (const file of manifest.provenanceFiles) assert.equal(hash(path.join(shipped, file.file)), file.sha256, file.file);
  assert.ok(json(path.join(root, 'app/package.json')).build.files.includes('renderer/**'));
});
