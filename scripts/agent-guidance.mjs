import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { root } from './plan.mjs';

// Structural routing and delivery guards, not semantic instruction compliance.
export function validateAgentGuidance({ texts, cycle, tracked }) {
  const fail = message => { throw new Error('Agent guidance: ' + message); };
  if (texts['CLAUDE.md']?.trim() !== '# Claude repository entry\n\n@AGENTS.md') {
    fail('CLAUDE.md must remain a thin import of AGENTS.md; keep shared rules canonical');
  }
  for (const target of ['docs/NEXT-AGENT.md', 'docs/PLAN.md', 'docs/DESIGN-DECISIONS.md', 'docs/ACCEPTANCE.md', 'docs/CYCLES.md', 'docs/visual/RULES.md']) {
    if (!texts['AGENTS.md']?.includes('`' + target + '`')) fail('AGENTS.md is missing its route to ' + target);
  }
  for (const target of ['AGENTS.md', 'docs/CYCLES.md', 'docs/plan.json']) {
    if (!texts['.claude/skills/plan-followup/SKILL.md']?.includes('`' + target + '`')) fail('planning skill is missing its route to ' + target);
  }
  const handoffTarget = cycle.handoff.replace(/^docs\//, '');
  if (!texts['docs/NEXT-AGENT.md']?.includes('](' + handoffTarget + ')')) {
    fail('NEXT-AGENT.md must link the current cycle handoff: ' + handoffTarget);
  }
  if (cycle.status === 'done') {
    for (const entry of [cycle.handoff, ...cycle.evidence]) {
      if (/^https:\/\//.test(entry)) continue;
      const file = entry.split('#')[0];
      if (!tracked.has(file)) fail('completed cycle evidence is not tracked; stage it before closeout: ' + file);
    }
  }
}

export function checkAgentGuidance(cycle) {
  const files = ['CLAUDE.md', 'AGENTS.md', '.claude/skills/plan-followup/SKILL.md', 'docs/NEXT-AGENT.md'];
  const texts = Object.fromEntries(files.map(file => [file, fs.readFileSync(root + '/' + file, 'utf8').replace(/\r\n/g, '\n')]));
  const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'));
  validateAgentGuidance({ texts, cycle, tracked });
  return { texts, cycle, tracked };
}
