# Local notes → Paper: staged rehearsal, no cutover

P1 is accepted. P2 remains active: the app still uses legacy local documents alongside real Paper. No real library has been migrated and the legacy editor remains available. [Current cycle](../cycle.json), [handoff](../NEXT-AGENT.md), [A2 acceptance](../ACCEPTANCE.md) and [validation](../VALIDATION.md) own the current queue and evidence.

## Implemented and demonstrated

| Boundary | Implementation and evidence | Limits |
|---|---|---|
| Inventory and exact backup | C043 captures documents, workspace, attachments, receipts and proposals with a pinned source hash; [preparation](../cycles/C043-migration-preflight.md) | Caller must close source writers; unsupported content blocks staging. Settings, credentials and runtime database are excluded. |
| Profile-qualified identities and creation | C044/C045 use an immutable plan, source/profile-qualified IDs, an upstream create-only route, durable intents and exact readback; [staging](../cycles/C045-migration-staging.md) | Unmerged upstream dependency. Existing unowned, changed, missing or draft targets refuse; no automatic replay of an uncertain absent write. |
| Native content | C046–C048 prove21 supported cases through actual typing, acknowledged save, exact saved Undo, reload and restart; [content proof](../cycles/C048-quotes-nested-lists.md) | Plain/rich text, marks, H1–H3, alignment, code language, bounded tables, quotes and recursive mixed/check lists. Deeper headings, custom list starts, table spans/widths, multi-paragraph quotes and inline CR remain refused. |
| Internal links/backlinks | C049 resolves canonical same-profile links against the complete captured library; [reference proof](../cycles/C049-internal-references.md) | Missing/malformed/foreign targets refuse. Native source link-default attributes need separate compatibility proof; source navigation is not activated. |
| Owned media | C050 journals a single PNG upload attempt, reconciles scoped metadata and exact bytes, and checks media again before completion; [image proof](../cycles/C050-owned-images.md) | Top-level eight-bit non-interlaced grayscale/RGB PNG±alpha, alt and width only. Height/captions, external downloads and other formats refuse. Origin must remain stable. |
| Retained backup restore | C051 validates all committed backup bytes before restoring to an empty owned destination. Process interruption/resume and actual restored-profile editing/restart pass; [restore checkpoint](../cycles/C051-backup-restore.md) | Closed same-machine profile at its original path; no live restore UI, authority switch, Paper edit rollback or power-loss claim. Full cycle closeout is still pending. |

[Reviewed screenshots and motion](../visual/migration/README.md) keep content, references, images and restored-legacy evidence distinct. Actual server readback and filesystem checks establish preservation; screenshots alone do not.

## Audited target contract

The implementation calls the selected owned loopback runtime and production dataset. It never changes global CLI configuration or silently enables writes.

- `POST /v1/plugins/bulldocs/papers/:slug/create` is the native-block insert-only route in stacked draft [PR #20020](https://github.com/FRIKKern/barkpark/pull/20020), currently tested at30c007e43. Existing published/draft targets refuse. C044 tested three six-caller races and dropped post-commit responses. A concurrent generic draft is not namespace-reserved; final verification still checks ambiguity.
- The older `POST /v1/plugins/bulldocs/papers` route is create-or-replace without an `ifRev` fence. Generic createIfNotExists+publish also overwrote published content in the C044 audit. Neither is a migration retry mechanism.
- Paper `/ops` requires a captured valid revision for guarded editing. Stale revisions return412. A response is not a content comparison; read back the structured blocks and acknowledged revision.
- Existing multipart media upload has no audited idempotency key. C050 records a random owned filename before one POST, searches that exact scoped name, requires a complete single match and verifies MIME/size/path/original bytes. Absent or ambiguous interrupted uploads stop for reconciliation; they are never replayed automatically.
- Quality, registered tags, scope and deduplication can refuse publishing. Supply reviewed metadata; do not bypass those checks or reinterpret every409 as an existing owned Paper.

Runtime bindings, source/backup hashes and existing journal records are checked before requests and again at completion. This is observed validation under caller-provided quiescence, not a cross-service atomic snapshot or power-loss guarantee.

## Remaining activation and recovery work

1. Audit content actually persisted by the legacy editor and Markdown parser, including default link/list attributes. C051 found ordinary Markdown links carry `target="_blank"`, currently refused; do not silently strip custom metadata.
2. Inventory and validate every real workspace destination: human Pages order/nesting/expansion/archive state, favorites, document tab paths, side-chat parents, drafts/images and event references. Existing `bp:` destinations are not new imports.
3. Prepare a versioned reference map. Rewrite exact local document destinations only, retaining all unrelated state. Atomically select one complete map after all target comparisons pass; crash/restart must never select a mixture. No adapter currently activates this map.
4. Keep original history, proposals and edit receipts readable. Legacy revision numbers cannot become Paper revision numbers. Do not reinterpret an old guarded Undo against a staged Paper.
5. Prove activation and rollback with interrupted writes and concurrent human edits. Rollback selects retained legacy authority; it does not delete or overwrite possibly edited Paper targets. Retire the separate editor only after the full supported corpus and A2 journey pass.

Other content formats, live writer fencing, target conflict resolution and cross-machine paths remain explicit gates. Cross-machine export/import and database portability belong to P3; a copy of live database files is not an export contract.

## Reproduction and source boundaries

`app/main/migration-preflight.js` owns inventory/eligibility; `migration-staging.js`, `migration-media.js` and `migration-journal.js` own durable target staging; `migration-restore.js` owns exact no-overwrite legacy recovery. These are offline adapters, not a user-facing migration flow. `app/shared/portabledoc.js` remains a convenience converter whose context-free acceptance is not migration eligibility.

Run targeted checks from the repository root:

```sh
node --test app/tests/migration-preflight.test.mjs app/tests/migration-staging.test.mjs app/tests/migration-media.test.mjs app/tests/migration-restore.test.mjs
node docs/migration/audit.mjs
```

Native scripts `test:migration-editor:isolated`, `test:migration-references:isolated`, `test:migration-media:isolated` and `test:migration-restore:isolated` use a clean built private Barkpark selected with `BARKDOWN_TEST_BP_SOURCE`. They create disposable data and stop only their owned runtime. Follow the implementation-commit → capture → actual review → evidence-commit workflow.

The separate [converter report](report.json) has32 synthetic cases:21 representation-preserved,2 lossy,2 unresolved references and7 rejected. It records hand-authored expectations/source hashes and proposed identity inventory; it is not native save or workspace activation evidence. C049/C050 resolve selected references/media only inside the complete captured-profile migration path. Historical cycle records preserve earlier findings and failures; they are not extra active queues.
