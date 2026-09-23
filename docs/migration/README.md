# Local notes → Paper: preparation, not migration

Preparation for Task 4, 2026-09-23. C039/P1 are accepted and merged. C043 now implements the first bounded offline preparation slice. No real library was read or modified. No Paper publish, media upload, server round trip, interruption recovery or rollback was performed by this harness.

Run from the repository root:

```powershell
node docs/migration/audit.mjs docs/migration/report.json
```

The checked report records the source commit and normalized source hashes. The harness imports the production converter, checks hand-authored expected structures/refusals, checks source immutability and refuses unsupported documents even after a valid prefix. It also checks a **proposed** deterministic profile-qualified identity mapping against two synthetic profiles with colliding document slugs. This is not proof of production allocation, navigation rewriting or server idempotence.

Current result: **22 cases: 10 representation-preserved, 5 lossy, 1 unresolved reference, 6 rejected. Cutover is not ready.** A passing audit means the limitations remain visible; it does not make the lossy cases acceptable.

## Content and identity inventory

| Area | Current authority / preparation decision | Remaining proof |
| --- | --- | --- |
| Identity | Local `documents/<id>.json`; target proposal hashes profile UUID + source document ID, not title | Persist mapping before any write, check target collisions and owner; never adopt unrelated same-slug content |
| Text/marks | Unicode, nested emphasis, underline, strike, code, link and hard-break fixtures | Actual Paper save/reload semantic comparison, not Markdown equality |
| Headings/paragraphs/lists | Current converter drops heading marks, clamps level 6, drops paragraph alignment and list start | Lossless mappings or preflight refusal; no silent conversion |
| Quotes | Existing convenience converter changes quote to note callout | Genuine quote mapping and visual verification |
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

After A1 acceptance, open a new cycle for a disposable-profile **inventory + preflight + durable manifest** implementation. No authority switch. Acceptance: exact backup readback, full structural refusal reporting, stable IDs across restart/two runs, source-change detection and no mutation on unsupported content. Resolve the target create/idempotency contract before advancing to server writes. The following slice proves real Paper save/reload, interruptions and rollback with screenshots/GIFs of actual output.

Preparation changelog: added the 22-case converter audit, two-profile identity/organization inventory, API limitations and proposed recovery boundaries. Runtime/capture inputs are unchanged; existing approved login/Paper evidence is reused. Task 4's later migration rehearsal remains outstanding.
