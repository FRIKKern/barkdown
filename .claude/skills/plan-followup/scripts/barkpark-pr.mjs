#!/usr/bin/env node
// Land a Barkpark PR without rediscovering its gates.
//
// Barkpark's required "PR references an active task" gate wants exactly one `Task: <doc_id>`
// line at column 0 of the PR body, naming a task on the Guerrilla ledger that is CLAIMED
// (in_progress) by someone. Getting there has five traps, each learned the hard way on
// 2026-09-20; this script walks them in order and stops with a plain message at the first
// one it cannot clear itself.
//
//   1. bp's Guerrilla entry can hold a token with auth_tier "none" (a stale connection):
//      every task write then fails "caller is not a member of this workspace". The fix is
//      re-minting the server token from the cloud session — `bp setup --target cloud` — whose
//      Barkpark picker is interactive; we find Guerrilla's number in its listing and feed it
//      on stdin. That needs a live cloud login (`bp login`), which only the user can do.
//   2. A task publishes only past the label spine: a real description and 1-12 weighted,
//      REGISTERED tags (a `tag` document per name on that ledger). We check each tag exists.
//   3. A claim needs a worker id and refuses a row with no acceptance criteria; we write the
//      criteria at create time so the claim goes through.
//   4. `gh pr edit` fails on this repo (GitHub's classic-projects GraphQL deprecation); the
//      REST PATCH does not. Every body edit here goes through REST.
//   5. Branch protection requires four checks — Elixir gate, PR references an active task,
//      Cloud gate, Console gate — and NOT the security gates that are red on main itself.
//      --status prints exactly those, so a red elsewhere is not mistaken for a blocker.
//
// Usage (from the barkdown repo root, with the Barkpark branch pushed):
//   node .claude/skills/plan-followup/scripts/barkpark-pr.mjs create \
//     --title "paper-editor: …" --body-file pr.md --head barkdown/editor-quality \
//     --task-title "Barkdown editor parity: …" --task-description "…" \
//     --tags js-correctness:90:"canvas editing behaviour",robustness:60:"a refused save no longer pins the pipeline" \
//     --criterion "Barkdown app/tests/editor-tables.live.mjs is 11/11, three runs" \
//     --criterion "MERGE-GATED: PR merged to main" \
//     [--worker claude-code-barkdown] [--pr 19558]      # --pr: attach the task to an existing PR
//   node .claude/skills/plan-followup/scripts/barkpark-pr.mjs status --pr 19558
//
// Leaves bp on whatever server it found it on.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = 'FRIKKern/barkpark';
const LEDGER_NAME = 'Guerrilla';
const LEDGER_URL = 'https://guerrilla.barkpark.cloud';
const REQUIRED = ['Elixir gate', 'PR references an active task', 'Cloud gate', 'Console gate'];

const args = process.argv.slice(2);
const mode = args.shift();
const opt = { criterion: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  if (k === 'criterion') opt.criterion.push(v); else opt[k] = v;
}
const die = (m) => { console.error('\n' + m); process.exit(1); };
const run = (cmd, a, input) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8', input: input ?? undefined, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'], shell: false }); // bp is bp.exe and gh is gh.exe: no shell, so a '<' or '&' in a description is text, not cmd.exe syntax
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};
const bpJson = (a, input) => { const r = run('bp', [...a, '-o', 'json'], input); let j = null; try { j = JSON.parse(r.out.slice(r.out.indexOf('{'))); } catch {} return { ...r, json: j }; };

// ── ledger ─────────────────────────────────────────────────────────────────
function activeServer() { const r = bpJson(['use']); return r.json?.active?.name || null; }
function tier() { const r = bpJson(['whoami']); return r.json?.auth_tier || 'none'; }
function ensureLedger() {
  const was = activeServer();
  run('bp', ['use', LEDGER_NAME]);
  if (tier() !== 'none') return was;
  console.log(`bp's ${LEDGER_NAME} token has no tier; re-minting it from the cloud session…`);
  const listing = run('bp', ['setup', '--target', 'cloud', '--name', LEDGER_NAME]).out; // interactive picker: prints the list, reads stdin (empty here)
  const line = listing.split('\n').find((l) => l.includes(LEDGER_URL));
  const num = line && /^\s*(\d+)\)/.exec(line)?.[1];
  if (!num) die(`Could not find ${LEDGER_URL} in bp's Barkpark listing. Are you logged in to Barkpark Cloud? Run: bp login   (then re-run this script)\n\n${listing.slice(0, 800)}`);
  const r = run('bp', ['setup', '--target', 'cloud', '--name', LEDGER_NAME, '--yes', '-o', 'json'], `${num}\n`);
  if (tier() === 'none') die(`Re-minting the ${LEDGER_NAME} token did not yield a tier. bp said:\n${r.out.slice(-600)}\n\nThis needs the user: bp login, then re-run.`);
  console.log(`connected to ${LEDGER_URL} as ${tier()}`);
  return was;
}
function restore(was) { if (was && was !== LEDGER_NAME) run('bp', ['use', was]); }

