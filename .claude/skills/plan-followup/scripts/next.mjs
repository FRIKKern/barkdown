import { printCycle } from '../../../../scripts/cycle.mjs';
// Read-only active roadmap. --live adds tracker snapshots; it never changes the queue.
import { execFileSync } from 'node:child_process';
import { loadPlan, nextStage } from '../../../../scripts/plan.mjs';
const plan = loadPlan(), next = nextStage(plan);
console.log(plan.goal + '\n');
printCycle();

console.log('Delivery stages (docs/plan.json):');
for (const stage of plan.stages) {
  const pending = stage.dependsOn.filter(id => plan.stages.find(s => s.id === id).status !== 'done');
  console.log(`  ${stage.id} [${stage.status}] ${stage.title}${pending.length ? ' — waits for ' + pending.join(', ') : ''}`);
}
console.log(next ? `\nNext: ${next.id} — ${next.title}. Read ${next.acceptance} in docs/ACCEPTANCE.md.` : '\nNo ready stage. Inspect dependency/status evidence; do not skip a blocked dependency.');
console.log('\nIntegration gates (separate from the implementation queue):');
for (const gate of plan.gates) console.log(`  ${gate.id} [${gate.status}] ${gate.title}${gate.reason ? ' — ' + gate.reason : ''}`);
console.log('\nLocal records are acceptance state, not a live GitHub claim. Use --live to inspect tracker state.');
if (process.argv.includes('--live')) {
  const query = args => { try { return execFileSync('gh', args, { encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:15000 }).trim(); } catch { return 'Unavailable — no status was inferred.'; } };
  console.log('\nExisting issues: ' + query(['issue','list','--repo','FRIKKern/barkdown','--state','open','--json','number,title,state']));
  console.log('Upstream editor PR: ' + query(['pr','view','19579','--repo','FRIKKern/barkpark','--json','state,mergedAt,url']));
}
