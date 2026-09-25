# Delivery cycles

A cycle is a bounded outcome with proof and a restartable handoff. It is driven by work, not a calendar. The current record is [cycle.json](cycle.json); `npm run cycle` prints it, and `npm run plan` includes it. The larger roadmap remains [PLAN.md](PLAN.md). Completing a cycle does not complete its parent stage.

## Plan before coding

Keep one current cycle. A cycle is an acceptance boundary, not every message or commit: keep related slices together while that outcome remains open. Do not create a new process cycle solely to restate an existing rule. Give it a stable ID, stage, goal, scope exclusions, acceptance checks and a handoff file under `docs/cycles/`. Identify the tested starting commit, relevant data boundaries and prerequisites. Break a stage into reviewable outcomes; do not promise the whole stage in one cycle. Future slices remain provisional until current evidence informs them.

## Spend effort on the outcome

Before starting, put a short delivery budget in the cycle handoff: the user journey or concrete maintenance result, what is excluded, the stopping condition, an estimated time ceiling (not a promise), relevant targeted checks, and the final validation/capture checkpoint. A time ceiling is not a reason to fill the time with extra work; an explicit user minimum still takes precedence. On unexpected scope or repeated failure, checkpoint the cause and choose the smallest useful next action before expanding the run.

Use targeted checks during development and the required full gates at stable milestones. Repeat a passing check only for a relevant change, failure or unresolved concern. Reuse installed locked dependencies when unchanged and healthy; run `npm ci` for setup, dependency changes or repair. Batch code-area documentation before the implementation commit and captures. Push coherent checkpoints rather than restarting expensive CI for each wording change. Do not weaken a gate to save tokens. Documentation-only checks do not establish new application acceptance.

Delegate only when authorized and when independent deliverables justify coordination cost. Read the current handoff and relevant files first; search old records for a specific question. For evidence, extract status, source, duration and failed steps from result files first; open only the relevant log sections. Do not dump full manifests, serialized working-tree status or repeated histories into context. Retain raw evidence unchanged. Avoid repeated unchanged status polling.

At closeout, record outcomes delivered, checks and captures run, significant retries and their cause, elapsed time, and token usage if the tool supplies a trustworthy value. Label estimates and unavailable measurements. Separate active work, waiting and tool runtime only when measured; do not invent a breakdown. A tracker total may include replayed context and is not automatically billable tokens or a price. When available, record implementation-ready and merge-ready timestamps for the same outcome; pending integration is not zero elapsed time. Record one concrete efficiency lesson when there was avoidable rework. Update its existing instruction owner in the same checkpoint, then assess recurrence during the next relevant cycle; do not create a separate metrics backlog or claim savings before measurement.

## Preflight and integration first

Before expensive work, confirm the selected checkout/commit, required executable paths and versions, dependency health, platform assumptions and owned test-data destination. Reuse a working invocation from applicable evidence and verify it with a short probe. On Windows, check the selected Elixir/Erlang pair and Python/Git Bash invocation; do not assume a command name resolves to the required version. Identify POSIX-only tests before launching a broad suite. Run applicable local checks and leave the required Linux gate explicit; an incompatible local run cannot be counted as a pass or used to waive CI.

For shell gates, probe Python encoding and native-tool line endings before a long run. Once equivalent Linux CI passes on the relevant source, avoid continuing a slow local duplicate; preserve its interruption as such. Before the first upstream push, verify the PR base and that its task is published and readable by the gate. A drafted task with a valid identifier is not necessarily visible to CI.

The Windows source launcher copies prebuilt Barkpark artifacts; it does not compile the selected checkout. After changing server code, rebuild that owned checkout before live proof and assert the changed capability against the private server. A clean Git commit alone does not establish build freshness. Retain the runtime build fingerprint with the evidence.

When a contract changes, run its cheap consumer consistency checks alongside the owner tests: a new server mutation affects CLI help/shape rosters, OpenAPI, public error codes and CLI exit mappings as well as HTTP behavior. Include discovered consumers in the handoff's fast checks before the first ready-checkpoint push. Use the formatter version pinned by CI and scope it against the actual integration base, including older stacked changes. Check documentation byte limits after additions.

Before adding more work on an unmerged dependency, inspect its current head and failing gates. Distinguish this slice's regressions from unchanged stacked-branch failures; being outside the diff does not establish a passing main baseline. Fix owned regressions promptly. Give remaining blockers an existing task/owner and next action, and choose integration work first when it controls delivery. Independent work may continue with an explicit reason and boundary; do not grow a dependent stack merely because local tests pass. Merge and deployment still require authorization.

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