// ── task ───────────────────────────────────────────────────────────────────
function parseTags(spec) {
  if (!spec) return [];
  return String(spec).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [tag, strength, ...rest] = s.split(':');
    return { tag, strength: Number(strength || 50), rationale: rest.join(':').replace(/^"|"$/g, '') || `fits ${tag}` };
  });
}
function checkTags(tags) {
  const missing = tags.filter((t) => !bpJson(['doc', 'get', 'tag', t.tag]).ok);
  if (missing.length) {
    const have = bpJson(['doc', 'ls', 'tag']);
    const names = (have.json?.documents || have.json?.result?.documents || []).map((d) => d._id).join(' ');
    die(`Unregistered tag(s) on ${LEDGER_NAME}: ${missing.map((t) => t.tag).join(', ')}. The publish wall needs registered tags. Registered: ${names || '(could not list)'}`);
  }
  const strengths = tags.map((t) => t.strength);
  if (new Set(strengths).size !== strengths.length) die('Tag strengths must all be distinct (label spine rule).');
}
function createTask() {
  if (!opt['task-title'] || !opt['task-description']) die('--task-title and --task-description are required (the label spine refuses a trivial description).');
  const tags = parseTags(opt.tags);
  if (!tags.length) die('--tags is required: at least one registered tag as name:strength:"rationale" (strengths distinct).');
  checkTags(tags);
  if (!opt.criterion.length) die('At least one --criterion is required; the claim refuses a task with no acceptance criteria. Mark the merge one "MERGE-GATED: …" so CI may flip it.');
  const criteria = opt.criterion.map((c) => ({ criterion: c, met: false, evidence: '', ...(/MERGE-GATED|MERGE GATE|merged to main/i.test(c) ? { merge_gate: true } : {}) }));
  const r = bpJson(['task', 'create', opt['task-title'], '--description', opt['task-description'], '--set', `tags:=${JSON.stringify(tags)}`, '--set', `acceptance_criteria:=${JSON.stringify(criteria)}`, '--publish', '--yes']);
  const id = /task-[0-9a-f]{8,}/.exec(r.out)?.[0];
  if (!id) die(`Task creation failed:\n${r.out.slice(-800)}`);
  if (!r.ok || /publish failed/.test(r.out)) {
    // Created as a draft but not published: publish it now, then continue.
    const p = bpJson(['doc', 'publish', 'task', id, '--yes']);
    if (!p.ok) die(`Task ${id} exists as a draft but will not publish:\n${p.out.slice(-800)}`);
  }
  console.log(`task ${id} published on ${LEDGER_NAME}`);
  return id;
}
function claimTask(id) {
  const worker = opt.worker || 'claude-code-barkdown';
  const r = bpJson(['task', 'claim', id, worker, '--yes']);
  if (!r.ok) die(`Claim of ${id} by ${worker} refused:\n${r.out.slice(-900)}`);
  console.log(`claimed ${id} as ${worker} (in_progress)`);
}

// ── PR ─────────────────────────────────────────────────────────────────────
function withTaskLine(body, id) {
  const stripped = body.replace(/^Task: .*$/gm, '').replace(/\s+$/, '');
  return `${stripped}\n\nTask: ${id}\n`;
}
function patchBody(pr, body) {
  const f = path.join(os.tmpdir(), `bp-pr-${pr}.md`);
  fs.writeFileSync(f, body);
  const r = run('gh', ['api', '-X', 'PATCH', `repos/${REPO}/pulls/${pr}`, '-F', `body=@${f}`]);
  if (!r.ok) die(`PATCH of the PR body failed:\n${r.out.slice(-600)}`);
}
function createPr(id) {
  const body = withTaskLine(fs.readFileSync(opt['body-file'], 'utf8'), id);
  const f = path.join(os.tmpdir(), 'bp-pr-new.md');
  fs.writeFileSync(f, body);
  const r = run('gh', ['pr', 'create', '--repo', REPO, '--base', 'main', '--head', opt.head, '--title', opt.title, '--body-file', f]);
  if (!r.ok) die(`gh pr create failed:\n${r.out.slice(-600)}`);
  const url = r.out.trim().split('\n').pop();
  console.log(`PR: ${url}`);
  return url.split('/').pop();
}
function attachToPr(pr, id) {
  const body = execFileSync('gh', ['api', `repos/${REPO}/pulls/${pr}`, '--jq', '.body'], { encoding: 'utf8' });
  patchBody(pr, withTaskLine(body, id));
  console.log(`Task: ${id} set on PR #${pr}`);
}
function status(pr) {
  // `gh pr checks` exits 1 whenever ANY check is red — the non-required security gates are —
  // so read its stdout regardless of the exit code.
  const raw = (spawnSync('gh', ['pr', 'checks', String(pr), '--repo', REPO], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).stdout || '').split('\n');
  const byName = Object.fromEntries(raw.map((l) => l.split('\t')).filter((p) => p.length > 1).map((p) => [p[0], p[1]]));
  const state = execFileSync('gh', ['pr', 'view', String(pr), '--repo', REPO, '--json', 'mergeStateStatus', '--jq', '.mergeStateStatus'], { encoding: 'utf8' }).trim();
  console.log(`PR #${pr} — mergeStateStatus: ${state}\nRequired by branch protection:`);
  for (const name of REQUIRED) console.log(`  ${(byName[name] || 'not reported yet').padEnd(8)} ${name}`);
  const others = Object.entries(byName).filter(([n, s]) => !REQUIRED.includes(n) && s === 'fail').map(([n]) => n);
  if (others.length) console.log(`Red but NOT required (check whether they are red on main too): ${others.join('; ')}`);
}

// ── main ───────────────────────────────────────────────────────────────────
if (mode === 'status') { status(opt.pr || die('--pr is required')); process.exit(0); }
if (mode !== 'create') die('Usage: barkpark-pr.mjs create … | status --pr <n>   (see the header comment)');
const was = ensureLedger();
try {
  const id = createTask();
  claimTask(id);
  const pr = opt.pr || (opt.title && opt['body-file'] && opt.head ? createPr(id) : die('Either --pr <n> (attach to an existing PR) or --title, --body-file and --head (open one).'));
  if (opt.pr) attachToPr(pr, id);
  console.log('\nThe task gate re-runs on the body edit. Check with:\n  node .claude/skills/plan-followup/scripts/barkpark-pr.mjs status --pr ' + pr);
} finally { restore(was); }
