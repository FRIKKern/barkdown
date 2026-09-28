# C083 direct-writer audit at upstream `fc9a07b11`

Classification of every file under `api/lib/` that contains a direct database or blob write outside the admission doors, at the commit where slices 1 to 3 are merged. Produced 2026-09-28 by three parallel read-only source surveys over the 151 candidate files a grep for `Repo.insert*|update*|delete*|transaction`, `Ecto.Multi`, blob writes and `Oban.insert` returned. Each write site was opened and its callers traced one level; classes are as stored, not inferred from module names.

**Doors at this commit:** `Content.Writer.create_document/4` and `upsert_document/4`; every `Content.Lifecycle` op; `Content.Mutations.apply_mutations/3`; every public `Content.Papers.BlockOps` entry; `Papers.reader_source` stale-cache repair; `Media.upload/3`, `delete_file/2`, `put_blob/3`, `Media.Processing.process/1`; every Oban job via `ObanAdmission`.

**Classes.** COVERED: every write path passes a door or runs inside an Oban job. NEEDS-BOUNDARY: a write reachable from an HTTP request, LiveView event, plug, or a GenServer or Task outside Oban without passing a door. BOOT-OR-ONESHOT: only boot, seeds, release commands or `mix` tasks. FALSE-POSITIVE: comment, schema, or read.

## Totals

| Class | Files |
|---|---:|
| NEEDS-BOUNDARY | 70 |
| COVERED | 11 |
| BOOT-OR-ONESHOT | 16 |
| FALSE-POSITIVE | 54 |
| Total | 151 |

## The 70, grouped by where one boundary would go

| Cluster | Files | One boundary at | Notes |
|---|---:|---|---|
| Task board verbs | 18 | `Tasks.Internal.fenced_content_write/4` and `insert_mutation_event!/1` | Raw rev-fenced `Repo.update_all` plus event insert; every task verb writes through it (claim, close, stamp, pulse, renew, stage, move, release, discharge, landed, mutations, fence, fleet touch). The Oban callers (TtlSweeper, Compactor) are already covered. |
| Sync GenServers | 5 | `Sync.Worker` and `Sync.PushWorker` bodies, or the five row modules (cursor, dead letter, push conflict, push cursor, push doc rev) | Document writes already go through the Mutations door; the bookkeeping rows do not. |
| Studio Chat and fleets | 5 | `StudioChat.Recorder` GenServer and `CycleFleet` / `EpicFleet` | Largest write surface in the codebase; includes a raw `update_all` on `Document` in `cycle_fleet.ex` that bypasses Writer. A dedicated Barkdown instance may not run these at all. |
| Tenancy and workspace admin | 6 | `Tenancy`, `Tenancy.Auth`, `Members`, `Quota`, `WorkspaceBundle`, `DatasetRemap` | Workspace delete, archive, bundle import with raw `COPY` and trigger toggles, memberships, quota. Reachable from `WorkspaceController`, `PlaygroundController`, several LiveViews. |
| Auth, sessions, SSO, SCIM, access | 9 | `Accounts`, `Auth`, `Webauthn`, `Privacy`, `Scim`, `Sso`, `Sso.Social`, `Access`, `ChatHosts.Context` | Includes per-request writes: `RequireUserSession` stamps `last_used_at`, `RequireToken` calls `touch_last_used`. |
| Operator surfaces | 9 | `Secrets`, `Plugins.Settings`, `Plugins.Bootstrap`, `Content.Schema`, `Content.Codelists`, `Status`, `Webhooks`, `Tickets.Keys`, `Sharing` and `Sharing.Links` | Schema CRUD, plugin install and re-seed from the admin LiveView, secrets with audit rows, webhook CRUD plus a dispatcher GenServer writing delivery rows. |
| Per-request side writes | 6 | `Idempotency` plug, `PreviewToken` plug, `Content.Sessions` (session autolog plug and ingest), `Search.Intelligence`, `Search.SurfaceConfigs`, `Search.Synonyms`, `Pulse`, `Audit` | Writes that happen on reads or as request bookkeeping. The idempotency plug claims its row before the controller reaches a door, so a refused write still leaves a row. |
| Content edges of a door | 6 | `Content.Edges.disconnect_references` (StudioLive delete and unpublish), `Papers.Proposals` (ingest propose), `Papers.ValueWriteback`, `Broadcast.save_event` from `staleness_live.ex` and `bokbasen/status.ex`, `Bulldocs.Events`, `PaperAccess.record` (Task) | Writes adjacent to door paths but not inside them. |
| Media | 2 | `Media.Renditions.ensure` (lazy rendition on GET) and the DEK lazy insert in `Crypto.DataKeys` | A GET can write blob bytes; the first encryption per scope inserts a key row. |
| Plugin extras | 4 | `Github.Conflicts.resolve` (OpsLive), `OnixEdit.Bokbasen.Status.write`, `OnixEdit.StalenessLive.acknowledge`, `Plugins.Codelists` | Plugin LiveView events with raw `Repo.update`. |

