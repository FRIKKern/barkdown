// Move the Barkpark pin to a merged upstream commit whose editor assets are byte-identical
// to the vendored ones. Rewrites app/BARKPARK_REF and the source commit recorded in the
// editor provenance, the consumption audit and both notices manifests, then re-pins the
// notices manifest hash. Refuses when any consumed or preserved asset differs at the
// target commit: that is an editor upgrade and needs the full C074 procedure.
//   node scripts/bump-barkpark-ref.mjs <upstream-worktree> <commit> [--write]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [upstream, commit, ...flags] = process.argv.slice(2);
if (!upstream || !/^[0-9a-f]{40}$/.test(commit || '')) throw Error('Usage: bump-barkpark-ref.mjs <upstream-worktree> <full commit sha> [--write]');
const write = flags.includes('--write');
const root = path.resolve(import.meta.dirname, '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const show = file => execFileSync('git', ['show', `${commit}:${file}`], { cwd: upstream, maxBuffer: 64 * 1024 * 1024 });
const provenancePath = path.join(root, 'app/renderer/vendor/paper-editor-provenance.json');
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
const upstreamPaths = { 'bp-paper-editor.bundle.js': 'api/priv/static/assets/bp-paper-editor.bundle.js', 'bp-paper-editor.css': 'api/priv/static/assets/bp-paper-editor.css' };
for (const [file, expected] of Object.entries(provenance.consumedAssets)) {
  const actual = sha256(show(upstreamPaths[file]));
  if (actual !== expected) throw Error(`${file} differs at ${commit.slice(0, 9)} (${actual.slice(0, 12)} vs vendored ${expected.slice(0, 12)}): this is an editor upgrade, not a pin move`);
}
const lock = sha256(show('api/assets/paper-editor/package-lock.json'));
const manifestPath = path.join(root, 'docs/third-party/paper-editor/manifest.json'), shippedPath = path.join(root, 'app/renderer/vendor/paper-editor-notices/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.lockSha256 !== lock) throw Error('The editor dependency lock differs at the target commit; run the full notices procedure');
const auditPath = path.join(root, 'docs/editor-consumption-audit.json'), audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const refPath = path.join(root, 'app/BARKPARK_REF');
const previous = fs.readFileSync(refPath, 'utf8').trim();
console.log(`pin ${previous.slice(0, 9)} -> ${commit.slice(0, 9)}; editor bundle, css and lock identical at the target`);
if (!write) { console.log('dry run; pass --write to apply'); process.exit(0); }
manifest.sourceCommit = commit;
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync(manifestPath, manifestText); fs.writeFileSync(shippedPath, manifestText);
provenance.sourceCommit = commit; provenance.dependencyManifestSha256 = sha256(Buffer.from(manifestText));
fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
audit.source = commit; audit.pinMovedFrom = previous; audit.pinMovedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
fs.writeFileSync(refPath, commit + '\n');
console.log('written: app/BARKPARK_REF, provenance, consumption audit, both notices manifests');
