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