## Make CI wait useful and measurable

After pushing a stable checkpoint, record its SHA and the blocking run IDs. While remote CI evaluates that immutable snapshot, do useful independent work within the authorized scope: review the diff and evidence, investigate a separate failure, inspect the next adapter contract, or prepare the next bounded task. Do not invent busywork to fill a wait. Keep ownership clear; do not alter shared test fixtures or confuse later local changes with the source CI tested.

Before another push, check whether it would cancel an expensive run. Batch documentation/process-only updates until that run finishes when practical. A necessary correctness fix may justify superseding it; record the reason rather than calling the cancellation a test result. If nothing independent remains, leave an exact handoff instead of polling repeatedly or promising completion from a pending job. A time-limited run can end with CI still pending; merge/release remains gated.

When investigating repeated cancellation or slow CI, use the read-only timing audit:

```sh
node scripts/ci-effort.mjs --repo FRIKKern/barkdown --branch codex/paper-library --limit 12 --output /path/to/new-snapshot.json
node scripts/ci-effort.mjs --input /path/to/new-snapshot.json
```

Choose a new output path; existing snapshots are never overwritten. This uses GitHub CLI authentication and reads bounded run/job metadata, not full logs or secrets. It does not trigger, cancel or approve CI. Measure at a phase review or when investigating a cost, not continuously. Keep the summary in the existing cycle evidence/handoff.

Compare finished job minutes, cancelled job minutes, duplicate-event candidates and repeated setup steps. Also record which useful result was produced during the CI interval. These are distinct from agent idle time, critical-path delay and money; overlapping jobs do not add to elapsed delivery time. Missing/running timestamps are not zero-cost successes. A cheaper pipeline must still catch deliberate regressions before narrowing coverage. Prefer one measured improvement at a time; automatic proof reuse remains unimplemented. If small documentation/process pushes repeatedly restart full CI without advancing a user journey, consolidate the next change and return to product work after the bounded improvement. Avoid making process maintenance its own endless backlog.

## Execute checks without losing the failure

For a dependent sequence, use `node scripts/run-steps.mjs <plan.json> <new-output-directory>` from the checkout (or invoke that script by absolute path). Each `cwd` is relative to the runner's repository, regardless of the calling shell directory. All directories and arguments are checked before the first command; the runner stops on the first failure and retains each log, exit code and measured duration in `result.json`. Existing output directories are refused. Interrupted reports remain `running`, never passed. This is a convenience for trusted local Node/npm commands, not a sandbox or a replacement for required gates.

```json
{"version":1,"steps":[
  {"name":"focused","cwd":".","argv":["node","scripts/run-steps.test.mjs"]},
  {"name":"verify","cwd":".","argv":["npm","run","verify"]}
]}
```

Keep a reusable sequence in the current cycle evidence only when useful; do not invent a second queue of checks. `node` uses the running Node executable; `npm` resolves its CLI beside Node or through `npm_execpath`. Both run without a shell. Arguments are literal: no pipes, redirection or shell interpolation. Logs/arguments can contain data, so use disposable fixtures and no credentials. The runner does not retry, select coverage, approve media, stop shared services or prove that an assertion is meaningful. For individual shell commands, set the working directory explicitly and check the exit code before the dependent command; a PowerShell semicolon does not stop after a native-command failure.

Before an expensive native capture, identify the observable that could falsely pass. Scope a search assertion to the actual result and matching content, not an already-open tab with the same title. After an action, assert the resulting identity/content; do not use a helper that independently opens or repairs the expected state as proof the action succeeded. Persistence claims need readback/restart. Exercise the assertion during targeted development, then finalize the harness before the implementation commit. Verify media-tool capabilities with a short sample before a full conversion; retain originals and derivation details.

Use one source-bound review record linking behavior logs, native motion, standard comparisons and live Paper evidence. Inspect the gallery/contact sheets together; enlarge changed or uncertain frames and meaningful transitions. Record actual inspection and limits, without repeating the same review in every README. The [visual rules](visual/RULES.md) still govern required coverage and explicit approval. Push the coherent code/evidence checkpoint once; record subsequent hosted check results on the PR when no source claim needs changing, so a status-only commit does not restart the same expensive jobs.

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