Counts per cluster sum to more than 70 because a few files sit in two clusters; the file tables below are the record.

## Findings that change the design

1. **Boot writes run inside the `:full` tree.** `SchemaBootstrap` writes schemas and runs codelist seeders directly while the coordinator is up. Those are not one-shot; they bypass the doors on every managed boot.
2. **One-shot tasks are not refused by construction.** The "no coordinator in `:seed` or `:one_shot`" guarantee only refuses writes that reach a door. Every BOOT-OR-ONESHOT row here uses a raw `Repo.*` call and would write on a managed instance. Managed mode needs an explicit refusal for these modes, not an absence.
3. **Two per-request writers precede every door.** The idempotency plug and the session and token `last_used` stamps write before a controller reaches admission. Under a hold they still write. Either they become doors or managed mode accepts them as bookkeeping that is not migration state, recorded as such.
4. **One primitive covers eighteen files.** `Tasks.Internal.fenced_content_write/4` is the single place to admit every task verb.
5. **Sync bookkeeping is the only sync gap.** Document writes from sync already pass the Mutations door; the cursor, dead-letter and push tables do not.

## Not traced in this pass

`Content.upsert_schema` and `delete_schema` (used by controllers, bootstrap and mix); `Media.patch_asset_metadata`; `Content.upsert_paper` (delegates to BlockOps and is therefore covered, but was not verified); `DoctrineBackfill.persist`; `plugins/github/adopt.ex` and `link.ex` as callers of `fenced_content_write`; the caller of `Broadcast.save_event` in `bokbasen/status.ex`. The three SSO connection modules have no production caller and would bypass doors if one were added.

## Policy question this audit puts to the record

The [admission contract](../../../migration/seal-admission.md) allows two answers per writer: participate through a door, or be explicitly disabled or refused in managed mode. Clusters 1, 2, 8 and 9 look like doors. Clusters 3 to 7 are mostly surfaces a dedicated Barkdown instance does not need during a switch, and a managed-mode refusal at the router plus a fail-closed boot check would satisfy the contract's "refused, never silently omitted" rule with far less code than sixty doors. That choice is not the agent's to make alone; it is the next cycle decision.

## Batch A (files under `lib/barkpark/`)

