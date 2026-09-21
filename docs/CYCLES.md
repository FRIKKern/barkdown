# Delivery cycles

A cycle is a bounded outcome with proof and a restartable handoff. It is driven by work, not a calendar. The current record is [cycle.json](cycle.json); `npm run cycle` prints it, and `npm run plan` includes it. The larger roadmap remains [PLAN.md](PLAN.md). Completing a cycle does not complete its parent stage.

## Plan before coding

Keep one current cycle. Give it a stable ID, stage, goal, scope exclusions, acceptance checks and a handoff file under `docs/cycles/`. Identify the tested starting commit, relevant data boundaries and prerequisites. Break a stage into reviewable outcomes; do not promise the whole stage in one cycle. Future slices remain provisional until current evidence informs them.

## Keep a checkpoint while working

Update the cycle handoff after a meaningful implementation slice, a failed check, a scope change, a blocker, and before yielding or changing tasks. Record what changed, exact commands/results, uncommitted work, owned running processes and the next concrete action. Save the checkpoint before long or risky operations. A handoff must work without chat history; do not wait for completion to write it. Sudden interruption can still happen between checkpoints—inspect Git and process ownership when resuming.

## Close with a repository truth pass

1. Verify the cycle's acceptance with appropriate tests. Root `npm run verify` is always required; real storage/runtime claims need real integration evidence. Record failures, skipped checks and prerequisites explicitly.
2. Review README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION and relevant architecture/decisions. Update changed claims; otherwise record what was reviewed and why it remains accurate. Distinguish planned, implemented, tested, pushed and merged. Recheck external gates before asserting their current state.
3. Review screenshot coverage against changed behavior. For app-source changes: commit implementation, run `npm --prefix app run shots`, inspect captures, then commit evidence. Add coverage for new visible journeys; six unchanged old views cannot prove a new feature. For documentation-only work, record why existing captures still apply. Never restamp screenshots or present simulated provider behavior as live.
4. Record source commits, evidence paths and limitations in the handoff and validation ledger. Commit and push on the authorized branch; report push failures honestly. Check the final diff and generated outputs. Do not deploy or merge merely to close a cycle.
5. Set the cycle to `done` only with evidence, screenshot review and truth review. Leave the next exact action in the handoff. Archive the completed JSON beside its handoff before replacing `cycle.json` with the next planned cycle; retain old evidence. Update NEXT-AGENT to point to the new cycle.

## Interrupted or blocked work

Keep the cycle `active` when unfinished, or `blocked` with the concrete dependency and safe work that can proceed. Never mark it done to make the queue clean. At the end of every work session, checkpoint tested and untested changes and the recovery/next command. Do not kill shared services or commit secrets to make a handoff look clean.

## Record fields and checks

`cycle.json` requires an ID, stage, status (`planned`, `active`, `blocked`, `done`), goal, scope, acceptance, checkpoint timestamp, handoff, next action, evidence and review notes. `npm run check:cycle` validates these records and local evidence paths; it cannot determine whether prose is truthful or tests really passed. Root verification enforces the structure. Human/agent inspection supplies the evidence.
