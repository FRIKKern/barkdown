# C083 writer census at upstream `1c6c3f21`

Read-only source survey of `api/lib/` in the C083 lane (`codex/managed-write-wiring`, worktree from the C082 merge). Line numbers are for that commit. This is a bounded inventory for wiring design, not proof that every writer is covered; the grep counts in §7 include some comment matches.

## Coordinator facts that shape the design

`Barkpark.ManagedRuntime.WriteAdmission` binds every ticket to the **calling pid** (`{owner, _}` from the GenServer call). Nested checkouts in the same pid nest; a checkout from any other pid is a new owner, refused while closing or held. Nothing starts it: it is absent from `application.ex`. `instance_id` appears nowhere else.

Name collision: "managed runtime" already means Studio Chat's Codex runtimes (`studio_chat/runtime_admission.ex`, `:managed_runtime_admission`, `{:managed_runtime_capacity, n}`, `max_managed_runtimes` in `config/test.exs:345`). New config keys, error codes and capability flags must use another name, e.g. `write_admission`.

## 1. `Content.Mutations.apply_mutations/3` (`content/mutations.ex`)

- Public door `Content.apply_mutations` (`content.ex:321`) → `mutations.ex:91`, telemetry span 104–111, `do_apply_mutations` at 114.
- `Broadcast.claim_deferred_queue()` at 121; `Repo.transaction` opens **125**, closes 159. Inside: global audit-chain lock (126), `apply_one` per mutation (141–156), `Repo.rollback` on first error (154). After commit `flush_deferred_broadcasts` (163). A failed batch runs `compensating_discard` (168 → 378) **outside** the transaction. `rescue` at 170 reraises except tsvector overflow.
- `apply_one` goes through the `Content.*` facade only, never BlockOps:

| Mutation | Lines | Calls |
|---|---|---|
| create / createOrReplace / createIfNotExists / replace | 451, 477, 496, 602 | `Content.create_document` |
| patch (both clauses) | 660, 697 | `Content.upsert_document` |
| publish | 502 | `Content.publish_document` (Lifecycle) |
| unpublish, discardDraft, deleteExactDraft | 532, 537, 542 | Lifecycle |
| delete | 549, 575 | Lifecycle delete |
| patch on a `task` | `land_patch` 1066 | also `Content.publish_document` |

- Nesting: Writer's `Broadcast.write_atomically` (`broadcast.ex:298`) and Lifecycle's `Repo.transaction` join the open outer transaction (`Repo.in_transaction?` at broadcast.ex:299).
- Callers: `controllers/mutate_controller.ex:23`; `content/papers/value_writeback.ex:159`; `sync/applier.ex:208`, which runs inside the **`Sync.Worker` GenServer** (`sync/worker.ex:26`), not a request pid.

## 2. `Writer.create_document/4` (writer.ex:202) and `upsert_document/4` (writer.ex:790)

- No transaction around the whole call. Fences, dedup, before_save hooks, encryption and paper-body render run outside any transaction. Only row write plus event row sit in `Broadcast.write_atomically`: create at 494/536 (`Repo.insert` 539), upsert at 1047/1070 (`Repo.insert` 1073). Plain updates use `fenced_or_plain_update` (1919, `update_all` 1945). `write_atomically` opens a transaction only when none is open.
- after_save: `finish_deferred_after_save` (558) calls `WriteScope.fire_after` synchronously; plugin hooks then run in `Task.async_stream` children (hazard A). `defer_after_save` (1088/1106) parks it in the process dictionary; only BlockOps collects it (block_ops.ex:2011, 2021).
- Callers (call sites in parentheses):
  - Contexts: `content/mutations.ex` (6); `content/revisions.ex:257` restore; `content/papers/block_ops.ex` (2446, 2894); `content/forms.ex`; `content/tag_registry.ex`; `tasks/fleet.ex`.
  - Media: `media.ex`; `media/processing.ex` (2); `media/storage/{share,collections}.ex` (2 each); `media/storage/checkout.ex`; `media/delivery/cdn.ex`.
  - Plugins: `plugins/tickets/thread.ex` (2); `plugins/tickets/attachments.ex`; `plugins/sheets/session.ex`; `plugins/sheets/web/import_controller.ex`; `plugins/media/assets.ex`; `plugins/media/stuck_processing_sweeper.ex` (Oban); `plugins/github/{link,intake,adopt}.ex`; `plugins/forms/intake.ex`; `plugins/bulldocs/masters.ex`.
  - Web: `controllers/legacy_controller.ex`; `controllers/bulldocs_form_controller.ex`; `controllers/v1/media_processing_controller.ex`; `live/studio/studio_live/handlers/fields.ex`; `live/studio/studio_live/shared/paper.ex`.
  - Mix: `lib/mix/tasks/onix.import.ex`.

