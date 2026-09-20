// Prints the plan's open issues in sequence order, then checks the working environment.
// Usage: node .claude/skills/plan-followup/scripts/next.mjs   (from the barkdown repo root)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '../../../..');
const sh = (cmd, args, opts = {}) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim(); } catch (e) { return null; } };

// The sequence is the order of issue links in docs/PLAN.md's table.
const plan = fs.readFileSync(path.join(root, 'docs/PLAN.md'), 'utf8');
const sequence = [];
for (const line of plan.split('\n')) {
  const m = /^\|\s*(\d+)\s*\|(.*?)\|/.exec(line);
  if (!m) continue;
  const nums = [...m[2].matchAll(/#(\d+)/g)].map(x => Number(x[1]));
  if (nums.length) sequence.push({ step: Number(m[1]), issues: nums });
}

const raw = sh('gh', ['issue', 'list', '--repo', 'FRIKKern/barkdown', '--state', 'all', '--limit', '100', '--json', 'number,title,state,milestone']);
const issues = raw ? Object.fromEntries(JSON.parse(raw).map(i => [i.number, i])) : {};

console.log('Plan sequence (docs/PLAN.md):');
let next = null;
for (const { step, issues: nums } of sequence) {
  const parts = nums.map(n => { const i = issues[n]; if (!i) return `#${n} (?)`; const open = i.state === 'OPEN'; if (open && !next) next = n; return `${open ? 'open  ' : 'closed'} #${n} ${i.title}${i.milestone ? '  [' + i.milestone.title.split(' ')[0] + ']' : ''}`; });
  console.log(`  ${String(step).padStart(2)}. ${parts.join('\n      ')}`);
}
console.log(next ? `\nNext: #${next} — ${issues[next].title}` : '\nNext: nothing open in the sequence.');

console.log('\nEnvironment:');
const status = sh('curl', ['-s', '-m', '4', 'http://localhost:4000/status.json']);
console.log(`  local Barkpark :4000   ${status && status.includes('"status"') ? 'up' : 'DOWN — start it (SKILL.md §4)'}`);
const use = sh('bp', ['use', '-o', 'json']);
let active = null; try { active = JSON.parse(use).active; } catch {}
console.log(`  bp active server        ${active ? `${active.name} (${active.server})` : 'unknown'}${active && active.name !== 'local' ? '  — run: bp use local' : ''}`);
for (const [label, dir] of [['barkdown', root], ['barkpark-editor', path.resolve(root, '../barkpark-editor')]]) {
  const st = sh('git', ['-C', dir, 'status', '-sb']);
  if (st == null) { console.log(`  ${label.padEnd(23)} not found at ${dir}`); continue; }
  const [head, ...rest] = st.split('\n');
  const dirty = rest.filter(Boolean).length;
  console.log(`  ${label.padEnd(23)} ${head.replace(/^## /, '')}${dirty ? `  — ${dirty} uncommitted change(s)` : ''}`);
}
const acct = sh('gh', ['api', 'user', '--jq', '.login']);
console.log(`  gh account              ${acct || 'unknown'}${acct && acct !== 'FRIKKern' ? '  — run: gh auth switch --user FRIKKern' : ''}`);
