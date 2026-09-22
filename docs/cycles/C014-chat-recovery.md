# C014 — Ordinary managed chat interruption recovery

Status: implementation and focused validation in progress. Isolated codex/chat-recovery-12h at combined82cc622. Central C008 remains coordinator-owned. C012 original evidence worktree retained; its source and evidence are now pushed through fb1ed55 after transient GitHub timeouts.

## Bounded proposed outcome

Managed Windows ordinary and side conversations receive the same actual owned process-tree lifecycle as goal workers without being given goal-worker policy or recursive delegation restrictions. After abrupt main exit, persisted ordinary attempts become truthfully interrupted, partial transcript/draft/images/context stay intact, and no provider dispatch occurs on reopen. Explicit trusted shutdown verification precedes any reviewed release of the unfinished attempt; retry is a new explicit user turn and never an automatic replay. Existing attempts without a verifiable owned receipt remain blocked. Legacy nonprofile conversations and non-Windows process containment are not included in this bounded slice.

## Audit

profile-service.start currently dispatches in-process agent. workspace-repository durably reserves an attempt and appends user/assistant entries; events update runId/sequence. Actual process restart loses providers/runs but retains driverFinished:false and chat.runId. Subsequent begin rejects the unfinished attempt. No ordinary reconciliation method or startup state conversion exists. Goal recovery is separately wired through scheduler/task journals and cannot clear ordinary attempts.

Existing goal-worker-agent mirrors the child into main providers/runs, supports approvals/cancel, retains runtime lease until verified native teardown, and can verify named Windows Job ownership after main death. goal-worker.js carries config on a private pipe and restores captured scope/env; goal-process receipts exclude credentials/content. Reuse this lifecycle with a generic reserved attempt ID, preserving goal caller compatibility and keeping goalWorker policy flags restricted to actual goal runs. API agreement requested from coordinator/goal lane before shared changes.

## Acceptance and verification

1. Actual Electron+local deterministic HTTP API fixture starts ordinary chat and emits partial text. Force only the fixture-owned main PID to exit; reopen without extra HTTP request.
2. Preserve partial text, user attachments, unsent draft, folder/provider/model and side-parent identity; interrupted UI cannot pretend streaming or success.
3. Unverified/missing/foreign receipt cannot release attempt or launch again. Trusted stopped job proof changes only matching profile/chat/attempt.
4. Explicit reviewed release preserves old entries and enables a new turn with a new attempt ID; no automatic prompt replay or duplicated messages.
5. Cancel/approval/normal completion/profile switch and goal lifecycle regressions stay intact. B remains independent of interrupted A.
6. Source commit, actual crash/recovery screenshots/motion, deterministic visual comparison/review, full relevant regression and root verification; preserve all evidence and no actual library writes.

Next: audit API with goal owner, add actual failing restart fixture on82cc622, then implement smallest shared lifecycle/reconciliation/UI surface. No owned runtime or provider process currently running in this lane.

## Implementation checkpoint

Managed Windows ordinary turns now use the same owned-job adapter without goalWorker restrictions. Generic attemptId aliases goalAttemptId; verified settled completion retention is capped at 200 while unresolved proof remains retained. Durable ordinary requests capture original context and model/effort, without copying credentials into receipts. Orphan or same-process uncertain-finalization attempts become interrupted, pending approvals expire, and shared main/side transcript controls check trusted shutdown before recording human review. Reviewed release preserves transcript/draft/images, clears stale provider resume state, and permits a new explicit turn; it never resends the old prompt.

Focused checks passed: chat-recovery.test.mjs (eight ownership/preservation/review groups plus retained-registry uncertainty), profile-service.test.mjs, workspace-repository.test.mjs, native worker and goal-recovery checks. Actual Electron fixtures M927qX/ELU3T7/k5s4xH passed force-exit and no-replay; latest additionally covers side-chat parent/folder/model/attachment/draft and narrow controls. Uncommitted screenshots and video remain in temporary fixtures, not final source evidence. Earlier JejK4t/Rw7tUq baseline preserved running state on restart. Their apparent draft failure was a test polling error: corrected Node-awaited durable-save polling and explicit pre-kill assertion preserve draft; no new product draft regression established.

