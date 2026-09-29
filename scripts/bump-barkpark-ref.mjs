// Move the Barkpark pin to a merged upstream commit whose editor assets are byte-identical
// to the vendored ones. Rewrites app/BARKPARK_REF and the source commit recorded in the
// editor provenance, the consumption audit and both notices manifests, then re-pins the
// notices manifest hash. Refuses when any consumed or preserved asset differs at the
// target commit, unless the move is declared an editor upgrade with proof that the bundle
// was rebuilt from the target's source to the same bytes. The dependency lock must be
// identical either way: a changed lock needs the full notices procedure.
//   node scripts/bump-barkpark-ref.mjs <upstream-worktree> <commit> [--write]
//   node scripts/bump-barkpark-ref.mjs <upstream-worktree> <commit> --editor-upgrade --built <rebuilt bundle.js> [--write]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [upstream, commit, ...flags] = process.argv.slice(2);
if (!upstream || !/^[0-9a-f]{40}$/.test(commit || '')) throw Error('Usage: bump-barkpark-ref.mjs <upstream-worktree> <full commit sha> [--write]');
const write = flags.includes('--write'), upgrade = flags.includes('--editor-upgrade');
const builtPath = flags.includes('--built') ? flags[flags.indexOf('--built') + 1] : null;
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const root = path.resolve(import.meta.dirname, '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const show = file => execFileSync('git', ['show', `${commit}:${file}`], { cwd: upstream, maxBuffer: 64 * 1024 * 1024 });
const provenancePath = path.join(root, 'app/renderer/vendor/paper-editor-provenance.json');
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
const upstreamPaths = { 'bp-paper-editor.bundle.js': 'api/priv/static/assets/bp-paper-editor.bundle.js', 'bp-paper-editor.css': 'api/priv/static/assets/bp-paper-editor.css' };
const changedAssets = [];
for (const [file, expected] of Object.entries(provenance.consumedAssets)) {
  const actual = sha256(show(upstreamPaths[file]));
  if (actual === expected) continue;
  if (!upgrade) throw Error(`${file} differs at ${commit.slice(0, 9)} (${actual.slice(0, 12)} vs vendored ${expected.slice(0, 12)}): this is an editor upgrade, not a pin move`);
  changedAssets.push({ file, from: expected, to: actual });
}
if (upgrade) {
  if (!changedAssets.length) throw Error('Nothing in the editor differs at the target; use the plain pin move');
  if (!builtPath || !fs.existsSync(builtPath)) throw Error('An editor upgrade needs --built <bundle rebuilt from the target source>');
  const committed = show(upstreamPaths['bp-paper-editor.bundle.js']);
  if (sha256(fs.readFileSync(builtPath)) !== sha256(committed)) throw Error('The rebuilt bundle is not byte-identical to the one committed at the target; the upgrade is refused');
}
const lock = sha256(show('api/assets/paper-editor/package-lock.json'));
const manifestPath = path.join(root, 'docs/third-party/paper-editor/manifest.json'), shippedPath = path.join(root, 'app/renderer/vendor/paper-editor-notices/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.lockSha256 !== lock) throw Error('The editor dependency lock differs at the target commit; run the full notices procedure');
const auditPath = path.join(root, 'docs/editor-consumption-audit.json'), audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const refPath = path.join(root, 'app/BARKPARK_REF');
const previous = fs.readFileSync(refPath, 'utf8').trim();
console.log(upgrade ? `editor upgrade ${previous.slice(0, 9)} -> ${commit.slice(0, 9)}; changed: ${changedAssets.map(a => a.file).join(', ')}; rebuilt bundle byte-identical to the committed one; lock identical`
  : `pin ${previous.slice(0, 9)} -> ${commit.slice(0, 9)}; editor bundle, css and lock identical at the target`);
if (!write) { console.log('dry run; pass --write to apply'); process.exit(0); }
manifest.sourceCommit = commit;
for (const asset of changedAssets) if (asset.file === 'bp-paper-editor.bundle.js' && 'bundleSha256' in manifest) manifest.bundleSha256 = asset.to;
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync(manifestPath, manifestText); fs.writeFileSync(shippedPath, manifestText);
provenance.sourceCommit = commit; provenance.dependencyManifestSha256 = sha256(Buffer.from(manifestText));
fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
for (const asset of changedAssets) {
  const bytes = show(upstreamPaths[asset.file]);
  fs.writeFileSync(path.join(root, 'app/renderer/vendor', asset.file), bytes);
  provenance.consumedAssets[asset.file] = asset.to;
  if (asset.file === 'bp-paper-editor.bundle.js') { audit.builtSha1 = sha1(fs.readFileSync(builtPath)); audit.committedSha1 = sha1(bytes); }
  for (const entry of Array.isArray(audit.assets) ? audit.assets : []) if (entry?.file === asset.file) { if ('vendorSha1' in entry) entry.vendorSha1 = sha1(bytes); if ('upstreamSha1' in entry) entry.upstreamSha1 = sha1(bytes); }
}
if (changedAssets.length) {
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
  audit.editorUpgrades = [...(audit.editorUpgrades || []), { from: previous, to: commit, at: new Date().toISOString().slice(0, 10), changed: changedAssets, proof: 'bundle rebuilt from the target source with the locked dependencies, byte-identical to the committed bundle' }];
}
audit.source = commit; audit.pinMovedFrom = previous; audit.pinMovedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
fs.writeFileSync(refPath, commit + '\n');
console.log('written: app/BARKPARK_REF, provenance, consumption audit, both notices manifests');