| file | writes (verbs, count) | reachable from | class | note |
|---|---|---|---|---|
| access.ex | insert 1, update_all 1 (claim CAS), update 1 (revoke) | HTTP: AccessController; LiveView: StudioLive handlers access_panel/airdrop | NEEDS-BOUNDARY | Grant mint/claim/revoke; not a door. |
| accounts.ex | insert 3, update ~9 (incl. update!), update_all 6, delete!/delete 3, transaction 3 | HTTP: SessionController, AuthController, OIDC/SAML/Social controllers; plug RequireUserSession (last_used_at stamp on every request) | NEEDS-BOUNDARY | Login, session, TOTP and password writes, all direct. |
| accounts/privacy.ex | transaction 1, delete_all 5, update_all 2, update! 1 | LiveView: Studio AccountLive (`erase_subject`) | NEEDS-BOUNDARY | `export_subject` is read-only; erasure writes directly. |
| accounts/webauthn.ex | insert 1, update 1, delete 1 | HTTP: WebauthnController | NEEDS-BOUNDARY | Passkey register, counter bump, delete. |
| application.ex | none (Repo.query SELECT for pg_trgm) | boot | FALSE-POSITIVE | Read probe; where ObanAdmission is attached and the coordinator is omitted in `:seed`/`:one_shot`. |
| audit.ex | transaction 1, insert 1 (+ advisory-lock query) | HTTP/LiveView: every auth, access and content path that calls `Audit.emit`/`emit_best_effort` | NEEDS-BOUNDARY | Append-only chain insert. Inside a door when content calls it; outside for auth, access and grants. |
| audit/export.ex | insert 1, update 1, update_all 4 | Oban: Audit.ExportWorker (`flush/0`) | COVERED | `create_sink`/`reenable_sink` have no callers in lib (test only). |
| auth.ex | insert 7, update 3, update_all 1, delete_all 3, transaction 3; Oban.insert 1 (enqueue) | HTTP: AppTokenController, LoginTicketController, SessionController; plugs RequireToken, RequireTicketKey, RequireWriteForMutation (`touch_last_used`) | NEEDS-BOUNDARY | Token mint, rotate, revoke, login tickets; `touch_last_used` is a per-request write. |
| auth/api_token.ex | none (comment) | n/a | FALSE-POSITIVE | Schema/changeset only. |
| auth/public_read.ex | delete_all 1 (+ insert via `Auth.create_token`) | mix task `barkpark.rotate_public_read` only | BOOT-OR-ONESHOT | Writes directly, no door. |
| chat_hosts/context.ex | insert 3, update ~6, update_all 3, transaction 5 | HTTP: ChatHostController, ChatController, plug RequireChatHost; LiveView: ChatHostsLive, ChatLive | NEEDS-BOUNDARY | Host enrolment, leases, events. |
| content.ex | none (comment) | n/a | FALSE-POSITIVE | Delegates only; the writes live in edges.ex and schema.ex. |
| content/authoring_wall.ex | none (comment) | n/a | FALSE-POSITIVE | Calls `Exemptions.clear` indirectly, from `enforce/5`. |
| content/broadcast.ex | transaction 1 (`write_atomically`), insert! 1 (`save_event`), insert 1 (`save_revision`) | Doors: Writer, Lifecycle, BlockOps. Outside doors: `onixedit/web/staleness_live.ex` (`save_event`), `edges.ex` (StudioLive), `papers/value_writeback.ex` (StudioLive paper handler) | NEEDS-BOUNDARY | Helper; the missing boundary is in the non-door callers listed. |
| content/codelists.ex | transaction 1, insert! 1, update! 1, delete_all 1, insert_all 1 | LiveView: admin PluginsLive (`run_codelist_seeders_by_name`, `run_all_codelist_seeders`); boot (SchemaBootstrap); mix `barkpark.codelists.seed` | NEEDS-BOUNDARY | The admin "re-seed" button writes directly. |
| content/dedup_wall.ex | transaction 1 (read-only scan), advisory-lock query 1 | Lifecycle/BlockOps | FALSE-POSITIVE | Lock plus SELECT only. |
| content/document.ex | none (comment) | n/a | FALSE-POSITIVE | Schema/changeset. |
| content/edges.ex | update 1 (+ tap_broadcast), insert 1 (`add_edge`), insert_all 1 (`add_edges`) | LiveView: StudioLive delete.ex and doc.ex (`disconnect_references`, before the Lifecycle door call); HTTP: BulldocsIngestController via Proposals (`add_edge`); Oban and mix via Projector (`add_edges`) | NEEDS-BOUNDARY | `disconnect_references` rewrites other docs outside any door. |
| content/exemptions.ex | delete_all 1 | only via a door (`AuthoringWall.enforce` from Lifecycle.publish and BlockOps) | COVERED | |
| content/export.ex | none (Repo.stream read; comment) | n/a | FALSE-POSITIVE | |
| content/labels.ex | none (comment) | n/a | FALSE-POSITIVE | |
| content/paper_access.ex | insert 1, delete_all 1 | LiveView: BulldocsLive and BulldocsLive.Edit (`record`, spawned Task); Oban: PaperAccessSweeper (`prune`) | NEEDS-BOUNDARY | Reader-view log insert runs in a Task, not Oban. |
| content/papers.ex | update 1 (`refresh_html_cache`) | only via a door (`Door.admit_or_skip`, `reader_source`) | COVERED | |
| content/papers/backfill_block_ids.ex | update 1 | mix `barkpark.paper.backfill_block_ids` | BOOT-OR-ONESHOT | Direct Repo.update, no door. |
| content/papers/composition_migration.ex | update 1 | mix `barkpark.paper.composition_migrate` | BOOT-OR-ONESHOT | Direct Repo.update, no door. |
| content/papers/doctrine_backfill.ex | update 1 | mix `barkpark.paper.doctrine_backfill` | BOOT-OR-ONESHOT | Direct Repo.update, no door. |
| content/papers/proposals.ex | transaction 1, update 1, insert 1 (+ `Edges.add_edge`) | HTTP: BulldocsIngestController (`propose_paper_blocks`) | NEEDS-BOUNDARY | Writes the drafts twin with a raw insert/update; not a BlockOps entry. |
| content/revision.ex | none (comment) | n/a | FALSE-POSITIVE | |
| content/revisions.ex | none (comment) | n/a | FALSE-POSITIVE | |
| content/schema.ex | update 1, insert 1, delete 1 | HTTP: SchemaController; LiveView: PluginsLive via Bootstrap; boot (SchemaBootstrap, TagRegistry) | NEEDS-BOUNDARY | Schema CRUD is not a door. |
| content/schema_definition.ex | none (comment) | n/a | FALSE-POSITIVE | |
| content/sessions.ex | transaction 2, update_all 2 (+ advisory query 2) | plug: BarkparkWeb.SessionAutolog; HTTP: BulldocsIngestController | NEEDS-BOUNDARY | Session-log append and touch are direct. |
| content/sheets.ex | update 1 (+ tap_broadcast) | only via a door (`tap_sheet_writethrough` from Writer and Lifecycle); mix `barkpark.sheets.rehydrate_embeds` | BOOT-OR-ONESHOT | Request paths are covered; the mix path writes directly. |
| content/tag_registry.ex | transaction 1 (SET LOCAL plus a read) | read path; boot calls `Content.upsert_schema` | FALSE-POSITIVE | No direct row write; its schema write is counted in schema.ex. |
| content/warnings.ex | none (comment) | n/a | FALSE-POSITIVE | |
| crypto/data_keys.ex | transaction 3, update_all 1, update! 1, insert! 1 | HTTP: SecretController via `Secrets.put`, and BulldocsIngestController via Proposals (through FieldCipher, lazy `active_dek`, `create_active`); also Writer/BlockOps inside a door | NEEDS-BOUNDARY | First encryption per scope inserts a DEK outside a door; `rotate_dek`/`rewrap_all` have no lib callers. |
| cycle_fleet.ex | about 20 insert, 12 update_all, 12 transaction, insert_all 2, raw query 1 | HTTP: CycleFleetController (17 call sites); GenServer: StudioChat.Recorder | NEEDS-BOUNDARY | Includes a raw `Repo.update_all` on `Document` (restore_release_document_in_scope) that bypasses Writer entirely. |
| edge_projector/projector.ex | transaction 2, delete_all 3 (+ `Content.add_edges`) | Oban: ProjectorWorker; mix `barkpark.edges.backfill` | BOOT-OR-ONESHOT | Oban path is covered; the one-shot path writes directly. |
| edge_projector/projector_worker.ex | Oban.insert 3 (enqueue only) | Oban worker; enqueued from EdgeProjector.Lifecycle | COVERED | `perform` is covered by the Oban seam. |
| epic_fleet.ex | insert 2, transaction 1 | HTTP: CycleFleetController via `CycleFleet.create_assignment`/`record_result` | NEEDS-BOUNDARY | |
| epic_fleet/benchmark.ex | insert 2, transaction 2, File.write 1 + rename + rm (not media dir) | mix `barkpark.epic_fleet.import` and `.export` only | BOOT-OR-ONESHOT | No lib callers beyond EpicFleet wrappers. |
| idempotency.ex | insert_all 1, insert! 1, update_all 2, delete_all 3 | plug: BarkparkWeb.Plugs.Idempotency; periodic Idempotency.Sweeper | NEEDS-BOUNDARY | The plug claims its row before the controller reaches a door. |
| media/renditions.ex | File.rm_rf 2, render output (mkdir_p! + ImageBackend.render) under media dir, Blobstore.ensure_local | HTTP: MediaController (`Renditions.ensure` lazily generates); Media.Processing (door); Checkout release path; `Media.delete_file` (door) | NEEDS-BOUNDARY | A lazy rendition generated on GET writes blobs outside any door. |
| media/storage/media_file.ex | none (comment) | n/a | FALSE-POSITIVE | Schema. |
| media/storage/object_key.ex | none (comment) | n/a | FALSE-POSITIVE | |
| plugins/bootstrap.ex | update! 1 (+ `Content.upsert_schema`) | LiveView: admin PluginsLive (`install_by_name`, `register_all_schemas`); boot SchemaBootstrap (in the `:full` tree too); seeds | NEEDS-BOUNDARY | Admin re-install writes schemas directly. |
| plugins/bulldocs/event.ex | none (comment) | n/a | FALSE-POSITIVE | Schema. |
| plugins/bulldocs/events.ex | insert 1, update 1 | LiveView: BulldocsLive; HTTP: BulldocsIntentsController (`mark_processed`); BlockOps (door) | NEEDS-BOUNDARY | |
| plugins/github/conflicts.ex | transaction 1, insert 1, update 2 | LiveView: Github OpsLive (`resolve`); Oban: MirrorJob (`record`) | NEEDS-BOUNDARY | Only the `resolve` path is uncovered. |
| plugins/github/mirror_job.ex | Oban.insert 2 (enqueue only) | Oban worker | COVERED | Writes run in `perform` through Conflicts and Content. |

