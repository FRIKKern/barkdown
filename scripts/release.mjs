// Cut a Barkdown release (docs/RELEASE.md). Two channels:
//   nightly  — the commit at HEAD on main, as vX.Y.Z-nightly.<date>.<n>, a GitHub prerelease.
//   stable   — the commit of a nightly, promoted as vX.Y.Z and marked latest. Never a fresh build.
// app/package.json holds the NEXT stable version; a stable release bumps it afterwards.
// Invariants, each refused rather than warned: a clean tree on a pushed commit; a chain receipt
// (scripts/chain.mjs) for that exact commit; the image rehearsed after it is built; checksums from
// the bytes that are uploaded; notes against the previous tag in the same channel. There is no
// dry run: every run of this script that passes its gates is a real release.
// Usage: node scripts/release.mjs nightly | stable [--from v0.6.0-nightly.20261001.1] [--version X.Y.Z] [--skip-rehearsal] [--if-due [--due-only]] [--chain]
//        [--plan | --stage --planned <tag> | --publish --planned <tag> --arches arm64,x64]
// --if-due (nightly, for a schedule): exit 0 without doing anything unless main has new commits since
// the last nightly and six hours have passed since it was cut. --chain: run scripts/chain.mjs first when
// the commit has no receipt (scripts/nightly-tick.sh passes both).
// Without a mode it builds, rehearses and publishes this Mac's architecture. A release built on several
// Macs (.github/workflows/release.yml) splits that: --plan names the tag once (tag= in GITHUB_OUTPUT), each
// Mac runs --stage for its architecture into .release/<tag>/<arch>/, and --publish gathers those folders,
// one updater feed for every architecture, one SHA256SUMS and the notes, refusing a missing architecture.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planRelease, nextPatch, nightlyDue, mergeMacFeeds } from './release-plan.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), appDir = path.join(root, 'app');
const args = process.argv.slice(2), channel = args[0];
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const fail = message => { console.error('release: ' + message); process.exit(2); };
if (!['nightly', 'stable'].includes(channel)) fail('usage: node scripts/release.mjs nightly | stable [--from <nightly tag>] [--version X.Y.Z] [--skip-rehearsal]');
const mode = ['--plan', '--stage', '--publish'].find(m => args.includes(m))?.slice(2) || 'all', planned = flag('--planned');
if (['stage', 'publish'].includes(mode) && !planned) fail(`--${mode} needs the --planned tag`);
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const sh = (command, a, options = {}) => { const r = spawnSync(command, a, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], ...options }); if (r.status !== 0) fail(`${command} ${a.join(' ')} ${r.error?.code === 'ETIMEDOUT' ? `ran past ${options.timeout / 60000} minutes and was stopped` : `exited ${r.status ?? r.signal}`}`); };
const env = { ...process.env, TMPDIR: fs.realpathSync(os.tmpdir()) + path.sep };

