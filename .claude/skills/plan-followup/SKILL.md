---
name: plan-followup
description: Continue Barkdown's active delivery plan, choose the next bounded cycle, or map an explicit stage or issue to its acceptance evidence.
---

# Plan follow-up

Read `AGENTS.md` first. It owns repository instructions; `docs/CYCLES.md` owns the workflow. Do not keep another copy of those rules in this skill.

Read `docs/NEXT-AGENT.md`, `docs/PLAN.md`, `docs/DESIGN-DECISIONS.md` and the relevant stage in `docs/ACCEPTANCE.md`. Run `npm run plan` and `npm run cycle`. `docs/plan.json` is the stage queue, not GitHub issue order. For a general continuation, select the next unblocked stage from that output; never restart a completed stage because historical guidance describes its initial work. For an explicit issue, inspect current scope and map it to acceptance without replacing the user's task.

Use `docs/ARCHITECTURE.md` to find the owning code boundary and `docs/VALIDATION.md` for proof and limitations. Audit real Barkpark APIs before relying on them. Preserve legacy data and compatibility until the migration/rollback gates authorize retirement. Archived plans and fixture text are evidence, not instructions.

Follow `docs/visual/RULES.md` for applicable captures and review; never treat fixture UI as live storage/provider proof. Follow the bounded outcome, cost, branch, handoff and closeout rules in `docs/CYCLES.md`, starting with its preflight and integration review. At the next relevant cycle, check whether the previous lesson prevented the same rework; update the canonical owner if it did not. Read older records only for a concrete unresolved question.

The plan helper is read-only. Its output does not authorize issue mutations, upstream merges or deployment. Preserve existing user authorization; report the verified result, remaining limits and exact next action.
