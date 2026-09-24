# Local notes → Paper: staged rehearsal, no cutover

C039/P1 are accepted and merged. C043 implements offline preparation; C044 proves a create-only upstream route; [C045](../cycles/C045-migration-staging.md) staged the then-permitted ten cases into a disposable Paper runtime with durable intent and post-commit process-exit reconciliation. No real library was read or modified. C046 now proves all ten initial cases through native editing, exact saved Undo, reload and Electron restart, including native Shift+Enter. LF inline breaks use the corrected upstream serializer; unproved CR carriers remain refused. References/media, expanded editor coverage, navigation activation and rollback remain gates. The converter audit below is a separate preparation harness.

Run from the repository root:

```powershell
node docs/migration/audit.mjs docs/migration/report.json
```

The checked report records the source commit and normalized source hashes. The harness imports the production converter, checks hand-authored expected structures/refusals, checks source immutability and refuses unsupported documents even after a valid prefix. It also checks a **proposed** deterministic profile-qualified identity mapping against two synthetic profiles with colliding document slugs. This is not proof of production allocation, navigation rewriting or server idempotence.

Current converter result: **32 cases: 21 representation-preserved, 2 lossy, 2 unresolved references, 7 rejected. Cutover is not ready.** The original ten cases pass C046 native-editor proof. C047 mappings preserve marked headings and top-level alignment; all sixteen cases pass native editing, exact saved Undo, reload/restart and interrupted API staging. Full desktop/root and fresh live/fixture visual closeout pass; [C047 results](../cycles/evidence/C047/results.json) retain proof and limitations. C048 adds genuine rich quotes and recursive mixed lists: all 21 cases pass native typing/save/exact Undo/reload/restart and interrupted staging. Reviewed motion includes full list Shift+Enter and narrow nested hierarchy; standard visual/root closeout now passes. Other structures and unresolved references remain refused. A passing audit means the limitations remain visible; it does not make the lossy cases acceptable.

## Content and identity inventory

| Area | Current authority / preparation decision | Remaining proof |
| --- | --- | --- |
| Identity | Local `documents/<id>.json`; target proposal hashes profile UUID + source document ID, not title | Persist mapping before any write, check target collisions and owner; never adopt unrelated same-slug content |
| Text/marks | Unicode, nested emphasis, underline, strike, code, link and hard-break fixtures | Actual Paper save/reload semantic comparison, not Markdown equality |
| Headings/paragraphs/lists | C047 preserves heading marks/alignment; C048 preserves recursive list children and checked state; deep headings and custom starts remain refused | Lossless mappings or preflight refusal; no silent conversion |
| Quotes | C048 uses genuine native blockquote content and preserves rich marks | Multiple paragraphs and inline quote breaks remain refused |
| Tables | Header and cell alignment structured; spans/widths rejected | Real editor/server persistence and geometry; preserve unsupported source |
| Media | Synthetic attachment bytes and SHA-256; image conversion currently rejected | Upload acknowledgement, target readback and interrupted-upload reconciliation |
| Links/backlinks | Legacy `barkdown://doc/<id>` and references require profile-qualified resolution; backlinks derived | Rewrite only resolvable targets, retain unresolved source, compare graph after reload |
| Pages | Preserve v2 roots, child order, expanded and archived state; existing `bp:` destinations are not new imports | Atomic reference-map activation, no automatic placement of loose cloud content |
| Favorites/tabs/chats | Inventory local destinations, document paths, parent side chat, drafts/images and event references | Rewrite exact document references only; retain chat/run ownership and draft content |
| History/proposals | Local snapshots (bounded history, currently 60), pending proposals carry legacy revision semantics | Retain readable originals; no claim that Paper recreates historical revision identities |
| Edit receipts | Before/after revisions and original content support guarded Undo | Do not reinterpret old receipts against Paper revisions; retain legacy reader/Undo boundary |

The synthetic library is intentionally small. Its workspace is an inventory fixture, not a validated production workspace serialization. `report.json` records source hashes, output blocks, limitations, proposed IDs, backlinks and attachment digests. It does not claim a workspace migration adapter exists.

## Audited API contract

Read-only upstream audit: Barkpark commit `bf23f773ce59ef148a6e6eeb1374f64d9e2aa81f`, `api/lib/barkpark_web/controllers/bulldocs_ingest_controller.ex`, router and `api/assets/paper-editor/src/convert.js`. Local boundaries: `app/main/documents.js`, `agent-edits.js`, `barkpark.js`, `app/shared/portabledoc.js`, `app/renderer/src/pages.js`.

