# Ordinary Paper notes: audited contract

C061 inspected upstream `30c007e43` and made 58 HTTP exchanges across four disposable runtimes. [Verified observations and raw responses](../cycles/evidence/C061/assessment.json) distinguish actual API behavior from the proposed adapter below. No app feature, native draft-note journey or migration activation is accepted by this audit.

| Operation | Observed behavior | Integration consequence |
|---|---|---|
| Empty creation | Generic `create` with empty title and blocks succeeds as `drafts.<id>`, with a locked empty title block and empty body paragraph. No tags or description are required for this draft. | Use a genuine draft; never fabricate publication metadata. |
| Identity and discovery | Published catalog/read omit drafts. Drafts catalog includes them. Raw bare-ID reads prefer an existing published row; drafts perspective prefers its twin. | Carry exact row ID, library owner and perspective. A canonical slug alone cannot identify the editing target. |
| Content edits | Bare-ID Paper ops return404 for a draft-only note; exact `drafts.<id>` ops work, increment integer rev0→1 and reject stale0 with412. | Preserve the exact draft ID through canvas, tools, receipts and Undo. Keep integer Paper revision separate from opaque document `_rev`. |
| Title edits | Generic title patch changes metadata but leaves the title block unchanged. Paper `patch-block` on `tpl-title` updates both; subsequent body ops preserve the title and stale ops refuse. | Prefer one Paper operation path for title/body. Existing published notes without this title role need separate handling; current Barkdown title refusal remains. |
| Search | Default search omits drafts; explicit `perspective=drafts` finds their body content. | Local draft discovery and search need deliberate perspective-aware adapters; do not change connected/cloud semantics implicitly. |
| Creation collision | Existing draft `create` refuses409 unchanged; one concurrent pair produced200/422. An existing published ID still allows a distinct draft twin. | This is not whole-namespace reservation. Do not infer safe retry or create-only semantics from the verb name. |
| Lost response | A proxy drops the response after one committed create; two exact draft reads return identical content without another write. | This proves a reconciliation primitive, not an app retry journal or power-loss safety. |
| Recovery | Guarded delete removes the draft; retained revision detail restores it as a draft. Repeating unconditional restore over a newer human title overwrites it. | Do not expose this restore as guarded Undo. Recovery needs an atomic current-state guard or safe new-identity recovery. |

## Implemented human journey — C067

The profile-owned `app/main/draft-notes.js` service now retains library owner, exact draft ID, published ID, perspective, integer Paper revision and opaque document revision. Managed-local New Page, foreground reads/ops, complete catalog and body search use it. Remote envelopes are validated; writes never substitute a published twin. See [C067 evidence](../cycles/C067-ordinary-paper-notes.md) and the [native gallery](../visual/paper-notes/README.md).

The native journey creates through New Page, types title/body in the real canvas, selects a body-search result, switches between profiles with identical draft IDs, and restarts into the original row. Creation persists the request before dispatch and a nonce before the POST; uncertain retries only read the same row, including after service reconstruction. A real lost-response probe confirms no second mutation. Missing readback remains unresolved; it never authorizes a fresh POST. Manual/cloud creation and legacy data keep their existing paths.

C069 connects API and MCP creation/edit/Undo to this same owned service, with atomic receipts and exact row/revision checks. The new shared paper-tools adapter captures the runtime profile; managed MCP tools do not seed legacy notes. [C069 native acceptance](../visual/agent-notes/README.md) proves chat activity, profile return, restart and visible Undo; later human edits remain unchanged when stale Undo refuses. Before deletion/recovery, prove that a later human edit cannot be overwritten by replay or restore. Do not bypass publishing walls, republish draft notes automatically, or translate opaque revisions into Paper integer revisions.

## Remaining acceptance

Crash-boundary recovery beyond the demonstrated journal cases, full multi-writer conflict handling, native profile switches during in-flight ordinary-note creation, deletion recovery and migration activation remain unproved. C067 covers human typing/search/restart, same-ID profile isolation, stale revision refusal and durable lost-response readback. C060 Archive classification and C059 ownership remain separate accepted boundaries. A2 stays open.
