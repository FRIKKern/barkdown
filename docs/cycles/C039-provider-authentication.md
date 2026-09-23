# C039 — Verify shared device authentication and profile ownership

The user decided on 23 September: use the computer's existing provider authentication by default, without asking. This supersedes the [opt-in proposal](../archive/C039-device-auth-opt-in-proposal.md). No per-profile consent prompt or separate-account requirement is planned.

## Selected boundary

- Main chats, side chats, goal coordinators and workers may use the computer's existing Claude/Codex login and supported environment keys by default.
- An explicitly configured profile API key takes precedence in the API provider. It remains owned by that profile; an empty profile must never fall back to another profile's key.
- Shared device authentication does not share documents, chats, drafts, folders, caches or run results. Runs keep their captured profile and conversation ownership.
- Do not copy login files into profiles or portable exports, sign out the device, or change real credentials as test setup. Provider command/file approval rules are unchanged.

## Current evidence

The original audit established API precedence, not every supported environment path: run-scope captures the device environment, CLI adapters use device login, and goal-worker IPC carries the captured environment. The controlled actual API adapter audit was rerun on 23 September at source 5325300 with synthetic keys: A used its owned key, empty B used the device environment key, and B did not use A's owned key. Fixture: bd-provider-key-boundary-9IMqo1. No network requests or real credentials were used. The implementation audit below subsequently found and fixed Claude's filtering of supported environment keys and the API client's ambient token fallback.

Command: node docs/cycles/evidence/provider-credential-boundary.cjs. This audit is evidence for API precedence, not a fresh live authentication test of every provider or goal path.

## Prepared work

[Four prepared task briefs](../tasks/2026-09-23-next-four.md) define login assistance, shared-authentication proof, P1 closeout and safe Paper migration preparation. The user also requires help signing in when existing computer authentication is unavailable, with drafts preserved. This is a requirement to implement/verify, not a claim that the integrated login flow already exists.

## Remaining proof

1. Reconcile the A1 evidence table against the chosen shared-device boundary, retaining all workspace ownership gates.
2. Verify main/side and coordinator/worker dispatch preserve profile-key precedence and captured ownership while using shared device authentication by default.
3. Implement and verify assistance for missing authentication, preserving drafts through sign-in/cancel and explicit retry; switching profiles must not borrow another profile's owned key.
4. Run relevant provider/profile/goal regression checks and close C039 only with recorded evidence. P1 remains active until its remaining acceptance evidence is reconciled.

## Checkpoint

This is a policy/documentation change; no runtime or UI change is required to enable the default, and no opt-in prompt is being introduced. C040 reviewed screenshots remain applicable. No services started. Root npm run verify passed for this update; controlled API evidence is recorded above. Continue on codex/finish-profile-isolation from merged main 7c3a325. Subsequent goals remain P2 one Paper engine, P3 recovery/portability and P5 installation; optional sync is P4.

Prepared four task briefs on 23 September, including the missing-login assistance requirement. Preparation is documentation only; no tasks dispatched, runtime changed or services started. Root npm run verify passed. Next: start Task 1 and Task 2 from the linked briefs, retaining separate ownership and combining their proof before Task 3.

## Active implementation — 23 September

Goal started for all four prepared tasks. Uncommitted source on codex/finish-profile-isolation now adds fixed CLI command resolution, an owned Windows login/status worker, lifecycle service, Settings/shared composer sign-in assistance, and authoritative pre-reservation authentication checks for ordinary and goal paths. Context is revalidated after the asynchronous authentication check. No real login was changed. Real Windows read-only status probes reported both installed providers signed in and verified their owned jobs stopped. Controlled lifecycle/authentication and existing goal-provider tests pass 22/22; app build passes.

Still required before this slice is complete: native sign-out/cancel/return/retry evidence with controlled transport; timeout/packaging/platform behavior; complete relevant regression checks; implementation commit then fresh live/deterministic visual evidence and review; root verification. Existing global visual approval is stale after these uncommitted app changes. Do not merge this work yet or claim C039/P1 complete. No owned services remain.

Authentication reference: https://learn.chatgpt.com/docs/auth plus installed codex login --help and claude auth login/status --help. Login uses each provider's browser flow; raw CLI output is discarded, and only sanitized lifecycle/status crosses IPC. A successful launch or login exit alone is not accepted as signed-in.

### Expanded implementation checkpoint

