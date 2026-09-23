# C004 — Captured run ownership

Status: complete (captured-run foundation). Parent P1/A1 remains pending. Baseline `9b5ddbf` closes [C001 design](C001-profile-ownership.md); registry/adoption C003 proceeds in a separate branch.

## Outcome

Bind each provider run to a copied folder/context, explicit store/adapters and captured Barkpark connection before asynchronous SDK loading. Preserve current legacy boot while adding an optional validated profile owner. Bound local document/conversation/receipt handles and authoritative event envelopes prevent parent-side activity from consulting another active store.

No profile UI, registry adoption, external login separation, cold database migration or full A1 claim in this slice. No user library, shared runtime, CLI selection or sibling checkout changes.

## Planned proof

Disposable A/B stores with identical document/chat IDs; delayed API/provider dispatch; mutation of original context/environment/config; captured MCP child configuration; owner envelope spoof resistance; revision-checked receipts; existing desktop suite. App implementation commit precedes fresh deterministic visual review and isolated live Paper screenshots, followed by evidence commit and root verification.

## Checkpoint

Dependencies and Chromium installed in isolated worktree. C001 root verification passed. No C004 implementation yet. Next: add bound adapter factories and captured scope; no service running.

## First implementation checkpoint

Bound store/document/conversation/receipt factories and immutable run scope are implemented. Runs capture folders, model settings, messages/images, connection/token and provider environment before awaited SDK loading; MCP receives an immutable connection snapshot. Events carry authoritative owner fields, including null for legacy ownership. Parent-side create activity uses acknowledged document ID, never title lookup. Store path traversal/alternate stream/junction escapes are rejected. Scope capture reads existing data without seeding or creating missing roots.

Targeted conversation, agent and real stdio MCP suites passed. New run-ownership suite passes same-ID roots, captured Undo receipts, delayed API work, delayed actual Claude/Codex SDK seams, environment/context mutation, spoofed owners, traversal and no-write capture. Initial new-test failures were fixture newline expectations and an incorrect API stream mock; corrected fixtures now pass. Full desktop validation and screenshots remain pending. No owned services running. Legacy CLI active-selection mode and provider home login remain explicit limits; profile-scoped CLI mode fails closed.


## Finalization contract checkpoint

Trusted agent.start/createRun now accepts onFinish(owner), awaited exactly once from transport finally; cancellation only aborts and does not release a runtime lease early. agent.waitForRunFinish(runId) resolves after this finalization with owner and terminal status; up to 200 completed results remain in process for a start/finish race. It is not durable storage and does not establish OS descendant termination. Delayed SDK cancellation prevents launch. Cleanup failure emits an owned error note and resolves cleanup-failed while still removing the run. The expanded 11-group ownership suite passes. Full desktop suite passed before this additive hook; rerun final source next. Live source capture slot is queued after editor; no live runtime owned here.


## Final source validation — 0086867

Full npm run test:desktop passed on final source: 11 ownership groups, existing units, 76 Electron checks, direct-edit UI, composer history and side-chat parity/restart. Deterministic capture docs/visual/runs/2026-09-21T22-32-06-713Z has 21 frames and five GIFs; all frames inspected, comparison has no differences above tolerance or geometry/environment change, explicit agent approval recorded. Live shots:isolated passed with temporary EmRa3K runtime, actual Barkpark a5440345c and clean source trees, real Codex turn (Claude weekly limit). Inspected all five stills and 37 GIF frames; expected transcript/revision/ephemeral endpoint changes, no visible breakage. Private runtime stopped normally; shared source slot released. [Immutable live manifest](../images/status/history/C004-0086867.json).

Limits: captured roots must be trusted; ancestor/root-replacement validation is C006 work. No profile UI, renderer cross-profile event routing, external SDK login isolation, durable run queue or OS descendant-stop guarantee. Lifecycle contract is [RUN-OWNERSHIP.md](../RUN-OWNERSHIP.md). Root verification and evidence commit remain next.


## Closeout

Root npm run verify passed on source 0086867 plus reviewed evidence. Repository truth review covered README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION and architecture; changed claims updated and P1 remains pending. C004 is complete within its bounded scope. No merge or deployment. Next C006 integrates a trusted registry resolver and shared workspace repository before profile UI; carry the explicit remaining boundaries above. No owned live process remains.