## 3. `Content.Lifecycle` (`content/lifecycle.ex`)

All entry points wrapped in `span_write` (64), telemetry only. Lifecycle never calls create/upsert_document; its writes are raw `Document.changeset |> Repo.*`.

| Function | Line | Write |
|---|---|---|
| `publish_document` | 79 | `write_atomically` (363) → `Repo.transaction` (364) → `Repo.update`/`Repo.insert` (403/406) |
| `unpublish_document` | 822 | `Repo.transaction` 875 |
| `discard_draft` | 924 | `fenced_delete` |
| `delete_document` | 971 | `Repo.transaction` 1005 |
| `delete_exact_draft` | 1056 | `Repo.delete_all` 1128 |

Write after commit, outside the transaction: `publish_after_commit` (505) → `tap_supersession_stamp` (518/727) → `stamp_superseded_by` bare `Repo.update` at **771**. Restore is `Content.Revisions.restore_revision/4` (revisions.ex:248; facade content.ex:636) via `upsert_document`.

## 4. BlockOps, ingest controller, guards

`content/papers/block_ops.ex`:

| Entry | Line | Write |
|---|---|---|
| `upsert_blocks_doc/3` | 119 | Paper leg (125) takes no lock; non-paper/session leg `Repo.transaction` (163) with advisory lock; rows via `persist_blocks_doc_serialized` (639) inside `write_atomically` (699), `Repo.update`/`insert` (784/786) |
| `upsert_paper` | 438 | → `upsert_blocks_doc` |
| `apply_paper_block_op` | 946 | `fenced_or_plain_paper_update` (1029 → 2269): **bare autocommit `Repo.update` 2272/2279 or `update_all` 2315, no transaction** |
| `apply_paper_block_ops` | 1101 | batch of the above, single persist |
| `apply_paper_block_ops_once` | 1128 | `Repo.transaction` 1148 |
| `apply_paper_contextual_history_once` | 1215 | `Repo.transaction` 1256 |
| `apply_paper_block_form_once` | 1350 | `Repo.transaction` 1384 |
| `apply_document_block_op` | 2376 | `Content.upsert_document` |
| `apply_document_block_op_once` | 2501 | `Repo.transaction` 2538 |
| `apply_document_block_form_once` | 2626 | `Repo.transaction` 2672 |
| `apply_field_block_ops` | 2862 | `Content.upsert_document` |

Edge-projector enqueue after raw writes near 4963.

Ingest controller `controllers/bulldocs_ingest_controller.ex`, routes router.ex 1302–1307 through `:ingest` = `RequireIngestToken` (router.ex:978–980): `ingest` 761 → `Content.upsert_paper` 873; `ingest_html` → `MixedWriteGuard.check` **1022** then `upsert_paper` 1039; `create` 720; `sync` 264 (`apply_paper_block_ops` 384; `upsert_paper` 559); `apply_op` 1435/1450 (1464, 1548); `ingest_session` 1119; `apply_session_op` 1228; `append_session_event` 1322; `touch_session_conversation` 1370; `propose` 1677.

Neither guard fronts every Paper write. `MixedWriteGuard.check/1` (mixed_write_guard.ex:119) is a plain call used only at controller line 1022 and by its own doc excludes `/v1/data/mutate`. `PreGateRegister` is a render badge annotator (`annotate/3` 157, `badge/2` 132), not a guard. No reusable plug or wrapper exists.

Other BlockOps/paper callers: `studio_chat/plan_papers.ex`, `seeds/clean.ex`, `playground_controller.ex`, `live/bulldocs_live/edit.ex`, `studio_live/paper_canvas.ex`, `studio_live/components/paper_editor.ex`, `studio_live/shared/paper.ex`, `portable_doc/table_editing.ex`, `plugins/bulldocs/masters.ex`, `content/papers/{proposals,backfill_block_ids}.ex`.

## 5. `reader_source/3` → `refresh_html_cache` (write on GET)