Ordinary legacy dispatch now captures its scope before the asynchronous authentication check. API constructors receive the captured key/token explicitly; profile keys take precedence over both device forms. Claude retains supported device environment credentials instead of stripping them. All four goal roles authenticate before reservation, and failed CLI-auth attempts expose the shared sign-in dialog without automatically resuming. Missing API credentials now refuse an interactive send and retain its draft rather than producing the old offline simulated reply; direct document/site navigation remains available.

Focused login/authentication/goals/provider checks passed 50 tests with one POSIX-only native test skipped on Windows; the subsequently added four-role pre-reservation case passes in the 12-test goal-provider suite. The actual production goal-worker protocol and native Windows Jobs passed six A/B × API/Claude/Codex credential journeys with controlled SDKs and synthetic keys, without credential-bearing renderer events. The native login journey passes main refusal/cancel, side text/image preservation, successful return without auto-send, one explicit retry, Settings recheck, dark theme and 390px layout. Goal UI assistance preserves the main draft and does not resume the scheduler. These are controlled transport checks, not fresh browser sign-in or authenticated provider network evidence.

POSIX login/status now uses an owned process group; Windows retains Job containment. POSIX native verification and a packaged-app smoke test remain unperformed on this Windows host. Codex native resolution includes the ASAR-unpacked vendor path. Malformed status and CLI inspection failures are not reported as proof of being signed out. File-based initial provider badges/default selection remain a limitation for keyring-only authentication until an actual status check runs.

Broader desktop validation is running; its first failures were the synchronous test harness and the old offline-reply expectation. Both fixtures were updated for the real asynchronous preflight and explicit missing-auth behavior; the resumed suite has passed the shell journey, profile switching/restart, adoption and ordinary abrupt-run recovery so far. Logs are under app/test-results/authentication-*.log. Source is still uncommitted, existing global visual evidence is stale, and no merge is ready. Next: finish the full suite, commit the bounded source, recapture login/live Paper/deterministic tours, inspect motion and stills, approve explicitly, then root verify and evidence commit. Tasks 3/4 and full P1 acceptance remain open.

Full `npm --prefix app test` completed with exit 0 (session 86916). The final provider-menu dismissal change then passed `node app/tests/provider-login.live.mjs` after rebuilding. New four-role and native child-authentication tests were run separately after their addition and passed. Source checkpoint follows; visual/root acceptance is still pending. All test-owned Electron processes and worker Jobs from completed checks stopped.

Source implementation is committed as `1c94f8d`. Full desktop passed. The source-bound nine-frame login gallery and 17 motion samples are retained under docs/visual/provider-login/1c94f8d with original video and hashes. First deterministic tour 2026-09-23T08-58-53-109Z had only the expected Assistant Settings difference; all 40 stills/GIF frames were inspected. Approval correctly refused after the coverage map and main README were updated, so that candidate stays unapproved and a new capture is required. The parallel live attempt refused the dirty pending pointer and verified its disposable runtime stopped (bX6145). Commit the evidence/coverage checkpoint, then run live capture first from clean source, deterministic capture/compare/review/approve second, and root verify. No stage closure or merge yet.

### Verified login milestone

Source `1c94f8d` and coverage/evidence `345b5e8` are pushed on codex/finish-profile-isolation. Logs checkpoint `e2a4723` precedes final evidence. Fresh real CLI status probes both passed without account changes. Final deterministic capture 2026-09-23T09-06-36-021Z is explicitly approved after all 40 stills/40 GIF frames were inspected (unchanged images verified against the earlier inspected candidate). Live Paper at e2a4723 passed with a real Codex turn after Claude quota refusal; five stills/all 37 GIF frames inspected, runtime gKREcx stopped. Root npm run verify passed in session 89844. No active owned services remain.

Continue the active goal: (1) make initial keyring-only authentication discovery truthful without silently changing an already chosen chat provider; (2) verify expired-session errors preserve retriable intent while quota/network/tool-side-effect failures remain distinct and never auto-resend; (3) finish C039/A1 evidence reconciliation; (4) audit/build synthetic migration preparation. Initial read-only migration audit found pmDocToBlocks flattens heading marks/clamps levels and publish is create-or-replace without ifRev: neither is a safe bulk-migration guarantee. Upstream bf23f773 ingest explicitly refuses ifRev; ops honors it. No migration code or corpus created yet. Do not mark P1 or the overall goal complete.

### Synthetic migration preparation checkpoint

The preceding corpus status is superseded: [migration preparation](../migration/README.md) now contains 22 synthetic cases and a runnable production-converter audit, two-profile identity/organization inventory, checked comparison report, audited API limitations and proposed durable/recovery boundaries. `node docs/migration/audit.mjs docs/migration/report.json` passed: 10 representation-preserved, five lossy, one unresolved reference and six rejected cases. These are explicit cutover blockers, not migration success. `npm run check` and `git diff --check` passed. App, dependency and capture inputs are unchanged; approved evidence at ab9ce67 remains current. No services started, real library read, migration, merge or deployment.

