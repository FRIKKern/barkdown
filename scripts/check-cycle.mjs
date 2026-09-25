import assert from 'node:assert/strict';
import { loadCycle, validateCycle } from './cycle.mjs';
const cycle = loadCycle();
assert.throws(() => validateCycle({...cycle, delivery: undefined}), /delivery phase/);
assert.throws(() => validateCycle({...cycle, delivery: {...cycle.delivery, owner: ''}}), /delivery owner/);
assert.throws(() => validateCycle({...cycle, delivery: {...cycle.delivery, phase: 'validating', remaining: []}}), /without remaining work/);
assert.throws(() => validateCycle({...cycle, delivery: {...cycle.delivery, phase: 'delivered', remaining: ['Unmerged']}}), /with remaining work/);
validateCycle({...cycle, delivery: {...cycle.delivery, phase: 'delivered', remaining: []}});
const fixture = {...cycle,status:'done',evidence:[],truthReview:'',screenshotReview:''};
assert.throws(() => validateCycle(fixture), /without evidence and reviews/);
assert.throws(() => validateCycle({...cycle,status:'blocked',reason:''}), /without reason/);
assert.throws(() => validateCycle({...cycle,handoff:'../outside.md'}), /outside-repo/);
assert.throws(() => validateCycle({...cycle,stage:'unknown'}), /unknown parent/);
validateCycle({...fixture,evidence:[cycle.handoff],truthReview:'Reviewed fixture',screenshotReview:'No app changes in fixture'});
console.log('Cycle structure, handoff paths and completion requirements passed; evidence contents require review.');

// Exercise failures that previously let stale instructions or local-only proof ship.
const { checkAgentGuidance, validateAgentGuidance } = await import('./agent-guidance.mjs');
const guidance = checkAgentGuidance(cycle);
assert.throws(() => validateAgentGuidance({ ...guidance, texts: { ...guidance.texts, 'CLAUDE.md': '# Independent rules' } }), /thin import/);
assert.throws(() => validateAgentGuidance({ ...guidance, texts: { ...guidance.texts, 'docs/NEXT-AGENT.md': '[Old cycle](cycles/old.md)' } }), /current cycle handoff/);
assert.throws(() => validateAgentGuidance({ ...guidance, texts: { ...guidance.texts, '.claude/skills/plan-followup/SKILL.md': '# Start an old stage' } }), /planning skill/);
assert.throws(() => validateAgentGuidance({ ...guidance, texts: { ...guidance.texts, 'AGENTS.md': '# Missing routes' } }), /AGENTS.md is missing/);
const complete = { ...cycle, status: 'done', evidence: ['docs/local-only-proof.log'] };
assert.throws(() => validateAgentGuidance({ ...guidance, cycle: complete, tracked: new Set([cycle.handoff]) }), /not tracked/);
validateAgentGuidance({ ...guidance, cycle: complete, tracked: new Set([cycle.handoff, 'docs/local-only-proof.log']) });
console.log('Agent entry routing, current handoff and tracked completion evidence checks passed; semantic review remains required.');

// The advisory timing report must not turn missing or unfinished jobs into cheap successes.
await import('./ci-effort.test.mjs');

await import('./ci-review-bundle.test.mjs');

await import('./run-steps.test.mjs');
