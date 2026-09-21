# Goal integration checkpoint — C008

This worktree is the combined candidate on `codex/integration-12h`, not the goal agent's original branch. The historical audit below describes earlier snapshots and does not override this checkpoint. See [C008](../cycles/C008-integration.md) for exact imports and validation.

The opt-in `--profiles` desktop now exposes Conversation goals in the command palette. Three explicit assignments create saved worker side chats with parent links and shared controls. Main owns durable transcripts, provider context, deadline/dependency admission and review gating. Explicit Start/Resume captures pending workers' current choices; previous attempts retain their captured context. Native recursive delegation is disabled for goal workers.

Combined source4c88a49 passed the full desktop suite, including37 goal tests,76 shell checks, actual Electron goal creation/streaming, profile switching, selected-profile process restart and existing chat/editor regressions. Goal transports in these tests are deterministic; they do not prove three authenticated model workers. Newer E002/C009 imports have focused passing tests but still need fresh full combined verification and visual evidence.

Remaining: authenticated multi-worker journey, native process-tree crash recovery (owned by the goal agent and not yet imported), natural-language coordinator planning, complete failure/reconciliation UX, and fresh combined capture/review. No OS background service or execution while asleep is implemented. P1 and C005 remain unfinished. Do not replay uncertain attempts or substitute process-local cancellation for descendant termination proof.

## Historical goal-track handoff

# Durable goals and full worker conversations

Dedicated user-requested orchestration track, starting at `b8e7bfb` on `codex/goal-orchestration`. The central P1 queue remains owned by the profile agents. Run window ends 2026-09-22T10:11:17Z; unfinished work must remain explicit.

## Audit and first bounded slice

`state.js` owns renderer-written workspace snapshots and strips run IDs on save. `conversations.js` reads those snapshots without mutation. Side chats already have parent references and full shared controls. `providers/runs.js` holds process-local runs only; no recovery journal, durable dispatcher or cross-process lease exists. `agent.start` returns a run ID and streams terminal `done`/`error`; offline `done` is navigation fallback, not goal success. Provider termination is not verified goal completion. The current main process can continue only while alive; there is no OS scheduler or sleep execution service.

First slice: an additive main-process goal journal and scheduler, independent of workspace snapshot writes and injected provider dispatch. Capture profile/chat/folder/provider/model/effort/session metadata, validate dependencies, reserve dispatch before starting external work, cap concurrency at three, and interrupt uncertain attempts on restart without replay. No provider or renderer shared-file edits until the C004 ownership API settles. No activation against real user data.

## End-to-end acceptance (pending unless evidence says otherwise)

1. Main chat creates a goal with explicit deadline and three saved worker side chats. Each opens with all ordinary controls; closing/reopening tabs retains transcript and draft. Inheritance is a creation-time copy, independently editable for future work.
2. Coordinator assigns finite tasks with acyclic dependencies. At most three workers execute, one run per owned chat. Workers cannot spawn workers, extend deadline, create tasks from tool output, or automatically message themselves. Human edits/takeover retain all drafts/images and suspend affected work.
3. Events/results retain exact profile/chat/task/attempt ownership. Same chat/goal IDs in two profiles remain disjoint. Stale/duplicate/mismatched events cannot finish another attempt or overwrite user text.
4. Persist dispatch intent before side effects. Crash after reservation or provider start results in interrupted/uncertain work; explicit reconciliation precedes retry. Restart never silently replays a write. Malformed journals fail closed and originals remain intact.
5. Pause stops dispatch and requests cancellation; resume cannot overlap unresolved attempts. Cancel/deadline prevent further dispatch and preserve partial results. Deadline is wall-clock checked on every scheduling entry and wake; sleep does not extend it. Closing the process ends scheduling; recovery explains what is uncertain.
6. Failed/cancelled/interrupted prerequisites block dependents. Provider success enters review; evidence-backed review is required before a task satisfies dependencies and before goal completion. Offline fallback cannot count as success.
7. Real three-worker provider integration, concurrent human conversations, failure/cancel/deadline/restart tests, desktop journeys and GIFs distinguish real runs from fixtures. Root verify, desktop regressions, isolated Paper screenshots and reviewed visual comparisons precede completion claims.

## Checkpoint

Read required instructions and ran `npm run plan` / `npm run cycle`. Root and app `npm ci`, and `npx playwright install chromium` passed. App install reports two high development-dependency advisories; `npm audit --prefix app --omit=dev --json` reports zero production vulnerabilities. No dependency upgrades attempted.

Implemented additive `app/main/goals.js`, not yet activated by desktop IPC/UI. `node --test app/tests/goals.test.mjs`: **18/18 pass**, including three actual child processes, same IDs in different profiles, dependency/review gating, failure/offline, pause/cancel/deadline, durable reservation/reopen, corrupt journal, failed reservation/settle write, reentrant observer, drain-before-lease-release, competing live process and dead-owner lease recovery. This is scheduler/process integration, not authenticated model integration. The root test script includes the new goal suite through desktop tests.

Parent review identified missing cross-process ownership, observer reentrancy, close/drain and post-deadline reconciliation. All have tests and implementation. A test run after asynchronous close initially cancelled 12 tests because the fixture did not resolve its deliberately blocked adapters during cleanup; cleanup now acknowledges cancellation, and all 18 pass. A blocked adapter deliberately keeps its lease instead of pretending it stopped.

Current limits: no worker-chat creation, durable conversation event append, provider adapter, goal UI, machine-sleep execution service, or real-provider three-worker run. Journal lease recovery checks a dead host PID, not every possible surviving provider descendant; interrupted-task reconciliation must inspect external effects before retry. A crashed lease-acquisition guard fails closed for explicit inspection. JSON file fsync/atomic rename is tested for process-level persistence, not a hardware power-loss guarantee. Evidence strings record review assertions; they do not independently execute acceptance checks.

Next: source commit, deterministic capture/compare/actual image inspection/approval, root and desktop regression tests. Live Paper capture requires the parent's serialized built-source runtime slot (requested; do not launch concurrently). Then bind the provider adapter to C004 captured scopes and implement saved worker conversation integration. All end-to-end product acceptance remains pending; C005 stays active. No owned services running.

## Pending worker choices and event identity
Imported source 6ba1896: accepted worker events carry durable assistant/attempt IDs; explicit Start/Resume captures pending worker settings while retaining prior attempt context. Original lane evidence at 3b161cd predates this source; fresh combined evidence remains pending.


Native Windows worker source beefded is imported into C008 for validation. It adds job-owned subprocesses and default trusted recovery; the earlier checkpoint's unimported statement is historical. Production Electron goal fixture needs its transport seam adapted to subprocess ownership. Fresh combined full validation and visuals remain pending.