Batch A counts: NEEDS-BOUNDARY 22, BOOT-OR-ONESHOT 7, COVERED 5, FALSE-POSITIVE 16.

## Batch B (files under `lib/barkpark/`)

| file | writes (verbs, count) | reachable from | class | note |
|---|---|---|---|---|
| plugins/github/retire_job.ex | none (Oban.insert x1) | Oban job (RetireJob) | FALSE-POSITIVE | Comments naming Lifecycle, plus an enqueue. |
| plugins/indx/indexer_worker.ex | none (Oban.insert x3) | Oban job (IndexerWorker) | FALSE-POSITIVE | Enqueue helpers only. |
| plugins/onixedit/actions.ex | none (Oban.insert x1) | HTTP (StudioLive doc action "publish_to_bokbasen") | FALSE-POSITIVE | `enqueue_publish` calls `Bokbasen.Status.write/2` (non-door, see status.ex). |
| plugins/onixedit/bokbasen/status.ex | update x1 (+ Broadcast.save_event) | HTTP (StudioLive doc action); Oban (PublishWorker) | NEEDS-BOUNDARY | Raw `Repo.update` in `write/2` bypasses Content.Writer on purpose; the LiveView path is not covered. |
| plugins/onixedit/lifecycle.ex | none (Oban.insert x1) | after_publish hook (inside a Lifecycle door) | FALSE-POSITIVE | Enqueue only. |
| plugins/onixedit/web/bokbasen_live.ex | none (Oban.insert x1) | LiveView retry event | FALSE-POSITIVE | Enqueue only. |
| plugins/onixedit/web/staleness_live.ex | update x1 (+ Broadcast.save_event) | LiveView handle_event "acknowledge" | NEEDS-BOUNDARY | Raw `Repo.update` on documents straight from a LiveView event. |
| plugins/settings.ex | transaction x3, insert_or_update x1, delete x1, insert! x1 (audit) | HTTP (Studio SettingsLive put/delete/reveal); Indx/Bokbasen/EdgeProjector settings `put` | NEEDS-BOUNDARY | `reveal/2` also writes an audit row. |
| plugins/sheets/web/export_controller.ex | none | HTTP (read) | FALSE-POSITIVE | Comment only. |
| plugins/tasks/web/board_live.ex | none (reads only) | LiveView | FALSE-POSITIVE | The close event calls `Tasks.close/3` (non-door, see close.ex). |
| plugins/tickets/keys.ex | insert x1, update x2 | HTTP (Tickets InboxLive mint/rotate/pause; TicketKeysController pause/revoke) | NEEDS-BOUNDARY | api_tokens rows. |
| preview_token.ex | insert_all x1, update_all x1, delete_all x2 | Plug (Plugs.PreviewToken → record_jti); Oban (PreviewToken.Sweeper) | NEEDS-BOUNDARY | Every preview request inserts a jti row through the plug. |
| pulse.ex | transaction x1, insert_all x3, delete_all x1 | HTTP (PulseController → record_event); GenServer (Pulse.Metrics); Oban (Pulse.SweepWorker) | NEEDS-BOUNDARY | `Repo.query!` in `storage/0` is a read. |
| release.ex | none directly (Ecto.Migrator.run; seed → Seeds.run) | release eval / boot | BOOT-OR-ONESHOT | Migrations and seed bodies bypass doors entirely. |
| repo/idempotency_store.ex | insert_all x1, update_all x1 | only via a door (BlockOps claim_exact/complete_exact) | COVERED | The HTTP plug uses `claim/complete` in idempotency.ex, not this file. |
| scim.ex | insert x2, update x2, update_all x1, delete_all x2, delete! x1, transaction x2 | HTTP (ScimUsersController, ScimGroupsController, OrgAdminLive → mint_token) | NEEDS-BOUNDARY | Deprovision, group CRUD, token mint/revoke. |
| search/crystallizer.ex | insert! x2, update! x2 | Oban job (Search.Workers.Crystallize) | COVERED | No other lib caller. |
| search/intelligence.ex | insert x1, delete_all x1 | HTTP (SearchController, V1.MediaController); Oban (Search.Workers.Prune) | NEEDS-BOUNDARY | `insert_event` is analytics written on each search request. |
| search/surface_config.ex | none | n/a | FALSE-POSITIVE | Schema. |
| search/surface_configs.ex | update x1, insert x2, insert! x1 | HTTP (SearchController, V1.MediaController → upsert); boot (Seeds → seed_defaults!) | NEEDS-BOUNDARY | The seed path is also a boot-time write. |
| search/synonym.ex | none | n/a | FALSE-POSITIVE | Schema. |
| search/synonyms.ex | insert x1, delete x1 | HTTP (SearchController, V1.MediaController create/delete) | NEEDS-BOUNDARY | |
| secrets.ex | transaction x3, insert_or_update x1, delete x1, insert! x1 (audit) | HTTP (SecretController put/delete/reveal) | NEEDS-BOUNDARY | `reveal` writes an audit row. |
| seeds/demo.ex | insert! x2, update x1 | boot/seed | BOOT-OR-ONESHOT | Raw inserts of schemas and documents bypass doors. |
| seeds/shared.ex | insert x2 | boot/seed (ensure_builtin_roles) | BOOT-OR-ONESHOT | Built-in roles and permissions. |
| sharing/links.ex | insert x1, update_all x1, update x1 | HTTP (ShareLinkController; StudioLive ItemShare handler); Sharing.remove_share | NEEDS-BOUNDARY | |
| sharing/sharing.ex | insert x1, delete_all x1 | HTTP (ShareController; StudioLive Shares handler) | NEEDS-BOUNDARY | |
| sso.ex | update_all x1 | HTTP (OidcController callback → set_org_member_role) | NEEDS-BOUNDARY | |
| sso/domains.ex | insert x1, update! x1 | test only | BOOT-OR-ONESHOT | No production caller; would bypass doors if one were added. |
| sso/oidc.ex | insert x1 | test only (create_connection) | BOOT-OR-ONESHOT | |
| sso/saml.ex | insert x1 | test only (create_connection) | BOOT-OR-ONESHOT | |
| sso/social.ex | insert_or_update x1, insert x1 | HTTP (SocialController callback → find_or_link) | NEEDS-BOUNDARY | `enable_provider` is test-only. |
| status.ex | insert x1, update x1 | HTTP (StatusController → create_incident) | NEEDS-BOUNDARY | `update_incident` has no lib caller. |
| studio_chat.ex | insert x2, update x15, update! x2, update_all x12, delete x1, transaction x4 | HTTP (ChatLive etc.); GenServer (StudioChat.Recorder) | NEEDS-BOUNDARY | Largest file in the batch; writes from LiveView and from the Recorder GenServer outside Oban. |
| studio_chat/recorder.ex | none | GenServer | FALSE-POSITIVE | Drives writes in studio_chat.ex, runtime_telemetry.ex and runtime_usage.ex outside Oban. |
| studio_chat/runtime_telemetry.ex | transaction x1, insert_all x1, update_all x1 | GenServer (Recorder) | NEEDS-BOUNDARY | |
| studio_chat/runtime_usage.ex | transaction x1, insert_all x1 | GenServer (Recorder) | NEEDS-BOUNDARY | Usage receipts. |
| studio_chat/session.ex | none | n/a | FALSE-POSITIVE | Schema. |
| sync/cursor.ex | insert_all x1 (upsert) | GenServer (Sync.Worker → Applier) | NEEDS-BOUNDARY | |
| sync/dead_letter.ex | insert_all x1, update_all x1 | GenServer (Sync.Worker → Applier) | NEEDS-BOUNDARY | |
| sync/push_conflict.ex | insert_all x1 | GenServer (Sync.PushWorker → Pusher) | NEEDS-BOUNDARY | |
| sync/push_cursor.ex | insert_all x2 | GenServer (Sync.PushWorker; Github.DrainWorker) | NEEDS-BOUNDARY | |
| sync/push_doc_rev.ex | insert_all x1 | GenServer (Sync.Worker; Sync.PushWorker) | NEEDS-BOUNDARY | |
| tasks/claim.ex | transaction x2 (+ advisory-lock query!) | HTTP (TasksController claim) | NEEDS-BOUNDARY | Transaction wraps `fenced_content_write` (non-door). |
| tasks/close.ex | transaction x2 (+ advisory locks) | HTTP (TasksController.close; GithubWebhookController → MergeEvents); LiveView (BoardLive close) | NEEDS-BOUNDARY | Writes through `fenced_content_write`; also unblocks dependents. |
| tasks/compactor.ex | transaction x2, insert! x3 | Oban job (Tasks.Compactor cron) | COVERED | `restore/2` has no lib caller. |
| tasks/dedup.ex | transaction x1 (wraps Repo.all) | n/a | FALSE-POSITIVE | Read-only transaction bounding a statement timeout. |
| tasks/discharge.ex | transaction x1 (+ advisory lock) | HTTP (TasksController → Tasks.record_discharge) | NEEDS-BOUNDARY | Writes through `fenced_content_write`. |
| tasks/edges.ex | insert x1, delete_all x1, raw SQL x4 | HTTP (TasksController add_edge → Fence → Edges.add_dep); migration | NEEDS-BOUNDARY | The raw SQL runs only from a migration; the insert is on the HTTP path. |
| tasks/fence.ex | transaction x1 (+ advisory lock; Edges.add_dep insert; fenced_content_write + mutation event) | HTTP (TasksController add_edge) | NEEDS-BOUNDARY | Non-door document write inside the transaction. |

