import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadPlan, nextStage, validatePlan, root } from './plan.mjs';
const plan = loadPlan();
const acceptance = fs.readFileSync(path.join(root, 'docs/ACCEPTANCE.md'), 'utf8');
const roadmap = fs.readFileSync(path.join(root, 'docs/PLAN.md'), 'utf8');
for (const stage of plan.stages) {
  assert.ok(acceptance.includes('## ' + stage.acceptance + ' —'), `Missing acceptance for ${stage.id}`);
  assert.ok(roadmap.includes('| ' + stage.id + ' |'), `Missing roadmap stage ${stage.id}`);
}
for (const gate of plan.gates) assert.ok(roadmap.includes(gate.id + ':'), `Missing roadmap gate ${gate.id}`);
for (const item of [...plan.stages, ...plan.gates]) for (const evidence of item.evidence) {
  if (/^https:\/\//.test(evidence)) continue;
  const file = path.resolve(root, evidence.split('#')[0]);
  assert.ok(file.startsWith(root + path.sep) && fs.existsSync(file), `Missing or outside-repo evidence: ${evidence}`);
}
// Selection must honor dependencies, preserve blocked gates, and not infer success from issue closure.
const fixture = {version:1,goal:'test',stages:[
  {id:'X',title:'first',status:'todo',dependsOn:[],issues:[],acceptance:'A1',evidence:[]},
  {id:'Y',title:'second',status:'todo',dependsOn:['X'],issues:[],acceptance:'A2',evidence:[]}
],gates:[{id:'G',title:'gate',status:'blocked',reason:'external',evidence:[]}]};
assert.equal(nextStage(fixture).id, 'X');
fixture.stages[0].status='blocked'; fixture.stages[0].reason='waiting'; assert.equal(nextStage(fixture), null);
fixture.stages[0].status='done'; assert.throws(() => validatePlan(fixture), /without evidence/);
fixture.stages[0].evidence=['proof']; assert.equal(nextStage(fixture).id,'Y');
fixture.stages[0].status='todo'; fixture.stages[0].dependsOn=['Y']; assert.throws(() => validatePlan(fixture), /cycle/);
console.log('Active roadmap: structure, dependencies, acceptance links, evidence and next-stage selection passed.');

// Standalone check refuses a stale roadmap without rewriting it.
const roadmapRoot = (await import('node:path')).resolve((await import('node:url')).fileURLToPath(new URL('..', import.meta.url)));
(await import('node:child_process')).execFileSync(process.execPath, [roadmapRoot + '/scripts/generate-roadmap.mjs', roadmapRoot, roadmapRoot + '/docs/images/roadmap.svg', '--check'], {stdio:'inherit'});
