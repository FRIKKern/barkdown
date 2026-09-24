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
| Deletion and recovery | C070 confirms an exact draft delete also removes its published twin and returns the published identity in its receipt. A stale revision at request start refuses, but the caller check precedes a separate lifecycle reread. Repeated restore overwrites a newer human title. | Generic delete/restore cannot implement safe exact-note deletion. See the required server contract below. |

## Implemented human journey — C067

The profile-owned `app/main/draft-notes.js` service now retains library owner, exact draft ID, published ID, perspective, integer Paper revision and opaque document revision. Managed-local New Page, foreground reads/ops, complete catalog and body search use it. Remote envelopes are validated; writes never substitute a published twin. See [C067 evidence](../cycles/C067-ordinary-paper-notes.md) and the [native gallery](../visual/paper-notes/README.md).

The native journey creates through New Page, types title/body in the real canvas, selects a body-search result, switches between profiles with identical draft IDs, and restarts into the original row. Creation persists the request before dispatch and a nonce before the POST; uncertain retries only read the same row, including after service reconstruction. A real lost-response probe confirms no second mutation. Missing readback remains unresolved; it never authorizes a fresh POST. Manual/cloud creation and legacy data keep their existing paths.

C069 connects API and MCP creation/edit/Undo to this same owned service, with atomic receipts and exact row/revision checks. The new shared paper-tools adapter captures the runtime profile; managed MCP tools do not seed legacy notes. [C069 native acceptance](../visual/agent-notes/README.md) proves chat activity, profile return, restart and visible Undo; later human edits remain unchanged when stale Undo refuses. Do not bypass publishing walls, republish draft notes automatically, or translate opaque revisions into Paper integer revisions.

## Deletion prerequisite — C070

The [disposable audit](../cycles/evidence/C070/deletion-audit/audit.json) made33 HTTP exchanges against30c007e43. It reproduced three unsafe results: deleting `drafts.welcome` also removed published `welcome`; the receipt named `welcome`; replaying retained restore replaced a newer human title. Stale-before-request deletion correctly refused412. That passing case does not prove a race is fenced: `Mutations.apply_one` checks the caller's opaque revision, then `Lifecycle.do_delete_document` reads both rows again and fences against those newer reads. The intervening-write risk is inferred from source, not a forced race result.

C070 required an **exact-row, atomic caller-revision delete**, without changing the legacy both-variant operation for its other callers. C071 implements this contract on the isolated upstream lane (below); it remains unmerged:

- Require the exact draft row and nonempty opaque `_rev`; no bare-ID normalization, sibling fallback or integer-revision conversion.
- Compare the caller's revision at the actual delete boundary. A human write between initial read and delete must either survive or cause a precondition refusal. Test that interleaving on the server; a client preflight cannot close it.
- Retain the deleted snapshot and return the exact removed identity/revision. Row removal, revision evidence and mutation event must succeed or roll back together. Never infer which row was removed from a200 response alone.
- Distinguish missing, stale, inaccessible and uncertain outcomes. A lost reply never authorizes another destructive request against a recreated identity. Test a missing draft beside a published twin, two twins, concurrent edits, snapshot/event failure and lost acknowledgement.

The owned Barkdown journal must persist profile/library/exact row/revision and deletion intent before dispatch; preserve Pages, favorites, tabs, media and receipts as recovery evidence. Disable deletion while unsaved canvas/title work exists. A server refusal must retain the note and organization. Archive still means unplaced notes, not deleted notes.

For the first recovery action, use **Recover a copy** with an explicitly new identity and creation-only collision handling. The audit proves one native-block snapshot can be copied while preserving later human edits on both original and copy; repeating create refuses409/422 rather than replacing either. It does not prove a durable recovery adapter. Persist one request identity and content nonce before the create, reconcile a lost reply by exact readback, and refuse a changed intent. Do not serialize through Markdown or claim original links/placement are restored. Let the person choose where to place the copy; retain the original recovery record. Same-identity restore requires a separate atomic guard before it can be offered.

Reproduce on Windows with a built, clean source checkout; the script creates and stops its own private database and has no remote-server option:

```powershell
node scripts/audit-paper-deletion.mjs --source C:/path/to/built-barkpark --output C:/path/to/new-audit-directory
```

Exit0 means the generic audit executed successfully. Its `safeToExposeDeletion=false` still correctly rejects using generic delete/restore. Preserve this compatibility audit; C071 separately validates the new operation without changing existing both-variant semantics.

## Implemented deletion and copy recovery — C071

Upstream ae6065545 adds `deleteExactDraft` with exact `drafts.*` ID, type and nonempty opaque `ifRevisionID`. Its SQL fence uses the caller-checked row; removal, retained revision and mutation event share a transaction. Forty-seven focused tests cover twin preservation, missing/stale/foreign IDs, an independently committed intervening human edit, history/event faults, batch rollback and anonymous/read-only refusal. This route is additive and unmerged; older servers fail closed.

Barkdown c6e3df7 retains a profile/library-owned native snapshot before dispatch. Sent intents never replay a delete. An absent row requires matching retained deletion history before it is called deleted; unknown outcomes stay explicit. Recover a copy persists one new creation identity and nonce, preserves native fields/blocks/media references, and reconciles by exact readback. It never invokes unconditional restore or rewires original references.

[Real HTTP proof](../cycles/evidence/C071/deletion-contract-1790285839665.json) covers committed lost replies, stale refusal, published-twin preservation, recreated-original safety and later copy edits. The [native gallery](../visual/paper-deletions/README.md) proves typed content, confirmation, unavailable original tab, retained Page/favorite, restart, narrow recovery and completed repeat navigation. Fault/lease/owner/corruption cases are separately tested in the journal suite. Retained snapshots are not a cross-device export format.

## Remaining acceptance

Crash-boundary recovery beyond the demonstrated journal cases, full multi-writer conflict handling, native profile switches during in-flight ordinary-note creation/deletion and migration activation remain unproved. C067 covers human typing/search/restart, same-ID profile isolation, stale revision refusal and durable lost-response readback. C060 Archive classification and C059 ownership remain separate accepted boundaries. A2 stays open.
