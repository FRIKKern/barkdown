# C004 — Captured run ownership

Status: active. Parent P1/A1 remains pending. Baseline `9b5ddbf` closes [C001 design](C001-profile-ownership.md); registry/adoption C003 proceeds in a separate branch.

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