`papers.ex:126` → `classify_reader_source`; `{:stale, rendered}` branch calls `refresh_html_cache` at **249**, defined **388–412**: `Document.changeset` + `optimistic_lock(:rev)` + **`Repo.update()` 403**, autocommit, errors swallowed (404–408), bypasses Broadcast and event rows. Reached from `live/bulldocs_live.ex`, `controllers/{bulldocs_source,bulldocs_email,scoped_paper,share_link}_controller.ex`, `studio_live/shared/paper.ex`. Under a hold: skip the persist and serve the derived result, or refuse; refusing turns reads into errors.

## 6. Media

- `Media.upload/3` (media.ex:66); callers `controllers/media_controller.ex:155`, `controllers/v1/media_controller.ex:460`, `studio_live/handlers/media.ex:83`, `plugins/tickets/attachments.ex:269`. Order: blob `Blobstore.put_file` **191** → row `Repo.insert` **212** (no transaction) → blob deleted on insert failure (231) → `Plugins.Registry.run_after_media_upload` **216** (`plugin_callbacks.ex:272`, synchronous `Enum.each`, same pid) → `Plugins.Media.after_media_upload` (plugins/media.ex:84) → `Assets.ensure_for_upload` (`create_document`) then **`Processing.process/1` synchronously** (plugins/media.ex:88).
- `Media.delete_file/2` (media.ex:691); callers the two media controllers (844, 623), `tenancy.ex:2320`, ticket attachments. Row + asset doc share `Repo.transaction` **838** (`Repo.delete` 839, `run_after_media_delete` 852 inside). Blob delete (`Blobstore.delete` 733) is queued via `defer_media_effect`, runs after commit, deferred again if an outer transaction is open (895).
- `Media.put_blob/3` (1001): `Blobstore.put_bytes` 1119, from `media_controller.ex:687`.
- `Processing.process/1` (`media/processing.ex:16`), no transaction, IO between writes: `set_status` → `upsert_document` 100; probe → `upsert_document` 75; `Renditions.generate_all` (`renditions.ex:77`) writes local disk files (140–144; Magick backend `Task.async` at magick.ex:67 for the shell-out only); `set_status` again; `Cdn.publish` via `Task.Supervisor.start_child` (cdn.ex:109); `Events.dispatch` via `Task.Supervisor` (delivery/events.ex:51).
- Sweeper `plugins/media/stuck_processing_sweeper.ex`: `use Oban.Worker` queue `:default` (101), `perform` 142, `sweep` 152, `upsert_document` 289, `Processing.process` 317; cron every minute via `oban_crontab` in plugins/media.ex.

## 7. Other direct writers (grep count, includes some comments)

About 125 files match `Repo.insert*/update*/delete*/transaction`, `Ecto.Multi` or `Oban.insert` outside §1–6:

| Area | Files |
|---|---|
| tasks/ | 19 |
| barkpark root modules | 18 (access, accounts, application, audit, auth, cycle_fleet, epic_fleet, idempotency, preview_token, pulse, release, scim, secrets, sso, status, studio_chat, tenancy, webhooks) |
| content/ | 17 (broadcast, codelists, dedup_wall, edges, exemptions, labels, paper_access, schema, schema_definition, sessions, sheets, tag_registry; papers/{backfill_block_ids, composition_migration, doctrine_backfill, proposals}) |
| plugins/ | 16 |
| tenancy/ | 6 |
| barkpark_web | 5 controllers (bulldocs_ingest, export, scim_groups, tasks, v1/media) + chat_live, shared/paper, require_ingest_token plug |
| sync/ | 5 |
| mix tasks | 4 |
| smaller | sso 4, search 4, studio_chat 3, webhooks 2, sharing 2, seeds 2, media 2, edge_projector 2, auth 2, accounts 2, workers/findability_posttest, repo/idempotency_store, crypto/data_keys, chat_hosts/context, audit/export |

22 `use Oban.Worker` modules: `workers/{tag_distribution, findability_posttest, smoke, search_analytics_prune, search_analytics_crystallize}`, `content/workers/paper_access_sweeper`, `search/workers/{crystallize, prune}`, `tenancy/workers/playground_reaper`, `tasks/{ttl_sweeper, compactor}`, `auth/{rotation_retire_worker, login_ticket_sweeper}`, `plugins/onixedit/bokbasen/publish_worker`, `plugins/github/{retire_job, mirror_job}`, `plugins/indx/indexer_worker`, `plugins/media/stuck_processing_sweeper`, `pulse/sweep_worker`, `idempotency/sweeper`, `edge_projector/projector_worker`, `preview_token/sweeper`, `audit/export_worker`, `webhooks/{stuck_delivery_sweeper, retry_worker}`. Plugin cron entries fold into Oban at application.ex:112–119.