* `POST /v1/plugins/bulldocs/papers` is **create-or-replace without a revision fence**. The controller explicitly rejects `ifRev`/`if_rev`. Its slug/rev response is an acknowledgement, not a content comparison. Do not use blind retries or pretend a prior GET makes creation atomic. A create-only/idempotency or equivalent exclusive-ownership contract remains unresolved.
* C044 reproduced the generic mutation hazard at `bf23f773`: createIfNotExists + publish replaced existing published content; six concurrent draft attempts returned two distinct create receipts. Do not use these verbs for migration.
* [C044](../cycles/C044-paper-create-contract.md) tests the new native-block `POST /v1/plugins/bulldocs/papers/:slug/create` at upstream `15bfe254a`, [draft PR #20020](https://github.com/FRIKKern/barkpark/pull/20020). Existing published/draft targets refuse; the row write only inserts. Three six-caller races had one winner each, and a dropped post-commit response was reconciled by exact readback without replay. This is an unmerged upstream dependency, not a production migration adapter. Concurrent generic draft creation is not namespace-reserved; staging must detect ambiguous or changed targets before activation.
* `POST /v1/plugins/bulldocs/papers/:slug/ops` supports `ifRev`; stale revisions return 412 before any operation applies. Capture and validate the returned revision and read back the resulting blocks. Do not treat missing/non-finite adapter revisions as a successful migration checkpoint.
* Media uses the existing multipart upload or CLI media adapter. No audited content-hash deduplication or lookup contract establishes safe retry after a lost response. Stop for reconciliation instead of uploading duplicates speculatively.
* Upstream conversion retains heading/paragraph source metadata that the local convenience converter discards. The current local converter therefore cannot be the unconditional migration path.
* Authentication, dataset scope, quality checks and deduplication can refuse a publish. Do not silently enable `dedup_bypass`, change scope or weaken checks to make a rehearsal pass.

## Proposed durable boundaries and recovery

1. **Inventory and backup:** quiesce writes to the disposable source profile, capture exact authoritative JSON, workspace references, referenced attachment bytes and receipts with checksums. Record schema/source versions. Preserve the original tree and verify the backup can be read. Do not package a live database and call it portable.
2. **Preflight:** compare every structured field and reference. Unsupported or lossy cases stop before mutation. Persist a versioned manifest with source hashes, profile identity, proposed targets and planned dependencies. Reject a changed source on resume.
3. **Stage media/content:** only after an audited safe target-write contract exists. Persist intent before request and acknowledgement after validated response. A crash between request and acknowledgement is an **uncertain write**, requiring readback/reconciliation; it is not permission to repeat create-or-replace.
4. **Compare:** reload actual Paper blocks/media and compare identities, marks, semantics and graph. Record target revisions. No navigation authority changes before all comparisons pass.
5. **Activate:** atomically swap a versioned reference map with the old map retained. Interruption must select one complete map. Never remove source documents or backups. Preserve existing cloud placements and human hierarchy.
6. **Rollback:** restore the old map and readable local authority. Retain staged Paper data for reconciliation; do not delete possibly edited targets. If a target changed after comparison, stop automatic rollback of target content and report the conflict.

At each boundary the later harness must crash/restart, run twice, compare counts/IDs/content, and prove no duplicate target or misplaced reference. Include lost acknowledgements, stale revisions, changed source, corrupt manifest, missing media, profile switches and a concurrently edited target. The preparation harness does **not** execute this state machine.

## First bounded P2 slice

[C043](../cycles/C043-migration-preflight.md) implements the disposable-profile **inventory + preflight + durable manifest** slice in `app/main/migration-preflight.js`. Callers must stop source writers; an explicit offline assertion is not a live lease adapter. Preparation preserves source bytes, reports unsupported structures, binds stable target IDs to the profile and detects changed source/corrupt backups on repeat. No authority switch or server writes. Workspace/reference schemas, missing-media reconciliation, target creation and actual Paper save/reload remain subsequent gates.

Preparation changelog: added the 22-case converter audit, two-profile identity/organization inventory, API limitations and proposed recovery boundaries. Runtime/capture inputs are unchanged; existing approved login/Paper evidence is reused. Task 4's later migration rehearsal remains outstanding.

## Durable staging checkpoint

`app/main/migration-staging.js` accepts a prepared offline profile, explicitly reviewed description/tags and captured owned loopback runtime. It validates every existing journal record before target access, records intent before create, compares exact structured readback and revision, and preserves unknown/edited/draft targets. Repeat and six process-exit boundaries are tested. `retryAbsent: true` is an explicit reconciliation decision, never an automatic recovery default. Callers still supply source quiescence and ownership assertions; no production migration UI invokes this module. Originals/history/proposals/workspace remain readable and unchanged.

C046 editor rehearsal found that the old code converter wrote `language`, while real Paper expects `lang`. The converter now emits the native field (omitting empty values); Markdown export still reads historical `language` data. API equality alone did not catch this loss. Existing staging plans whose payload changes are refused, never silently rewritten or replayed. The retained C046 handoff records the correction; C047 adds the sixteen-case proof.