Next: return to initial keyring-only discovery and expired-session handling, then reconcile A1. Task 4 preparation exists; its real Paper round-trip/interruption/rollback rehearsal still requires P1 acceptance and a new P2 cycle. The report hashes bind the uncommitted preparation inputs to base ab9ce67; the preparation commit follows this entry.

### Initial authentication discovery — in progress

Preparation was committed/pushed as `724a061`. Subsequent **uncommitted** runtime work adds `provider-discovery.js`: the first Settings read awaits shared CLI status checks, including keyring-backed login, instead of using credential-file existence. Supported environment credentials remain available; failed inspection does not claim signed-in. Existing explicit provider selection remains the higher-priority setting. The discovery tests are registered in the desktop suite. Build, 11 focused discovery/login checks (one POSIX-only skip) and profile IPC gate checks pass.

The controlled native login journey first failed because its injection occurred after startup discovery had instantiated the real login service. It now installs the same controlled process/SDK fixture through a disposable boot script before loading production main. The rerun passed all nine capture steps and verified application cleanup. These dirty-source captures are preliminary, not approved evidence. No real login credentials were changed. No test-owned service remains active.

Next exact work: extend the native bootstrap fixture to prove initial keyring-only default discovery and persisted provider selection; finish expired-session handling without automatic retries or overwriting newer drafts; run integrated checks, source commit, clean-source captures/compare/actual review/approval and evidence commit. Current visual approval is stale because runtime inputs changed. C039/P1 and the overall goal remain active.

Native discovery now passes three real Electron boots with controlled status: no credential-file hint selects signed-in Claude; saved API and Codex selections remain unchanged. The initial saved-choice fixture accidentally wrote settings above the legacy store and failed; corrected fixture writes `barkdown/settings.json` and all three cases pass. Both discovery tests are registered in desktop/login commands.

Uncommitted expired-session work now uses a specific provider-level authentication classifier (401, known auth codes and narrowly anchored session messages), rather than broad auth/login keyword matching. Claude/Codex terminal errors carry sanitized `authProvider`; workspace and renderer retain it, and goal-provider outcomes forward it. Shared transcripts offer sign-in help and explicit copy of the original text/images into an empty draft; newer drafts, active runs, pending submissions and interruptions block copying. Nothing auto-resends or assumes no side effects. A controlled native Codex 401 journey proved help/copy and newer-draft protection. It found an early terminal-event/late start-ack legacy race that reinstalled a stale run ID; send acknowledgement now preserves an already terminal legacy reply. The ten-step native journey passes with cleanup, still dirty-source/preliminary captures.

Build, 37 provider-runner/goal-provider checks, workspace repository and send-preservation regressions pass; classifier/discovery focused checks pass. Remaining before source commit: add direct expired-error coverage for Claude streaming error forms, profile reload/background ownership, goal outcomes and copied attachments (current native copy case is text); review API credential-error handling and truthful AUTH_TOKEN settings status. Then full desktop validation and the required source/evidence sequence. No processes are left running. No stage closure, merge or deployment.

### Broader recovery validation in progress

The latest uncommitted changes handle the installed Claude SDK's explicit `authentication_failed` assistant error as a terminal authentication failure (rate limits remain distinct). Actual Claude/Codex adapter checks preserve captured profile/chat identity and avoid exposing raw authentication details. API terminal authentication errors now retain recovery metadata and the shared transcript offers API settings plus guarded draft copy. Settings recognizes supported `ANTHROPIC_AUTH_TOKEN`. Direct copy tests cover attachments, independent copies, newer drafts, pending/active/interrupted turns. A repository restart check proves a late A authentication failure and original prompt remain in A while selected B is byte-for-byte unchanged.

The goal-provider audit found its final failed-outcome mapping dropped `authProvider`; fixed and a real-adapter controlled goal 401 test now passes (13 goal-provider checks). Build, seven provider-authentication checks (including native A/B child transports), two auth-error/recovery checks, repository tests and ten-step native login journey pass. The native screenshot was inspected preliminarily; it includes the expected newer-draft refusal toast, not a clean-source approval.

**Live validation handle:** full `npm --prefix app test` is running in exec session **5859**, log `app/test-results/authentication-discovery-full.log`. Last authoritative poll confirms it is still live, with shell77, direct-edit, history, side-chat, profile restart, goal ownership and adoption/rollback checks passing so far. Resume/poll this handle; do not launch a duplicate. The goal-provider mapping/test and final repository regression were added after their original full-suite sections and separately passed; retain that qualification. No full-suite exit has been observed yet.