Batch B counts: NEEDS-BOUNDARY 29, FALSE-POSITIVE 12, BOOT-OR-ONESHOT 6, COVERED 3.

## Batch C (files under `lib/`)

| file | writes (verbs, count) | reachable from | class | note |
|---|---|---|---|---|
| barkpark/tasks/fleet.ex | transaction x1 (touch) + `Internal.fenced_content_write`; register goes through `Content.create_document` (door) | HTTP TasksController fleet beat | NEEDS-BOUNDARY | Register is door-covered; the touch arm is a raw CAS via Internal. |
| barkpark/tasks/internal.ex | update_all x1 (`fenced_content_write`), insert! x1 (`insert_mutation_event!`) | HTTP TasksController (every task verb); `plugins/github/adopt.ex` and `link.ex`; Oban TtlSweeper/Compactor | NEEDS-BOUNDARY | The shared write primitive for about 18 task modules; Oban callers are covered, HTTP callers are not. |
| barkpark/tasks/landed.ex | transaction x1 + fenced write + event insert | HTTP TasksController record_landing | NEEDS-BOUNDARY | Raw CAS via Internal. |
| barkpark/tasks/move.ex | transaction x1 + fenced write + event | HTTP TasksController move | NEEDS-BOUNDARY | Reparent via raw CAS. |
| barkpark/tasks/mutate_guards.ex | none | only via a door (Content.Mutations hook table) | FALSE-POSITIVE | Guard callbacks only. |
| barkpark/tasks/mutations.ex | transaction x2 + fenced write + event | HTTP TasksController relabel / paper refs / session refs | NEEDS-BOUNDARY | Label and ref-list CAS writes bypass doors. |
| barkpark/tasks/publish_guards.ex | none | only via a door (Lifecycle publish gate) | FALSE-POSITIVE | Doc mention only. |
| barkpark/tasks/pulse.ex | transaction x1 + fenced write + event | HTTP TasksController pulse | NEEDS-BOUNDARY | Raw CAS. |
| barkpark/tasks/release.ex | transaction x1 + fenced write + event | HTTP TasksController release | NEEDS-BOUNDARY | Raw CAS. |
| barkpark/tasks/renew.ex | transaction x1 + fenced write + event | HTTP TasksController renew; plugins/github link and adopt | NEEDS-BOUNDARY | Raw CAS. |
| barkpark/tasks/stage.ex | transaction x1 + fenced write + event | HTTP TasksController stage | NEEDS-BOUNDARY | Raw CAS. |
| barkpark/tasks/stamp.ex | transaction x1 + fenced write + event | HTTP TasksController stamp | NEEDS-BOUNDARY | Raw CAS. |
| barkpark/tasks/terminal_criteria_fence.ex | none | only via a door | FALSE-POSITIVE | Comment mentions only. |
| barkpark/tasks/ttl_sweeper.ex | transaction x2, insert! x2, fenced write x2 | Oban worker TtlSweeper | COVERED | No non-Oban callers in lib. |
| barkpark/tasks/twin_resolver.ex | none | HTTP TasksController (reads) | FALSE-POSITIVE | Read-only resolver. |
| barkpark/tenancy.ex | insert x4, update x9, update_all x4, delete x2, delete_all x2, transaction x7, `query!` x4 (teardown SQL) | HTTP WorkspaceController (delete/archive/restore/project/pull-provenance), PlaygroundController, WorkspaceLocaleController; LiveView SettingsLive, OrgAdminLive, studio scope handler, StudioChrome; Oban PlaygroundReaper; seeds | NEEDS-BOUNDARY | Workspace, org and dataset admin writes bypass all doors; `get_or_create_dataset` inside write_scope and `Media.upload` is covered. |
| barkpark/tenancy/auth.ex | insert x2 (`create_membership` and one more) | HTTP MemberController (via Members), SSO, SCIM, Auth token create, `Tenancy.create_workspace_with_owner` | NEEDS-BOUNDARY | Membership rows. |
| barkpark/tenancy/members.ex | update x1, delete x1, + `create_membership` | HTTP MemberController add/update_role/remove | NEEDS-BOUNDARY | |
| barkpark/tenancy/quota.ex | update x4 (suspend, reinstate, set_expires_at, set_quota) | HTTP WorkspaceReinstateController, PlaygroundController; Oban PlaygroundReaper (suspend) | NEEDS-BOUNDARY | Oban `suspend` is covered; the HTTP paths are not. |
| barkpark/tenancy/workspace.ex | none | n/a | FALSE-POSITIVE | Schema and changeset. |
| barkpark/tenancy/workspace_bundle.ex | transaction x2 (import; export is a COPY OUT read), `query!` x~25 (DDL, trigger toggles, DELETE, COPY FROM), `create_membership`, `Tenancy.delete_workspace` | HTTP WorkspaceController import; mix `barkpark.workspace.import_dataset` | NEEDS-BOUNDARY | Bulk COPY restore, entirely outside doors. |
| barkpark/tenancy/workspace_bundle/dataset_remap.ex | transaction x1, insert x1, `query!` x15 (DDL, trigger disable, rewrites) | HTTP WorkspaceController import into_dataset; mix import_dataset | NEEDS-BOUNDARY | |
| barkpark/webhooks.ex | insert x6, update x5, update_all x6, delete x1 (+ Oban.insert enqueue) | HTTP WebhookController (create/update/delete/rotate/reenable/test); `Webhooks.Dispatcher` (GenServer); `Media.Delivery.Events`; StudioChat blocked sweeper | NEEDS-BOUNDARY | Delivery rows written from the dispatcher, outside Oban. |
| barkpark/webhooks/retry_worker.ex | update_all x1 | Oban RetryWorker | COVERED | |
| barkpark/webhooks/stuck_delivery_sweeper.ex | update_all x1 | Oban StuckDeliverySweeper cron | COVERED | `sweep/1` is called outside Oban only by tests. |
| barkpark/workers/findability_posttest.ex | none (Oban.insert enqueue only) | Oban worker; `enqueue_after` on the after_publish hook | FALSE-POSITIVE | `perform` only searches, logs and emits telemetry. |
| barkpark_web/controllers/bulldocs_ingest_controller.ex | none | HTTP (delegates to `Content.apply_paper_block_ops` and `Content.upsert_paper`) | FALSE-POSITIVE | `upsert_paper` goes to Papers; not verified whether it reaches Writer. |
| barkpark_web/controllers/export_controller.ex | transaction x1 | HTTP ExportController | FALSE-POSITIVE | Wraps a `Repo.stream` read cursor. |
| barkpark_web/controllers/media_controller.ex | none (`Blobstore.serve_strategy` is a read) | HTTP; writes go through `Media.upload`, `put_blob`, `delete_file` | FALSE-POSITIVE | All writes go through doors. |
| barkpark_web/controllers/playground_controller.ex | none (comment) | HTTP | FALSE-POSITIVE | Delegates to `Tenancy.create_workspace_with_owner`, `Quota.set_quota`, `Auth.create_token`, which need a boundary upstream. |
| barkpark_web/controllers/schema_controller.ex | none (comment) | HTTP | FALSE-POSITIVE | Delegates to `Content.upsert_schema` / `delete_schema`, not listed doors. |
| barkpark_web/controllers/scim_groups_controller.ex | transaction x1 wrapping `Scim.update_group` + `replace_group_members` | HTTP SCIM groups PUT/PATCH | NEEDS-BOUNDARY | The write itself is in Scim; this file opens the outer transaction. |
| barkpark_web/controllers/tasks_controller.ex | none | HTTP | FALSE-POSITIVE | Entry point for every NEEDS-BOUNDARY task verb. |
| barkpark_web/controllers/token_controller.ex | none (comment) | HTTP | FALSE-POSITIVE | Token writes are in `auth.ex`. |
| barkpark_web/controllers/v1/media_controller.ex | none (comment) | HTTP | FALSE-POSITIVE | Also calls `Media.patch_asset_metadata`, not a listed door. |
| barkpark_web/controllers/webauthn_controller.ex | none (comment) | HTTP | FALSE-POSITIVE | Delegates to `Webauthn.verify_registration` / `delete_credential`. |
| barkpark_web/controllers/workspace_controller.ex | no DB writes; `File.open(:write)` scratch spill, `File.rm` temp tar, both outside the media dir | HTTP | FALSE-POSITIVE | HTTP entry for the NEEDS-BOUNDARY Tenancy and WorkspaceBundle writes. |
| barkpark_web/live/studio/chat_live.ex | none (comment) | LiveView | FALSE-POSITIVE | |
| barkpark_web/live/studio/studio_live/shared/paper.ex | none (comment) | LiveView | FALSE-POSITIVE | Writes go through paper block ops (door). |
| barkpark_web/plugs/require_ingest_token.ex | none | plug | FALSE-POSITIVE | |
| barkpark_web/plugs/require_within_quota.ex | none (comments) | plug | FALSE-POSITIVE | Read-only gate. |
| barkpark_web/router.ex | none (comments) | n/a | FALSE-POSITIVE | |
| barkpark_web/session_autolog.ex | none directly | plug `before_send` calls `Sessions.append_event` | FALSE-POSITIVE | Upstream `content/sessions.ex` does a raw transaction + `update_all` outside any door, reachable from HTTP. |
| mix/tasks/barkpark.paper.doctrine_backfill.ex | none directly (calls `DoctrineBackfill.run`) | mix task | BOOT-OR-ONESHOT | Writes are in `DoctrineBackfill` (raw persist, no door). |
| mix/tasks/barkpark.preview.backfill.ex | update x1 | mix task | BOOT-OR-ONESHOT | Raw `Repo.update`, bypasses doors. |
| mix/tasks/barkpark.rehydrate_body_html.ex | update x1 (`&Repo.update/1` persist_fun) | mix task | BOOT-OR-ONESHOT | Raw `Repo.update`, bypasses doors. |
| mix/tasks/barkpark.workspace.provision_schemas.ex | none directly (`Content.upsert_schema`) | mix task | FALSE-POSITIVE | Delegated write, mix-only. |
| mix/tasks/bokbasen.replay.ex | none (Oban.insert enqueue) | mix task | FALSE-POSITIVE | Enqueues `PublishWorker`, which runs under Oban. |
| mix/tasks/frt.seed.ex | insert! x2 + `Tenancy.create_workspace` / `create_project` / `get_or_create_dataset` | mix seed | FALSE-POSITIVE | Raw inserts, seed-only; the surveyor notes this fits BOOT-OR-ONESHOT better. |
| mix/tasks/search.eval.ex | `File.write!` x1 (baseline JSON at a user-given path, not the media dir) | mix task | FALSE-POSITIVE | Not a DB or media write. |

Batch C counts: NEEDS-BOUNDARY 19, COVERED 3, BOOT-OR-ONESHOT 3, FALSE-POSITIVE 26.
