// Cut a Barkdown release from this Mac (docs/RELEASE.md). Two channels:
//   nightly  — the commit at HEAD on main, as vX.Y.Z-nightly.<date>.<n>, a GitHub prerelease.
//   stable   — the commit of a nightly, promoted as vX.Y.Z and marked latest. Never a fresh build.
// app/package.json holds the NEXT stable version; a stable release bumps it afterwards.
// Invariants, each refused rather than warned: a clean tree on a pushed commit; a chain receipt
// (scripts/chain.mjs) for that exact commit; the image rehearsed after it is built; checksums from
// the bytes that are uploaded; notes against the previous tag in the same channel. There is no
// dry run: every run of this script that passes its gates is a real release.
// Usage: node scripts/release.mjs nightly | stable [--from v0.6.0-nightly.20261001.1] [--version X.Y.Z] [--skip-rehearsal]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planRelease, nextPatch } from './release-plan.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), appDir = path.join(root, 'app');
const args = process.argv.slice(2), channel = args[0];
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const fail = message => { console.error('release: ' + message); process.exit(2); };
if (!['nightly', 'stable'].includes(channel)) fail('usage: node scripts/release.mjs nightly | stable [--from <nightly tag>] [--version X.Y.Z] [--skip-rehearsal]');
if (process.platform !== 'darwin') fail('releases are cut on macOS for now');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const sh = (command, a, options = {}) => { const r = spawnSync(command, a, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], ...options }); if (r.status !== 0) fail(`${command} ${a.join(' ')} exited ${r.status}`); };
const env = { ...process.env, TMPDIR: fs.realpathSync(os.tmpdir()) + path.sep };

