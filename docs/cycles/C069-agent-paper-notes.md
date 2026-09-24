# C069 — Agents on ordinary Paper notes

**Outcome / budget:** API and MCP agents create/read/edit managed-local ordinary notes through the same owned draft service, with revision-checked Undo and native restart proof. Estimated ceiling: 90 minutes before a scope checkpoint. Stop at this demonstrated journey; deletion/recovery, migration activation, merge and deployment are excluded.

**Affected boundaries:** captured provider profile/runtime, exact draft row and perspective, durable creation intent, edit receipt ownership, locked title blocks, human edits and native activity/navigation.

**During work:** inspect real upstream create/title/ops behavior; targeted draft, agent, MCP, run-scope and ownership tests; real disposable-server create/edit/Undo/stale/foreign/restart assertions. Scope UI assertions to the actual resulting note/content rather than helpers that repair the action.

**Ready checkpoint:** finish implementation/harness/area documentation; full desktop and root verification; commit implementation, capture native motion plus standard compare/inspect/approve and isolated live Paper. Commit source-bound evidence separately, then push a coherent checkpoint. No gate bypass; changed app/harness inputs invalidate dependent captures.

**Starting source:** 8ef08fe on codex/paper-library, draft PR33. C068 is archived; later README/roadmap presentation changes remain intact. Hosted checks are being inspected separately from app acceptance.

**Findings:** human New Page uses draft-notes; API/MCP create_document still writes the legacy store. Existing agent replacement/Undo removes every block, including the managed draft's locked title. Audit and preserve that template contract before exposing agent creation.

**Repository / services:** main plus one delivery lane;43 locked historical worktrees remain preserved for recovery review. No app services started yet. No subagents launched.

**Next:** inspect the upstream creation/template implementation, select the smallest safe shared adapter, then test it against a private runtime before capture.

**Implementation checkpoint:** shared paper-tools adapter now selects the captured managed runtime; both API and MCP create exact drafts with initial title/body, find them and use draft-aware edits. Body replacement/Undo preserve locked title structure. Creation requests retain content fingerprints and a cross-process lease; edit receipts use an owned per-document lease and atomic fsynced replacement. Managed MCP does not seed legacy notes. Targeted draft11, receipt-owner11, API loop, MCP compatibility, profile-runtime and profile-service checks pass; app build passes.

**Failures retained / corrected:** initial draft tests caught a missing await that released the creation lease before reconciliation; awaiting readback corrected it. The first real probe's final legacy-seed assertion expected2 while the completed managed path correctly created0; corrected harness now proves0. Real owned create/replay/body replacement/Undo/foreign/stale-human and actual stdio MCP round trip pass in agent-contract-1790280818994.json. The failing probe remains alongside it. Do not edit active harness/source while its run is in progress.

**Current validation:** native SDK/chat/profile/restart/Undo smoke run is active in a disposable bd-agent-note-native directory; no user library or shared runtime is used. Capture/approval and full closeout are still pending.

**Native smoke checkpoint:** chat creation/activity, body replacement, same-ID profile return, actual app restart and visible Undo passed before a test-only error: the final receipt-read call omitted the required in-session binding. The IPC correctly refused it. The harness now supplies the fresh binding and asserts the specific later-revision refusal, rather than accepting any error. The smoke also exposed that programmatic settings alone did not repaint the theme; final captures explicitly apply and assert the persisted dark theme. The original smoke manifest (which incorrectly labelled early light frames dark) is retained as failed development evidence, not accepted media. Both owned runtimes stopped on exit; full desktop regression is still running.

**Implementation ready:** full desktop regression passed in490.872 seconds. Final targeted draft13, receipt-owner11, API/MCP compatibility and profile checks passed after review removed duplicate MCP catalog fallback and validated lock paths through the bound store. App build passes. All native smoke services stopped. Implementation will be committed before final native/standard/live capture; screenshots and root freshness acceptance remain pending.

**Review correction:** source74f61a8 native journey reached all six checkpoints, but final transport assertion found two HEAD /api/hello availability probes from native Settings. The fixture now explicitly records/answers that endpoint and still rejects other unexpected requests; no app error was masked. Independently, a failing scope regression proved a managed runtime lease overrode explicit disabled Paper settings; resolve now retains that denial, with a no-create regression. Standard capture completed unapproved; concurrent isolated live capture correctly rejected its pending-pointer mutation. Retain these candidates, serialize remaining captures, and recapture against the corrected implementation.
