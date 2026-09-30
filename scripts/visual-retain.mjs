// Retention of committed pictures (user decision, 2026-09-30): the repository keeps the two
// newest visual runs per platform plus every run an approval or the pending review names, and
// the two newest sets of status screenshots. Everything older stays in git history. Links in
// documents to what left the tree are rewritten to say so, so the link check stays honest.
// `node scripts/visual-retain.mjs` applies the rule; `--check` only reports what it would remove.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkOnly = process.argv.includes('--check');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const runsDir = 'docs/visual/runs', statusDir = 'docs/images/status';
const RUNS_PER_PLATFORM = 2, STATUS_SETS = 2;
// Visual runs.
const runs = fs.readdirSync(path.join(root, runsDir)).filter(name => /^\d{4}-\d\d-\d\dT/.test(name)).sort();
// A run without a manifest is an aborted capture; it is kept only if something names it.
const platformOf = run => { try { return read(`${runsDir}/${run}/manifest.json`).environment?.platform || 'win32'; } catch { return null; } };
const named = new Set();
for (const file of fs.readdirSync(path.join(root, 'docs/visual')).filter(f => /^approved(\.[a-z0-9]+)?\.json$/.test(f))) { const m = /runs\/([^/]+)\//.exec(read('docs/visual/' + file).manifest || ''); if (m) named.add(m[1]); }
try { const pending = read('docs/visual/pending.json').run; if (pending) named.add(pending); } catch {}
const byPlatform = new Map();
for (const run of runs) { const p = platformOf(run); if (!p) continue; if (!byPlatform.has(p)) byPlatform.set(p, []); byPlatform.get(p).push(run); }
const keepRuns = new Set(named);
for (const list of byPlatform.values()) for (const run of list.slice(-RUNS_PER_PLATFORM)) keepRuns.add(run);
const dropRuns = runs.filter(run => !keepRuns.has(run));
// Status screenshots: the current manifest's files and the previous set's.
const manifests = [];
try { manifests.push(read(`${statusDir}/manifest.json`)); } catch {}
const history = fs.existsSync(path.join(root, statusDir, 'history')) ? fs.readdirSync(path.join(root, statusDir, 'history')).filter(f => /^\d{4}-\d\d-\d\dT.*\.json$/.test(f)).sort() : [];
for (const file of history.slice(-(STATUS_SETS - 1))) { try { manifests.push(read(`${statusDir}/history/${file}`)); } catch {} }
const keepStatus = new Set(manifests.flatMap(m => (m.shots || []).map(s => s.file)));
const hashed = fs.readdirSync(path.join(root, statusDir)).filter(name => /\.[0-9a-f]{8}\.(png|gif)$/.test(name));
const dropStatus = hashed.filter(name => !keepStatus.has(name));
const dropped = [...dropRuns.map(run => `${runsDir}/${run}`), ...dropStatus.map(name => `${statusDir}/${name}`)];
if (checkOnly) { if (dropped.length) { console.error(`${dropped.length} committed picture set(s) exceed the retention rule; run: node scripts/visual-retain.mjs`); process.exit(1); } console.log(`Picture retention: ${keepRuns.size} visual runs and ${keepStatus.size} status screenshots kept.`); process.exit(0); }
// Rewrite links in documents to what leaves the tree.
const markdownFiles = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? markdownFiles(dir + '/' + e.name) : e.name.endsWith('.md') ? [dir + '/' + e.name] : []);
// Gone: what leaves now, and what an earlier run of this rule already removed (a kept run's review compares against an older one).
const gone = target => dropRuns.some(run => target.startsWith(`${runsDir}/${run}/`) || target === `${runsDir}/${run}`) || dropStatus.some(name => target === `${statusDir}/${name}`)
  || ((target.startsWith(runsDir + '/') || target.startsWith(statusDir + '/')) && !fs.existsSync(path.join(root, target)));
let rewritten = 0;
for (const file of ['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'app/README.md', ...markdownFiles('docs')].filter(f => fs.existsSync(path.join(root, f)))) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const next = text.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, bang, label, link) => {
    const clean = link.split('#')[0]; if (!clean || /^(?:https?:|mailto:)/.test(clean)) return whole;
    const target = path.relative(root, path.resolve(root, path.dirname(file), clean)).split(path.sep).join('/');
    if (!gone(target)) return whole;
    rewritten++;
    return bang ? `*${label || 'picture'}* (\`${target}\`, kept in git history)` : `${label} (\`${target}\`, kept in git history)`;
  });
  if (next !== text) fs.writeFileSync(path.join(root, file), next);
}
for (const item of dropped) fs.rmSync(path.join(root, item), { recursive: true, force: true });
console.log(`Removed ${dropRuns.length} visual runs and ${dropStatus.length} status screenshots from the tree; ${rewritten} document links now point at git history. Kept ${keepRuns.size} runs (${[...byPlatform.keys()].join(', ')}) and ${keepStatus.size} screenshots.`);