// 1. The commit: clean, on main (nightly) or at a nightly's commit (stable), and already pushed.
if (git('status', '--porcelain', '--untracked-files=no')) fail('the tree has tracked changes; a release names one commit');
const sha = git('rev-parse', 'HEAD'), short = sha.slice(0, 9);
git('fetch', 'origin', '--tags', '--quiet');
if (!git('branch', '-r', '--contains', sha).includes('origin/main')) fail(`commit ${short} is not on origin/main; push first`);
const tags = git('tag', '--list', '--sort=-creatordate').split('\n').filter(Boolean);
const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
if (channel === 'nightly' && git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('a nightly is cut from main');
let plan; try { plan = planRelease({ channel, tags, manifestVersion: manifest.version, date: new Date().toISOString().slice(0, 10).replace(/-/g, ''), from: flag('--from'), version: flag('--version') }); } catch (error) { fail(error.message); }
const { version, tag, previousTag, fromTag } = plan;
if (fromTag) { const nightlySha = git('rev-list', '-n', '1', fromTag); if (nightlySha !== sha) fail(`HEAD is ${short} but ${fromTag} is ${nightlySha.slice(0, 9)}: a stable release is the nightly's commit, so check it out (git checkout ${nightlySha.slice(0, 9)}) and run again`); }
if (tags.includes(tag)) fail(`${tag} already exists`);
// 2. The chain receipt for this exact commit.
const receiptFile = path.join(root, '.release', 'chain', sha + '.json');
let receipt; try { receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8')); } catch { fail(`no chain receipt for ${short}: run node scripts/chain.mjs on this commit first`); }
if (receipt.status !== 'passed' || receipt.sha !== sha) fail(`the chain receipt for ${short} did not pass`);
console.log(`release: ${channel} ${tag} from ${short}${fromTag ? ` (promoting ${fromTag})` : ''}, previous ${previousTag || 'none'}`);
// 3. Build the application and the image under this version.
const pin = fs.readFileSync(path.join(appDir, 'BARKPARK_REF'), 'utf8').trim();
const runtime = path.join(root, 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`);
if (!fs.existsSync(path.join(runtime, 'barkdown-release.json'))) fail(`no runtime folder at ${runtime}; build it with scripts/build-runtime-release.mjs`);
const feedChannel = channel === 'nightly' ? 'nightly' : 'latest';
sh(process.execPath, [path.join(root, 'scripts', 'build-mac-app.mjs'), runtime, '--dmg', '--version', version, '--channel', feedChannel], { env });
const dmg = path.join(appDir, 'release', `Barkdown-${version}-${process.arch}.dmg`);
if (!fs.existsSync(dmg)) fail('the image was not written');
// 4. Rehearse the image that will be uploaded, and the daily-use checks, on this Mac.
const stage = path.join(root, '.release', tag); fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(path.join(stage, 'rehearsals'), { recursive: true });
const evidence = path.join(root, 'docs', 'cycles', 'evidence', 'C086', 'live');
const newest = suffix => fs.readdirSync(evidence).filter(d => d.endsWith(suffix)).sort().at(-1);
const rehearsals = [];
if (!args.includes('--skip-rehearsal')) {
  for (const [script, suffix] of [['test:app-dmg', '-app-dmg'], ['test:daily-use', '-daily-use']]) {
    sh('npm', ['run', '-s', script], { cwd: appDir, env: { ...env, BARKDOWN_TEST_DMG: dmg } });
    const dir = newest(suffix); const result = JSON.parse(fs.readFileSync(path.join(evidence, dir, 'result.json'), 'utf8'));
    if (result.status !== 'passed') fail(`${script} did not pass`);
    fs.copyFileSync(path.join(evidence, dir, 'result.json'), path.join(stage, 'rehearsals', `${suffix.slice(1)}.json`)); rehearsals.push({ script, dir, result });
  }
}
// 5. Assets and checksums, from the bytes that are uploaded.
const assetName = path.basename(dmg);
// The image, the updater feed for this channel and what it points at (zip + blockmap): what a release carries.
const releaseDir = path.join(appDir, 'release');
const feedFiles = fs.readdirSync(releaseDir).filter(f => f === `${feedChannel}-mac.yml` || (f.startsWith(`Barkdown-${version}-`) && (f.endsWith('.zip') || f.endsWith('.zip.blockmap'))));
if (!feedFiles.includes(`${feedChannel}-mac.yml`)) fail('the updater feed is missing from the build');
for (const name of [assetName, ...feedFiles]) fs.copyFileSync(path.join(releaseDir, name), path.join(stage, name));
fs.writeFileSync(path.join(stage, 'rehearsals', 'chain-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
const sums = [assetName, ...feedFiles.filter(f => f.endsWith('.zip'))].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(stage, name))).digest('hex')}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(stage, 'SHA256SUMS'), sums);
const sizeMb = Math.round(fs.statSync(dmg).size / 1048576);
// 6. Notes against the previous tag in this channel.
const range = previousTag ? `${previousTag}..${sha}` : sha;
const log = git('log', '--no-merges', '--format=- %s (%h)', range).split('\n').filter(Boolean);
const cycle = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'cycle.json'), 'utf8'));
const mark = JSON.parse(fs.readFileSync(path.join(runtime, 'barkdown-release.json'), 'utf8'));
const notes = [
  `# Barkdown ${version}${channel === 'nightly' ? ' (nightly)' : ''}`, '',
  channel === 'nightly' ? `A nightly build of \`main\` at ${short}: the owner's daily build and the candidate for the next stable. Not marked latest.` : `Stable ${version}: the commit of ${fromTag}, promoted after it was run. Marked latest.`, '',
  `Commit ${sha} · Barkpark runtime ${mark.upstream.slice(0, 9)} with Postgres ${mark.postgres?.postgres || '?'} inside · macOS ${process.arch} · ${sizeMb} MB`, '',
  '## Install', '', `Download \`${assetName}\`, verify it against \`SHA256SUMS\`, open it and drag Barkdown to Applications. It is signed ad hoc for now: on another Mac, right-click › Open the first time. Your Claude Code or Codex sign-in is used as it is; nothing is bundled.`, '',
  `## Changes since ${previousTag || 'the beginning'}`, '', ...(log.length ? log.slice(0, 80) : ['- (no commits)']), ...(log.length > 80 ? [`- … and ${log.length - 80} more`] : []), '',
  '## Proof', '', `- Full desktop chain on ${short}: check ${receipt.steps.check?.status} (${receipt.steps.check?.seconds}s), tests ${receipt.steps.test?.status} (${receipt.steps.test?.seconds}s) on ${receipt.host}.`,
  ...rehearsals.map(r => `- ${r.script} on this image: ${r.result.status}, ${(r.result.checks || r.result.findings || []).length} ${r.result.findings ? 'findings' : 'checks'} (\`${r.dir}\`).`),
  `- Current cycle: ${cycle.id} — ${cycle.handoff}.`, '',
  '## Limits', '', '- One Mac, one architecture. The updater feed (`' + feedChannel + '-mac.yml`, the zip and its blockmap) is attached; an installed Barkdown can download an update from it, and installs it only once the application is signed with a Developer ID. See docs/RELEASE.md.', ''].join('\n');
fs.writeFileSync(path.join(stage, 'NOTES.md'), notes);
// 7. Tag and publish.
git('tag', '-a', tag, '-m', `Barkdown ${version}`, sha);
sh('git', ['push', 'origin', tag]);
const assets = [path.join(stage, assetName), ...feedFiles.map(f => path.join(stage, f)), path.join(stage, 'SHA256SUMS'), ...fs.readdirSync(path.join(stage, 'rehearsals')).map(f => path.join(stage, 'rehearsals', f))];
sh('gh', ['release', 'create', tag, '--target', sha, '--title', `Barkdown ${version}${channel === 'nightly' ? ' (nightly)' : ''}`, '--notes-file', path.join(stage, 'NOTES.md'), ...(channel === 'nightly' ? ['--prerelease'] : ['--latest']), ...assets]);
// 8. After a stable: app/package.json moves to the next patch, on main.
if (channel === 'stable') {
  console.log(`release: stable ${tag} published. Next: on main, set app/package.json to ${nextPatch(version)} and commit "chore(release): after ${tag}".`);
}
console.log(`release: ${tag} published — ${git('config', '--get', 'remote.origin.url').replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/')}/releases/tag/${tag}`);
