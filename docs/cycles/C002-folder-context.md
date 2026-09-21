# C002 — Fast working-folder answers

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
