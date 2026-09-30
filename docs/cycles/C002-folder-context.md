# C002 — Fast working-folder answers

**Completed and validated on `codex/fast-folder-context`.** Implementation commits: `c66744b`, corrected by `3e2ed6f`. Historical blocked checkpoints below are retained; see the final results at the end. No merge or deployment.

User-requested interruption of planned C001, preserved in C001-profile-ownership.json. No profile completion claimed.

Plan: include this run's per-chat folder and direct-answer guidance in every provider request, including resumed sessions. Folderless chats must not infer a folder from the parent, open files or another chat. Inspect files only for content/listing/verification requests.

Initial checkpoint: npm run plan and npm run cycle passed through the installed npm.cmd (npm.ps1 resolves a missing user installation). Creating codex/fast-folder-context failed: .git ref writes are denied. Existing branch is codex/electron-prototype. No services started. Implementation, tests and screenshot workflow pending; commit/push unavailable in this environment.

## Verification checkpoint

Implemented in app/main/agent.js: every provider dispatch includes the captured run folder, direct-answer guidance, explicit folderless state, and permission to inspect when asked. Resumed sessions receive it too. app/tests/conversations.test.mjs covers main/side/unknown chats across all provider names and resumed parameters, with API message wrapping. This proves request context, not live model latency or compliance.

Passed: node app/tests/conversations.test.mjs; node app/tests/agent.test.mjs; node scripts/check-cycle.mjs; node --check app/main/agent.js.

Blocked: npm ci failed (registry downloads EACCES, then npm exit-handler error), leaving root dependencies incomplete. npm run verify stops at build: missing cheerio. Playwright Chromium install failed creating the user browser cache (EPERM). Git branch creation failed because .git is read-only. No commit or push attempted after that failure.

Truth review: README, app/README, PLAN/plan.json, NEXT-AGENT, VALIDATION, architecture and decisions reviewed. Existing per-chat ownership claims remain accurate; P1 remains pending. Queue/handoff updated for this user-requested interruption. No UI/layout changes. Screenshot coverage reviewed: existing screenshots cannot demonstrate prompt behavior; required implementation-commit then screenshots then evidence-commit sequence remains blocked by Git permissions and setup. No fresh screenshot or live provider speed claim.

All changes are uncommitted. No owned services running. Next exact action: in a writable/network-enabled checkout, create codex/fast-folder-context, run npm ci and install Playwright Chromium, run npm run verify and the two app checks above, then commit implementation, run/review app screenshots against an isolated local Barkpark, commit evidence and push. Resume C001 ownership inventory after closing C002. Do not mark this cycle done yet.

## Recovery session

Created codex/fast-folder-context from main 296d407, retained a Git stash recovery copy, and carried over the implementation and both cycle files. Resolved handoff append conflicts by preserving the main visual-workflow records and the C002 history. Dependency restoration and validation are in progress. No merge or deployment is authorized.

## Restored validation checkpoint

Root `npm.cmd ci` and `npx.cmd playwright install chromium` succeeded. App `npm ci` met an EBUSY lock from an already running Electron app; no process was stopped. Missing dependency files were restored from the isolated visual-health install only after checking identical lockfile hashes, without overwriting existing files. `npm --prefix app ls --depth=0` passes. Conversation and agent tests pass again; conversation tests now exercise the real shared dispatcher with provider transports stubbed, including changing/clearing a folder on resumed sessions.

Live screenshot setup now has `npm --prefix app run shots:isolated`: a private runtime/database, ephemeral ports and temporary CLI config. The capture reports the actual private server/source commit and closes Electron on failure. It retains temporary data for diagnosis. No shared server, CLI selection or sibling checkout was changed. Full desktop checks and post-implementation-commit screenshots remain in progress.

## Regression review

The full desktop suite passed on c66744b. A targeted new offline test then exposed an extra navigation caused by interpreting injected folder guidance as the user message. Fixed by passing original messages separately to the offline fallback; online provider requests still receive guidance. Added coverage for image-only API turns, resumed provider dispatch, folder changes and clearing. The failing offline test now passes. The first isolated live capture completed against private Barkpark, with a real Codex turn after Claude reported its usage limit; its owned database stopped cleanly. Fresh evidence will be recaptured after the correction commit.

## Final results

- Restored root dependencies with `npm.cmd ci`; installed Chromium with `npx.cmd playwright install chromium`. App missing-file repair used an isolated install with an identical lockfile, preserving the running Electron process; `npm --prefix app ls --depth=0` passed.
- `node app/tests/conversations.test.mjs` and `node app/tests/agent.test.mjs` passed, including actual shared-dispatch interception, resumed and changed/cleared folders, image-only context, input preservation and the offline-navigation regression (observed failing before its fix).
- `npm run test:desktop` passed after `3e2ed6f`: all unit suites, 76 Electron checks, direct-edit UI, composer history/restart and side-chat ownership/restart tests.
- `npm --prefix app run shots:isolated` passed after the implementation commit. It captured five stills and a 37-frame editing GIF against private Barkpark `a5440345c`; Codex supplied the real assistant turn after Claude's usage-limit response. Both private capture runtimes stopped; no shared service or CLI selection was changed. Temporary data/logs were retained.
- `npm run visual:capture`, `npm run visual:compare` and explicit Codex review completed. All 21 action frames and control geometries match the prior reviewed baseline within tolerance, with the same environment. Current source fingerprint and artifact hashes passed validation.
- `npm run verify` passed in full; final handoff/queue/link checks are repeated before commit. `git diff --check` passed.

[Completed cycle record](C002-folder-context.json) · [Live capture provenance](../images/status/history/C002-3e2ed6f.json) · Visual comparison (`docs/visual/runs/2026-09-21T21-48-36-561Z/README.md`, kept in git history)

The live gallery changes are a fresh private library, a new real transcript, revision/timing metadata and the private endpoint. Layout and editor affordances remain intact. Screenshot review does not prove folder-answer latency or guarantee model compliance; request/dispatcher tests prove the injected guidance. No focused live folder-location benchmark was run. P1 is still pending.

C001 is restored as the next planned cycle; its inventory has not started. The original pending work remains recoverable in the named Git stash. Review/push this branch only; do not merge or deploy. No owned capture services remain running.