Next: finish that run; extend the goal failed-auth action to API settings (currently goal scheduler/UI still restrict `authProvider` to Claude/Codex), preserving the profile-switch guard; validate that bounded fix and final integrated source. Then commit implementation, run clean-source login/live/deterministic captures, review/approve, root verify and evidence commit/push. A1 now has a current requirement-to-evidence checklist above its retained historical ledger; it remains unapproved. Do not mark C039/P1 or the overall goal complete.

The API goal-help gap is now fixed: scheduler/adapter retain API authentication metadata, and the shared goal view routes help through a captured-owner callback. Production checks both profile identity and generation before opening API Settings (CLI still uses shared login assistance). It never resumes the goal. Goal UI coverage verifies the captured owner, API action and draft preservation; 37 scheduler/goal-provider checks and the native goal UI pass. Two fixture-only failures (empty initial goal list and hard-coded chat ID) were corrected before the passing run.

Implementation freeze checkpoint follows. Full-suite session5859 is still active as of this entry; it started before the bounded goal-help fix, whose focused checks passed separately. Complete it and run the final frozen-source validation rather than claiming that earlier sections cover later edits. Clean-source evidence and root verification remain required. No merge/deployment or stage closure.

### Source frozen; final evidence in progress

Source is committed locally as **27ea120** (not yet pushed). Full-suite5859 subsequently exited0; its log is `app/test-results/authentication-discovery-full.log`. A final frozen-source full desktop run is **live session37384**, log `app/test-results/authentication-final-full.log`; poll that handle, do not duplicate it. Clean-source login capture87382 exited0 and verified cleanup; ten stills/19 original-video samples inspected, retained under `docs/visual/provider-login/27ea120`. The generated 19-frame GIF still needs decoded-image inspection.

Isolated live Paper capture96498 exited0 at source27ea120/upstreambf23f773: Claude weekly-quota refusal followed by a **real Codex turn**, five stills/37-frame GIF generated. Runtime `barkdown-shots-runtime-zFHZ6W` stopped; user CLI configuration unchanged. Its log is `app/test-results/authentication-final-live.log`. New live artifacts in docs/images/status are not yet visually reviewed.

Deterministic capture78986 and comparison exited0, candidate **2026-09-23T09-42-11-954Z**. It is **not approved**. Next exact steps: inspect its report/stills/all GIF frames, inspect live five stills/37 frames and decoded login GIF, explicitly approve only after actual review; finish session37384; retain logs/hashes and updated review records; run root verify; reconcile A1/C039 closure and Task4 preparation acceptance; commit/push evidence with source. No owned capture service is running; only the full-test session remains live. Nothing merged/deployed or migrated.

### Accepted closeout

Final frozen-source desktop **37384 exited0**; root verification **49277 exited0**. All test/capture sessions have terminated and isolated runtime cleanup was verified. The [validation record](../visual/provider-login/27ea120/validation.json) retains normalized logs and hashes. Deterministic candidate09-42-11 is explicitly approved in immutable review615d3ff9 after inspecting the changed Settings still/all four decoded GIF frames; other39 stills/seven GIFs match the previously inspected baseline byte-for-byte. Five live Paper stills/all37 decoded frames and ten login stills/all19 decoded frames were inspected. No new visual blocker; normal toasts and video resizing remain visible.

Evidence checkpoint **2d6a203** and implementation27ea120 were pushed to origin/codex/finish-profile-isolation. Final documentation check and post-commit visual freshness check pass. The follow-up documentation commit includes the capture-generated root README image links, which were inspected with the same reviewed assets; no runtime input changes or new capture is needed. Main remains unchanged.

[The completion audit](C039-completion-audit.md) accepts all four tasks at their stated scope, C039 and A1/P1. Existing native adoption/isolation/cache/recovery proof is reused with original source limits and all102 artifact hashes verified; it is not relabelled as a new runtime execution. Task4 audited preparation is complete; production migration/rehearsal, portability, installation and G1/G2 remain open. NEXT-AGENT, PLAN/plan.json, ACCEPTANCE, task briefs and AGENTS now point to P2; DESIGN-DECISIONS remains consistent with the chosen shared-device boundary. Cycle archive is C039-completed.json. `npm run check` passed after the first documentation reconciliation; final documentation check and evidence commit/push follow. Nothing merged, deployed or migrated; no active owned services remain.
