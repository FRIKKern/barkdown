# Delivery cycles

A cycle is a bounded outcome with proof and a restartable handoff. It is driven by work, not a calendar. The current record is [cycle.json](cycle.json); `npm run cycle` prints it, and `npm run plan` includes it. The larger roadmap remains [PLAN.md](PLAN.md). Completing a cycle does not complete its parent stage.

## Plan before coding

Keep one current cycle. Give it a stable ID, stage, goal, scope exclusions, acceptance checks and a handoff file under `docs/cycles/`. Identify the tested starting commit, relevant data boundaries and prerequisites. Break a stage into reviewable outcomes; do not promise the whole stage in one cycle. Future slices remain provisional until current evidence informs them.

## Spend effort on the outcome

Before starting, put a short delivery budget in the cycle handoff: the user journey or concrete maintenance result, what is excluded, the stopping condition, an estimated time ceiling (not a promise), relevant targeted checks, and the final validation/capture checkpoint. A time ceiling is not a reason to fill the time with extra work; an explicit user minimum still takes precedence. On unexpected scope or repeated failure, checkpoint the cause and choose the smallest useful next action before expanding the run.

Use targeted checks during development and the required full gates at stable milestones. Repeat a passing check only for a relevant change, failure or unresolved concern. Reuse installed locked dependencies when unchanged and healthy; run `npm ci` for setup, dependency changes or repair. Batch code-area documentation before the implementation commit and captures. Push coherent checkpoints rather than restarting expensive CI for each wording change. Do not weaken a gate to save tokens. Documentation-only checks do not establish new application acceptance.

Delegate only when authorized and when independent deliverables justify coordination cost. Read the current handoff and relevant files first; search old records for a specific question. Keep tool output focused on failures, decisions and evidence locations. Avoid repeated unchanged status polling.

At closeout, record outcomes delivered, checks and captures run, significant retries and their cause, elapsed time, and token usage if the tool supplies a trustworthy value. Label estimates and unavailable measurements. Separate active work, waiting and tool runtime only when measured; do not invent a breakdown. A tracker total may include replayed context and is not automatically billable tokens or a price. Record one concrete efficiency lesson when there was avoidable rework; do not create a separate metrics backlog.

## Plan the tripwires before editing

Record three short lines in the existing handoff, not a new report:

- **Affected boundaries:** what can change for the user or their data, and which proof it invalidates.
- **During work:** targeted checks that catch mistakes quickly; include relevant failure/ownership cases.
- **Ready checkpoint:** required suites, code-area README updates, capture/review and expected final source. Name what would require a rerun.

| Phase | What triggers work | Validation strategy |
|---|---|---|
| Develop | Change a behavior or contract | Run affected tests as the implementation settles. Investigate failures before expanding scope. |
| Ready for review | Complete the bounded outcome | Finish related code and README edits; commit implementation, capture/compare/inspect/approve when required, then commit evidence. Run root verification and the applicable full suites. |
| Waiting for merge | New code, dependencies, harness, environment or base changes | Reassess which proof is invalidated. Time alone is not a reason to repeat local tests. Follow existing CI gates; automated reuse is not implemented. |
| Integrate | Base drift or conflict resolution changes the combined result | Check the proposed integrated source and rerun affected proof; an old branch pass does not prove the merged tree. |

Documentation outside current visual inputs needs link, claim and generation checks, not new app captures. Appearance/interaction changes need visual and behavior proof. Storage, identity, permissions, revisions and runtime changes need relevant real integration/recovery checks even if screens look identical. Editor/content-format changes need canvas/server parity. Dependencies, upstream pins, harness and environment changes invalidate the proof that depends on them. Unknown impact takes the conservative path until understood.

Convenience means grouping related work and choosing checkpoints well. It never means moving files outside watched paths, hiding changes, relabeling old evidence, approving unread images, deleting failures, skipping assertions or using a cancelled run as a pass. Preserve a failing result and its fix; do not repeatedly rerun a flaky test until it happens to pass. No finite suite guarantees 100% quality: acceptance claims remain limited to the demonstrated scenarios.

Verify CI runs on PR updates and main pushes, with manual dispatch for branches without a PR. It retains the same `concept` job and full `npm run verify`; obsolete runs on the same ref are cancelled, not counted as proof. Create/update the existing draft PR at a reviewable checkpoint instead of pushing each sentence. Visual/parity CI remains conservative and may rerun on later pushes to an app-changing PR. Narrower triggers or cross-commit proof reuse require a separately tested implementation; never simulate them with a skip flag.

## Keep a checkpoint while working