## 8. Opt-in and capability surface

- `Barkpark.Capability` (`capability.ex`) is the operator on/off switch for Chat, CycleFleet, EpicFleet (`enabled?/1`, own supervisor, `RequireCapability` plug): the closest existing opt-in pattern.
- `GET /v1/capabilities` (router.ex:2110) → `CapabilitiesController.index` (24) → `Plugins.Capabilities.manifest/2` (plugins/capabilities.ex:119), root map 309–322, `default_server/0` 634. Released `bp` binaries strict-decode the manifest (comments 56–57, 342–351), so no unconditional new key. Follow the `maybe_put_build` / `maybe_gate_chat` pattern with an explicit include option, or expose on `/status.json` (router.ex:2093, `Barkpark.Status`).

## 9. Test setup

`test/test_helper.exs`: `ExUnit.start(exclude: [...])` 50; sandbox `:manual` 278. `test/support/data_case.ex` `setup_sandbox/1` (87) with `shared: not tags[:async]`; `conn_case.ex:151`. Oban `testing: :manual` (`config/test.exs:167`); use `Oban.Testing.with_testing_mode(:inline, …)`. Postgres required: `localhost`, `postgres`/`postgres`, `BARKPARK_TEST_DB_{HOST,USER,PASS}`, port 5432, database `barkpark_test_wt_<dirname>_<hash>` per worktree unless `MIX_TEST_PARTITION`/`CI`; `mix test` alias runs `ecto.create` + `ecto.migrate` (mix.exs:177). The existing admission test is `async: false`, tmp DETS, no DB.

## 10. `api/CLAUDE.md` and error codes

Only the Key files row for `write_admission.ex` is relevant; update it once wired. HTTP refusal codes go in `Content.Errors` `@hints` (append anchor at `quota_exceeded`, errors.ex ≈111–114, `scaffy/commands/add-error-shape.scaffy`) or `@public_inline_codes` (131); `Content.ErrorCodes` is the validation-rule registry, not HTTP. Adding a code requires regenerating OpenAPI (`openapi_test.exs`, `docs/openapi.json` drift gate), documenting in `docs/api-v1.md` §9 or `docs/api/error-codes.md` (`errors_doc_coverage_test.exs`), keeping `error_code_coverage_test.exs` green, and one HTTP status per code (`internal/cli/errors.go`, `errors_api_parity_test.go`).

## Hazards for pid-bound tickets

- **A. Hooks run in other pids, synchronously, inside open transactions.** `Plugins.Hooks.fire` uses `Task.async_stream` (hooks.ex:79–87); `WriteScope.fire_after` (write_scope.ex:747) is synchronous, so under `apply_mutations` hooks run while the outer transaction is open, from child pids with their own DB connections. A request-pid ticket does not cover them.
- **B. Autocommit or partial writes with no transaction to wrap:** `apply_paper_block_op` (2272/2315), `refresh_html_cache` (papers.ex:403), `stamp_superseded_by` (lifecycle.ex:771), `compensating_discard` (mutations.ex:378), `Media.upload` (191 blob, 212 row), `Processing.process` (three upserts around disk IO). Admission must be taken at the door functions, not around `Repo.transaction`.
- **C. Writers outside a request pid:** `Sync.Worker` (sync/applier.ex:208); 22 Oban workers including the media sweeper; projector jobs from `EdgeProjector.Lifecycle.enqueue_rebuild`; `Task.Supervisor.start_child` from `paper_access.ex:99`, `media/delivery/{events.ex:51, cdn.ex:109}`; hook children (A).
- **D. Nesting is common:** `apply_mutations` → `create_document` → `write_atomically`; `Media.upload` → hook → `Processing` → `upsert_document`. Either the outer door checks out once and inner doors nest, or inner doors also check out; both already work within one pid.
- **E. Blob side effects:** upload bytes land before the row; delete bytes are removed after commit via the deferred queue (media.ex:895). A hold that ignores deferred blob effects can see file changes after the database has quiesced.
