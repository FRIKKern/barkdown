# C069 — Agents on ordinary Paper notes

**Outcome:** locally accepted at source74f61a8 plus8a277bb. Managed-local API and MCP agents create, discover and edit the same owned Paper notes as people. Body replacement preserves the locked title; native Undo survives restart and refuses a later human revision without overwriting it. P2/A2 remains open. No deletion/recovery, authority activation, merge or deployment.

**Delivery budget:** one demonstrable agent-note journey, estimated90-minute ceiling before a scope checkpoint. Stop here rather than add a second product slice. Starting8ef08fe on codex/paper-library/PR33; unrelated README/vision commits through7052c17 were preserved.

**Affected boundaries:** captured profile/runtime, exact draft row/perspective, durable create intent, edit receipt ownership, locked blocks, later human edits and activity/navigation.

**During work:** targeted draft, provider/API/MCP, receipt-owner and context checks; disposable real server/API/MCP probes; actual native chat/edit/Undo/profile/restart and stale/foreign assertions. Assert the action's resulting exact note, never repair it with an open helper.

**Ready checkpoint:** implementation commits → native/live/standard captures → actual inspection and explicit standard approval → root verification → evidence commit and coherent push. App/harness changes invalidate dependent evidence. Code-area README edits were batched before final capture.

## Delivered and verified

- Shared paper-tools routes managed API/MCP creation, list/read/body-search and edits through the owned draft service. Managed MCP creates no legacy seed files; manual/legacy compatibility checks pass.
- Creation binds request UUID to original title/body and nonce; durable uncertain retries only read the exact row. Same request with changed intent refuses. Cross-process creation and receipt leases plus atomic fsynced receipts preserve ownership.
- Exact draft IDs, opaque owners and integer Paper revisions survive activity and receipts. Locked titles are preserved by body replacement/Undo; additional locked slots refuse whole-body replacement. Explicit disabled Paper access stays disabled in captured provider scopes.
- [Full desktop](evidence/C069/desktop/result.json) passed in490.872s. [Final targeted checks](evidence/C069/final-focused/result.json) cover draft13, receipt-owner11, API/MCP compatibility and profile runtime/service. The subsequent scope correction passes [profile service, context15, draft13 and runtime checks](evidence/C069/scope-checks/result.json). No dependency repair was needed.
- [Clean-source real API/MCP probe](evidence/C069/agent-contract-1790282294968.json) at8a277bb/private30c007e43 passes creation/replay/different-intent refusal/discovery/body-search, exact reconstructed Undo, foreign/stale refusal, stdio MCP round trip and no legacy seeds.
- [Native gallery](../visual/agent-notes/README.md) at8a277bb proves acknowledged chat activity opens the exact note, title-preserving body edit, identical-ID second-profile isolation, return, actual restart, visible Undo with exact block restoration and protection of later native human typing. Eight scripted model responses pass through the actual SDK; this is not live-model decision proof.
- [Root verification](evidence/C069/closeout/result.json) passed in46.871s after reviewed captures. Final documentation/index checks follow the closing status update; no source changes invalidate app proof.

## Visual and repository truth review

[Named review and provenance](evidence/C069/review.json): native6 stills,407 full-motion samples and41 excerpt samples inspected; standard40 stills/40 differences/40 GIF frames inspected and explicitly approved, with no pixel/geometry/environment change. Live5 stills/37 GIF frames inspected; the separate showcase uses real Claude. Raw video and failed candidates remain. Seventeen raw artifact hashes across the native candidates verified.

Wide/narrow layouts, saved state, cursor transitions, human typing and Undo visibility were inspected. The820px reading column is cramped and summary truncates; API tool traces remain expanded. Initial light startup, private-runtime waits and Settings transitions remain in full recordings. Existing fixture GIF shadow banding remains distinct from PNG geometry. This is bounded functional acceptance, not a blanket polish or responsiveness claim.

Reviewed active queue, acceptance stage, handoff, architecture, migration contracts, area galleries, README claims and source diff. Corrected stale migration/agent-next statements. Main plus one delivery branch;46 worktrees include43 locked historical directories retained for recovery review. All owned native/probe/capture runtimes stopped; disposable diagnosis data retained. No shared service, real library, sibling checkout or credential changed. G1/G2 remain blocked at the last24 September audit.

## Failures and corrections retained

- Initial unit checks caught missing await releasing a create lease before reconciliation; both returns now await it.
- First real probe expected two legacy seeds while managed MCP correctly created zero. Corrected assertion proves zero; failing agent-contract-1790280623502.json and later development success remain.
- Native smoke omitted the required binding when reading an Undo receipt; IPC correctly refused. Fixed to use the fresh binding and assert the specific later-revision refusal. Early smoke theme was light despite its label; [failed smoke manifest](evidence/C069/native-smoke-failure.json) remains diagnostic only.
- Clean74f61a8 native candidate reached all six states but its final fixture assertion rejected two HEAD /api/hello availability probes from Settings. The fixture now handles and records only that explicit endpoint, still refusing other unexpected requests. Final8a277bb native manifest records both probes separately from eight model turns, with no errors.
- A deliberately failing scope check exposed that a runtime lease overrode explicit disabled Paper settings. Correction8a277bb preserves the denial; regression proves no create fallback.
- Concurrent standard capture changed pending.json during the first isolated live source check. The source guard correctly refused it. The unapproved standard candidate remains; subsequent captures were serialized around that mutation and passed.

## Cost, limits and next action

Full desktop490.9s; root46.9s; final native recording407 samples at2fps includes lengthy disposable-runtime setup/profile waits. The retained-check interval starts20:12:30 UTC; implementation started earlier, so it is not total task duration. Active/wait split and trustworthy token totals are unavailable. Native harness corrections and the source-guard conflict caused avoidable recaptures. Concrete lesson: cheaply exercise fixture health routes and binding assertions first; serialize capture metadata writes, and inspect the manifest-selected media rather than globbing historical galleries.

Uncertain edit-response recovery, arbitrary crash boundaries, in-flight creation/profile switching, agent title changes and full multi-writer conflict handling remain unproved. Existing exact revision guards are not a general recovery system.

**Next:** review PR33 checks for the final pushed SHA. Then plan guarded ordinary-note deletion/recovery using C061's actual API findings: unconditional restore can overwrite newer human edits, so require atomic state guards or explicitly recovered new identity. Later tasks remain retained-evidence UI, writer fencing/sealed activation and rollback/retirement. Preserve the legacy store and unmerged upstream dependency; do not merge or deploy as part of this cycle.