Update the cycle handoff after a meaningful implementation slice, a failed check, a scope change, a blocker, and before yielding or changing tasks. Record what changed, exact commands/results, uncommitted work, owned running processes and the next concrete action. Save the checkpoint before long or risky operations. The current handoff should fit roughly one screen: current outcome/status, branch and source, strongest evidence and limits, uncommitted work/owned services, and exact next action. Detailed chronology belongs in the linked cycle record. A handoff must work without chat history; do not wait for completion to write it. Sudden interruption can still happen between checkpoints—inspect Git and process ownership when resuming.

## Close with a repository truth pass

1. Verify the cycle's acceptance with appropriate tests. Root `npm run verify` is always required; real storage/runtime claims need real integration evidence. Record failures, skipped checks and prerequisites explicitly.
2. Review README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION and relevant architecture/decisions. Update changed claims; otherwise record what was reviewed and why it remains accurate. Distinguish planned, implemented, tested, pushed and merged. Recheck external gates before asserting their current state.
3. Review screenshot coverage against changed behavior. For app-source changes: commit implementation, run `npm --prefix app run shots`, inspect captures, then commit evidence. Add coverage for new visible journeys; six unchanged old views cannot prove a new feature. For documentation-only work, record why existing captures still apply. Never restamp screenshots or present simulated provider behavior as live.
4. Record source commits, evidence paths and limitations in the handoff and validation ledger. Commit and push on the authorized branch; report push failures honestly. Check the final diff and generated outputs. Do not deploy or merge merely to close a cycle.
5. Set the cycle to `done` only with evidence, screenshot review and truth review. Leave the next exact action in the handoff. Archive the completed JSON beside its handoff before replacing `cycle.json` with the next planned cycle; retain old evidence. Update NEXT-AGENT to point to the new cycle.
6. Reconcile branches, worktrees and related tasks. Target `main` plus at most three active delivery branches, each with a current goal and next action. Record exceptions with an owner and next review. Verify remote tips and open PRs before retirement; preserve unique source, dirty files and evidence. Close or archive completed tasks only after retaining their handoff. Replace obsolete instructions in active documents rather than appending another checkpoint. Check both repositories when a cycle crosses Barkdown and Barkpark.

## Keep one source for each claim

| Question | Authority | Other pages should do |
|---|---|---|
| What is next? | PLAN/plan.json and current cycle | Link it; avoid separate task lists in READMEs or comments. |
| What is implemented? | Actual source and API contracts | Describe the supported scope, not the desired design. |
| What passed? | VALIDATION and immutable cycle/run evidence | Name source, environment, result and limits; never equate local pass with merged/released. |
| What should I see? | Area README and its reviewed capture | Show actual UI, with provenance and behavior-test links. |
| How do I resume? | NEXT-AGENT and the current cycle handoff | Replace stale instructions; link older failures rather than replay their history. |

README and app-guide claims must distinguish current behavior, verified scope and future work. Date external observations and link the exact CI run or source. CI can validate links, hashes and freshness; reviewers must judge meaning and whether the scenario supports the claim. A screenshot is not save/recovery proof. A green suite is not proof of an untested journey.

At closure, check task references in active docs, relevant source comments and any Barkpark planning notes explicitly in scope. Every outstanding task needs a current owner/next action or an archive pointer. Never search or delete a person's unrelated notes for tidiness. Retire stale instructions while preserving historical evidence. Record unresolved worktree/branch clutter with an owner and next review; do not delete unique or locked work simply to meet a count.

## Interrupted or blocked work

Keep the cycle `active` when unfinished, or `blocked` with the concrete dependency and safe work that can proceed. Never mark it done to make the queue clean. At the end of every work session, checkpoint tested and untested changes and the recovery/next command. Do not kill shared services or commit secrets to make a handoff look clean.

## Record fields and checks

`cycle.json` requires an ID, stage, status (`planned`, `active`, `blocked`, `done`), goal, scope, acceptance, checkpoint timestamp, handoff, next action, evidence and review notes. `npm run check:cycle` validates these records and local evidence paths; it cannot determine whether prose is truthful or tests really passed. Root verification enforces the structure. Human/agent inspection supplies the evidence.

## Visual closeout

Follow [visual rules](visual/RULES.md). Any visual tripwire requires fresh candidate capture, comparison and actual image review before explicit approval. Area READMEs carry current stills/GIFs and changelogs; preserve earlier evidence. Add coverage for a new visible journey and pair visual inspection with relevant behavior checks. Unreviewed differences keep the cycle open.

## Compact handoff template

Use these fields in the existing cycle handoff; no extra report file is required:

- **Outcome / status:** what someone can now do, or the concrete blocker.
- **Source / delivery:** branch, tested source, pushed checkpoint, merge/release state.
- **Proof / limits:** commands, results, reviewed visual links, unsupported cases.
- **Cost / rework:** measured duration/tokens or unavailable; expensive retries and why.
- **Repository / services:** dirty files, owned processes, retained clutter and next review.
- **Next action:** one exact starting action and stopping condition.