Review caught an undersized review textarea and fixed full-width geometry. Parent review identified retained runs on uncertain native teardown; now recovery is exposed without requiring restart, still blocked until trusted proof and review. Late completion cannot bypass that review. Existing in-process SDK-injection unit explicitly injects the base agent; default product path is the owned worker.

Next: final focused/full suite, source commit and push, then exact committed crash/video frames, visual compare/actual review/approve, live status capture and root verify. C014 remains incomplete until that closeout. No source runtime slot or actual user library was used.

## Validation checkpoint before source commit

Full desktop session57346 passed:59 initial tests,76 Electron UI checks, registry/ownership/runtime/workspace/profile/goal/adoption/credential gates. Package registration of the new ordinary fixture happened after that command started; the focused test:chat-recovery24934 subsequently passed its registered command with the final driver acknowledgement implementation (xivhVK, three owned jobs verified stopped). Final unit KEGgPh additionally proves the renderer retains the send gate until trusted driver acknowledgement, rejects foreign acknowledgement, exposes same-process uncertainty and preserves draft. Provider done is distinct from native teardown; this prevents the composer clearing a new message before backend admission. Managed snapshot regression passed. Native adapter retention test passes202 settled entries plus an unresolved launch without evicting pending proof.

The final acknowledgement delta was tested by the focused service/renderer/actual ordinary suite after the full suite, rather than claiming the earlier full run included it. Final source-bound evidence and verify remain pending.

## Source and visual checkpoint

Source commit 9135723 is pushed on codex/chat-recovery-12h. The exact clean committed actual test (94493) passed in Vx9US5: parent and side forced main exit, persisted partial work, no replay, explicit native shutdown checks, review/new turn, and all three owned jobs verified stopped. [Actual screenshots, video, GIF and hashed review](../visual/chat-recovery/README.md) are now captured and inspected. Deterministic run 2026-09-22T00-48-28-913Z has 37 unchanged frames, no geometry or environment changes, and explicit approval after inspection of all underlying GIF frames.

First root verify failed on an inherited missing baseline link. Restored the four original run directories byte-for-byte from abbbcee, preserving this branch's approval. Second verify reaches only the expected stale live status gate (9135723 versus captured 5a3a502). Waiting for coordinator's shared a544 runtime slot; no runtime reserved or started in this lane. Next: source-bound live status, review, final verify and evidence commit.

Restored baseline history check: all 200 artifact blobs in the four abbbcee run directories match their original Git blob hashes. No original image or comparison was rewritten.

Read-only follow-up: [terminal ownership candidate](C018-terminal-ownership.md) records unowned descendant cleanup and same-id replacement concerns. No terminal behavior changed or failure claimed from source inspection alone. Coordinator will choose the next bounded cycle after C014 closes.

Final source e3a6554 fixes a reproduced early-interruption/late-start-acknowledgement UI race; focused failure then pass retained in test. Exact clean actual23139/tp1w78 passes all recovery assertions and all3 owned jobs stopped. Refreshed visual run01-03-52-492 approved after actual inspection:32 video samples,88 raw motion frames (83 encoded GIF),5 stills and unchanged deterministic37-frame geometry. Earlier913 evidence remains intact.

Coordinator granted a544 source window: final live status session8372/private gR99jf started from clean app source e3a6554. Capture and final verify pending; cycle stays active.

## Final evidence closeout

Exact e3a6554 live Paper status passed in session8372/private gR99jf, with real Codex turn, source a5440345c and server0.2.26.3877. Owned runtime stopped normally and CLI unchanged. Reviewed five original PNGs and all37 editing GIF frames; source manifest and review retained under docs/images/status/history/C014-e3a6554*.json. This separate legacy Paper regression does not claim an actual external owned-Codex crash run. Final root verify underway; bounded C014 completion awaits its result.

Final npm run verify session10975 exit0: build, TypeScript/source/links/hashes, plan/cycle, visual evidence freshness and all concept/handoff checks passed. Bounded C014 is complete. Evidence is ready for coordinator import; overall P1 and legacy/non-Windows recovery remain incomplete. No app source changes followed e3a6554. Next action: coordinator review and bounded terminal ownership proof, with no merge/deployment.