// 1. The commit: clean, on main (nightly) or at a nightly's commit (stable), and already pushed.
if (git('status', '--porcelain', '--untracked-files=no')) fail('the tree has tracked changes; a release names one commit');
const sha = git('rev-parse', 'HEAD'), short = sha.slice(0, 9);
git('fetch', 'origin', '--tags', '--quiet');
if (!git('branch', '-r', '--contains', sha).includes('origin/main')) fail(`commit ${short} is not on origin/main; push first`);
const tags = git('tag', '--list', '--sort=-creatordate').split('\n').filter(Boolean);
const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
if (channel === 'nightly' && git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('a nightly is cut from main');
if (channel === 'nightly' && args.includes('--if-due')) {
  const lastTag = tags.find(t => /^v\d+\.\d+\.\d+-nightly\.\d{8}\.\d+$/.test(t)) || null;
  const last = lastTag ? { tag: lastTag, sha: git('rev-list', '-n', '1', lastTag), at: git('log', '-1', '--format=%cI', lastTag) } : null;
  const verdict = nightlyDue({ lastNightly: last, headSha: sha, isAncestor: (a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: root }).status === 0 });
  console.log(`release: nightly ${verdict.due ? 'due' : 'not due'}: ${verdict.reason}`);
  // --due-only: the verdict alone, for a workflow that builds the runtime only when a nightly will be cut.
  if (args.includes('--due-only')) { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `due=${verdict.due}\n`); process.exit(0); }
  if (!verdict.due) process.exit(0);
}
// A planned nightly keeps the date it was planned on, so Macs that finish after midnight name the same tag.
const date = /nightly\.(\d{8})\./.exec(planned || '')?.[1] || new Date().toISOString().slice(0, 10).replace(/-/g, '');
let plan; try { plan = planRelease({ channel, tags, manifestVersion: manifest.version, date, from: flag('--from'), version: flag('--version') }); } catch (error) { fail(error.message); }
const { version, tag, previousTag, fromTag } = plan;
if (planned && planned !== tag) fail(`planned ${planned}, but the tags now give ${tag}: another release took the number`);
if (fromTag) { const nightlySha = git('rev-list', '-n', '1', fromTag); if (nightlySha !== sha) fail(`HEAD is ${short} but ${fromTag} is ${nightlySha.slice(0, 9)}: a stable release is the nightly's commit, so check it out (git checkout ${nightlySha.slice(0, 9)}) and run again`); }
if (tags.includes(tag)) fail(`${tag} already exists`);
if (mode === 'plan') { console.log(`release: planned ${tag}`); if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`); process.exit(0); }
const feedChannel = channel === 'nightly' ? 'nightly' : 'latest', releaseRoot = path.join(root, '.release', tag);
const arches = mode === 'publish' ? (flag('--arches') || '').split(',').filter(Boolean) : [process.arch];
if (!arches.length || arches.some(a => !['arm64', 'x64'].includes(a))) fail('--arches is arm64, x64 or both');
if (mode !== 'publish') {
  if (process.platform !== 'darwin') fail('a Mac release is built on macOS');
  // 2. The chain receipt for this exact commit. --chain runs the chain here when the commit has none yet
  //    (the schedule's case, after the due gate); a chain that fails is a release that does not happen.
  const receiptFile = path.join(root, '.release', 'chain', sha + '.json');
  if (args.includes('--chain') && !fs.existsSync(receiptFile)) sh(process.execPath, [path.join(root, 'scripts', 'chain.mjs'), '--retry-once'], { env });
  let receipt; try { receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8')); } catch { fail(`no chain receipt for ${short}: run node scripts/chain.mjs on this commit first`); }
  if (receipt.status !== 'passed' || receipt.sha !== sha) fail(`the chain receipt for ${short} did not pass`);
  console.log(`release: ${channel} ${tag} from ${short}${fromTag ? ` (promoting ${fromTag})` : ''}, previous ${previousTag || 'none'}, ${process.arch}`);
  // 3. Build the application and the image under this version.
  const pin = fs.readFileSync(path.join(appDir, 'BARKPARK_REF'), 'utf8').trim();
  const runtime = path.join(root, 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`);
  if (!fs.existsSync(path.join(runtime, 'barkdown-release.json'))) fail(`no runtime folder at ${runtime}; build it with scripts/build-runtime-release.mjs`);
  sh(process.execPath, [path.join(root, 'scripts', 'build-mac-app.mjs'), runtime, '--dmg', '--version', version, '--channel', feedChannel], { env });
  const dmg = path.join(appDir, 'release', `Barkdown-${version}-${process.arch}.dmg`);
  if (!fs.existsSync(dmg)) fail('the image was not written');
  // 4. Rehearse the image that will be uploaded, and the daily-use checks, on this Mac.
  const stage = path.join(releaseRoot, process.arch); fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(path.join(stage, 'rehearsals'), { recursive: true });
  const evidence = path.join(root, 'docs', 'cycles', 'evidence', 'C086', 'live');
  const newest = suffix => fs.readdirSync(evidence).filter(d => d.endsWith(suffix)).sort().at(-1);
  const rehearsals = [];
  if (!args.includes('--skip-rehearsal')) {
    for (const [script, suffix] of [['test:app-dmg', '-app-dmg'], ['test:daily-use', '-daily-use']]) {
      // Bounded: a rehearsal that waits on something nobody can answer (a keychain prompt) fails in minutes, not at the job limit.
      sh('npm', ['run', '-s', script], { cwd: appDir, env: { ...env, BARKDOWN_TEST_DMG: dmg }, timeout: 40 * 60000 });
      const dir = newest(suffix); const result = JSON.parse(fs.readFileSync(path.join(evidence, dir, 'result.json'), 'utf8'));
      if (result.status !== 'passed') fail(`${script} did not pass`);
      fs.copyFileSync(path.join(evidence, dir, 'result.json'), path.join(stage, 'rehearsals', `${process.arch}-${suffix.slice(1)}.json`));
      rehearsals.push({ script, dir, status: result.status, count: (result.checks || result.findings || []).length, kind: result.findings ? 'findings' : 'checks' });
    }
  }
  // 5. What this architecture contributes, from the bytes that are uploaded: the image, the updater feed and
  //    what it points at (zip + blockmap), the proof, and what Gatekeeper says about the image.
  const releaseDir = path.join(appDir, 'release');
  const files = fs.readdirSync(releaseDir).filter(f => f === `${feedChannel}-mac.yml` || (f.startsWith(`Barkdown-${version}-${process.arch}.`) && /\.(dmg|zip|zip\.blockmap)$/.test(f)));
  if (!files.includes(`${feedChannel}-mac.yml`)) fail('the updater feed is missing from the build');
  for (const name of files) fs.copyFileSync(path.join(releaseDir, name), path.join(stage, name));
  fs.writeFileSync(path.join(stage, 'rehearsals', `${process.arch}-chain-receipt.json`), JSON.stringify(receipt, null, 2) + '\n');
  const notarized = spawnSync('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', dmg]).status === 0;
  const mark = JSON.parse(fs.readFileSync(path.join(runtime, 'barkdown-release.json'), 'utf8'));
  fs.writeFileSync(path.join(stage, 'stage.json'), JSON.stringify({ tag, sha, arch: process.arch, image: path.basename(dmg), sizeMb: Math.round(fs.statSync(dmg).size / 1048576), notarized,
    runtime: mark.upstream, postgres: mark.postgres?.postgres || null, receipt: { host: receipt.host, check: receipt.steps.check, test: receipt.steps.test }, rehearsals }, null, 2) + '\n');
  console.log(`release: staged ${tag} for ${process.arch} in ${stage}${notarized ? ', notarized' : ', signed ad hoc'}`);
  if (mode === 'stage') process.exit(0);
}
// 6. Gather every architecture: one feed, one SHA256SUMS, the notes against the previous tag in this channel.
const stages = arches.map(arch => { try { return JSON.parse(fs.readFileSync(path.join(releaseRoot, arch, 'stage.json'), 'utf8')); } catch { return fail(`no staged ${arch} build in ${path.join(releaseRoot, arch)}`); } });
for (const st of stages) if (st.tag !== tag || st.sha !== sha) fail(`the staged ${st.arch} build is ${st.tag} at ${st.sha.slice(0, 9)}, not ${tag} at ${short}`);
const out = path.join(releaseRoot, 'publish'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const assets = [];
for (const st of stages) for (const name of fs.readdirSync(path.join(releaseRoot, st.arch))) {
  if (/\.(dmg|zip|zip\.blockmap)$/.test(name)) { fs.copyFileSync(path.join(releaseRoot, st.arch, name), path.join(out, name)); assets.push(name); }
}
for (const st of stages) for (const name of fs.readdirSync(path.join(releaseRoot, st.arch, 'rehearsals'))) { fs.copyFileSync(path.join(releaseRoot, st.arch, 'rehearsals', name), path.join(out, name)); assets.push(name); }
const feedName = `${feedChannel}-mac.yml`;
try { fs.writeFileSync(path.join(out, feedName), mergeMacFeeds(stages.map(st => fs.readFileSync(path.join(releaseRoot, st.arch, feedName), 'utf8')))); } catch (error) { fail('the updater feeds do not merge: ' + error.message); }
assets.push(feedName);
const sums = assets.filter(name => /\.(dmg|zip)$/.test(name)).sort().map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(out, name))).digest('hex')}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(out, 'SHA256SUMS'), sums); assets.push('SHA256SUMS');
const range = previousTag ? `${previousTag}..${sha}` : sha;
const log = git('log', '--no-merges', '--format=- %s (%h)', range).split('\n').filter(Boolean);
const cycle = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'cycle.json'), 'utf8'));
const label = { arm64: 'Apple silicon (arm64)', x64: 'Intel (x64)' };
// What the notes promise about opening it is what Gatekeeper said about every uploaded image.
const notarized = stages.every(st => st.notarized);
const notes = [
  `# Barkdown ${version}${channel === 'nightly' ? ' (nightly)' : ''}`, '',
  channel === 'nightly' ? `A nightly build of \`main\` at ${short}: the owner's daily build and the candidate for the next stable. Not marked latest.` : `Stable ${version}: the commit of ${fromTag}, promoted after it was run. Marked latest.`, '',
  `Commit ${sha} · Barkpark runtime ${stages[0].runtime.slice(0, 9)} with Postgres ${stages[0].postgres || '?'} inside`, '',
  '## Install', '', ...stages.map(st => `- ${label[st.arch]}: \`${st.image}\` (${st.sizeMb} MB)`), '',
  `Verify the image against \`SHA256SUMS\`, open it and drag Barkdown to Applications. ${notarized ? 'It is signed with a Developer ID and notarized by Apple, so it opens like any downloaded app.' : 'It is signed ad hoc: on another Mac the first open is refused; then System Settings › Privacy & Security › Open Anyway (macOS 15 no longer offers right-click › Open).'} Your Claude Code or Codex sign-in is used as it is; nothing is bundled.`, '',
  `## Changes since ${previousTag || 'the beginning'}`, '', ...(log.length ? log.slice(0, 80) : ['- (no commits)']), ...(log.length > 80 ? [`- … and ${log.length - 80} more`] : []), '',
  '## Proof', '', ...stages.flatMap(st => [
    `- ${label[st.arch]}: full desktop chain on ${short}, check ${st.receipt.check?.status} (${st.receipt.check?.seconds}s), tests ${st.receipt.test?.status} (${st.receipt.test?.seconds}s) on ${st.receipt.host}.`,
    ...st.rehearsals.map(r => `  - ${r.script} on this image: ${r.status}, ${r.count} ${r.kind} (\`${r.dir}\`).`)]),
  `- Current cycle: ${cycle.id} — ${cycle.handoff}.`, '',
  '## Limits', '', `- The updater feed (\`${feedName}\`, each zip and its blockmap) is attached; an installed Barkdown can download an update from it` + (notarized ? ' and install it.' : ', and installs it only once the application is signed with a Developer ID.') + ' See docs/RELEASE.md.', ''].join('\n');
fs.writeFileSync(path.join(out, 'NOTES.md'), notes);
// 7. Tag and publish.
git('tag', '-a', tag, '-m', `Barkdown ${version}`, sha);
sh('git', ['push', 'origin', tag]);
sh('gh', ['release', 'create', tag, '--target', sha, '--title', `Barkdown ${version}${channel === 'nightly' ? ' (nightly)' : ''}`, '--notes-file', path.join(out, 'NOTES.md'), ...(channel === 'nightly' ? ['--prerelease'] : ['--latest']), ...assets.map(name => path.join(out, name))]);
// 8. After a stable: app/package.json moves to the next patch, on main.
if (channel === 'stable') {
  console.log(`release: stable ${tag} published. Next: on main, set app/package.json to ${nextPatch(version)} and commit "chore(release): after ${tag}".`);
}
console.log(`release: ${tag} published — ${git('config', '--get', 'remote.origin.url').replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/')}/releases/tag/${tag}`);
