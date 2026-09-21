import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function validatePlan(plan) {
  const fail = message => { throw new Error('Plan: ' + message); };
  if (plan.version !== 1 || !plan.goal || !Array.isArray(plan.stages) || !plan.stages.length || !Array.isArray(plan.gates)) fail('invalid queue structure');
  const all = [...plan.stages, ...plan.gates], ids = new Set();
  for (const item of all) {
    if (!item.id || ids.has(item.id)) fail('missing or duplicate ID');
    ids.add(item.id);
    if (!item.title || !['todo', 'active', 'blocked', 'done'].includes(item.status)) fail(item.id + ' has invalid title/status');
    if (!Array.isArray(item.evidence) || item.evidence.some(e => typeof e !== 'string' || !e.trim())) fail(item.id + ' has invalid evidence');
    if (item.status === 'done' && !item.evidence.length) fail(item.id + ' is done without evidence');
    if (item.status === 'blocked' && !item.reason) fail(item.id + ' is blocked without a reason');
  }
  const stages = new Map(plan.stages.map(s => [s.id, s]));
  for (const stage of plan.stages) {
    if (!Array.isArray(stage.dependsOn) || !Array.isArray(stage.issues) || !/^A\d+$/.test(stage.acceptance)) fail(stage.id + ' has invalid dependencies/issues/acceptance');
    if (stage.issues.some(n => !Number.isInteger(n) || n < 1)) fail(stage.id + ' has invalid issue number');
    for (const id of stage.dependsOn) if (!stages.has(id)) fail(stage.id + ' depends on unknown stage ' + id);
    if (['active', 'done'].includes(stage.status) && stage.dependsOn.some(id => stages.get(id).status !== 'done')) fail(stage.id + ' started before its dependencies passed');
  }
  const visited = new Set(), visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('dependency cycle at ' + id);
    if (visited.has(id)) return;
    visiting.add(id); stages.get(id).dependsOn.forEach(visit); visiting.delete(id); visited.add(id);
  }
  plan.stages.forEach(s => visit(s.id));
  return plan;
}
export function loadPlan() { return validatePlan(JSON.parse(fs.readFileSync(path.join(root, 'docs/plan.json'), 'utf8'))); }
export function nextStage(plan) {
  validatePlan(plan);
  const ready = s => ['todo', 'active'].includes(s.status) && s.dependsOn.every(id => plan.stages.find(d => d.id === id).status === 'done');
  return plan.stages.find(s => s.status === 'active' && ready(s)) || plan.stages.find(ready) || null;
}
