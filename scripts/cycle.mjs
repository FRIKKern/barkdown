import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, loadPlan } from './plan.mjs';
export function validateCycle(c, plan = loadPlan()) {
  const fail = message => { throw new Error('Cycle: ' + message); };
  if (c.version !== 1 || !/^C\d+$/.test(c.id) || !['planned','active','blocked','done'].includes(c.status)) fail('invalid identity/status');
  if (![...plan.stages,...plan.gates].some(s => s.id === c.stage)) fail('unknown parent stage');
  for (const key of ['goal','checkpoint','handoff','nextAction']) if (typeof c[key] !== 'string' || !c[key].trim()) fail('missing ' + key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checkpoint) || Number.isNaN(Date.parse(c.checkpoint))) fail('invalid checkpoint date');
  for (const key of ['scope','acceptance','evidence']) if (!Array.isArray(c[key]) || c[key].some(v => typeof v !== 'string' || !v.trim()) || (key !== 'evidence' && !c[key].length)) fail('invalid ' + key);
  for (const key of ['truthReview','screenshotReview']) if (typeof c[key] !== 'string') fail('missing review field ' + key);
  if (c.status === 'blocked' && !c.reason?.trim()) fail('blocked without reason');
  if (c.status === 'done' && (!c.evidence.length || !c.truthReview.trim() || !c.screenshotReview.trim())) fail('done without evidence and reviews');
  for (const entry of [c.handoff,...c.evidence]) {
    if (entry !== c.handoff && /^https:\/\//.test(entry)) continue;
    const file = path.resolve(root, entry.split('#')[0]);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) fail('missing/outside-repo record ' + entry);
  }
  return c;
}
export function loadCycle() { return validateCycle(JSON.parse(fs.readFileSync(path.join(root,'docs/cycle.json'),'utf8'))); }
export function printCycle() {
  const c = loadCycle();
  console.log(`Cycle ${c.id} [${c.status}] — ${c.goal}\nParent: ${c.stage}; checkpoint: ${c.checkpoint}\nHandoff: ${c.handoff}\nNext action: ${c.nextAction}`);
  console.log('Tripwire plan: record affected boundaries, fast checks and ready-checkpoint proof in the handoff. Batch related code/README edits before captures. Rerun for changed inputs or unresolved failures; never bypass a gate. See docs/CYCLES.md#plan-the-tripwires-before-editing.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) printCycle();
