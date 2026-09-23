# Ownership for the next delivery

This is the target for P1–P5, not a claim that profiles and sync already exist. The real modules in `app/` and audited Barkpark contracts govern implementation. The [previous architecture proposal](archive/2026-09-21-architecture.md) and [typed sketch](contracts/workspace.ts) remain historical references.

## Separate the owners

| Owner | State | Boundary to prove |
|---|---|---|
| Application | Window layout, appearance, profile registry and active-profile selection | A profile is not an agent working folder. No global filesystem project selector. |
| Profile | Documents, media, conversations, navigation/favorites, drafts, receipts, caches, local runtime data and cloud binding | Stable ID; all lookups and mutations use the owning profile. Machine credentials are handled separately from portable content. |
| Conversation | Transcript, parent reference, tabs, draft/history, provider/model/effort, optional folder | Side and main chats use the same ownership model. Closing a view does not delete its conversation. |
| Run | Captured profile, conversation, provider session, folder and content scope | Foreground/profile switching never rebinds a run or leaks its events into another library. Define drain/cancel behavior before releasing its runtime. |
| Barkpark | Canonical Paper content, schema, revisions, media and scoped operations | Real acknowledged writes and revision conflicts; no parallel content format or fabricated API. |
| Device | Local paths, process ownership and OS-protected credentials | Import remaps unavailable folders explicitly and requires reconnection for machine-bound credentials. |

## Implemented foundation

There is currently one workspace store plus the opt-in `local-barkpark/default` runtime, not a profile registry. Paper references use existing identifiers that need a profile owner. Audit migration across every persisted reference, including tabs, favorites, links, side-chat parents, receipt targets, attachments and caches. Preserve a backup of the original format and keep adoption repeatable.

The Paper adapter loads the editor from the connected Barkpark, with cached/vendored fallback. Editor truth stays upstream. The legacy document store remains until P2 migration passes; its continued presence is deliberate compatibility, not the intended final architecture.

## Migration, recovery and export contracts to establish

- Version the profile registry and persisted records. Keep stable identity separate from mutable endpoint URLs and display names. Missing or inaccessible targets remain missing; never substitute a same-slug object from another profile.
- Quiesce or snapshot consistently before export. Use a supported logical database export and include referenced media and profile metadata; do not zip a live PostgreSQL directory and call it portable. Audit upstream bundle/export capability before choosing a format.
- Write migration checkpoints and source-to-target mappings durably. Verify structured content, IDs/references and media before switching authority. Interrupted execution must resume or roll back without duplication or lost source data.
- Capture expected revisions and reconcile uncertain acknowledgements against authoritative state. Persist recoverable human drafts. Recovery never implies permission to overwrite a newer version.
- Keep sync transport separate from people’s navigation choices. Define tombstones, conflict identity and replay behavior before two-device writes; permission loss must not be mistaken for deletion.
- Diagnostics report process/state/version information without document bodies or secrets by default. Packaged startup must preserve the source runtime’s owned-process and bounded-retry guarantees.

Acceptance scenarios are in [ACCEPTANCE.md](ACCEPTANCE.md); unresolved API choices must be recorded as findings, not silently promoted into guarantees.

The [C001 ownership audit](PROFILE-OWNERSHIP.md) maps actual files, caches, sessions and credentials to these owners, specifies the stable profile/resource/run contract, and separates shell-only adoption from unsupported live-database copying. It is design evidence, not implemented isolation.

C004 adds [captured run handles](RUN-OWNERSHIP.md): bound local adapters, immutable provider/MCP connection snapshots, authoritative event owners and awaited driver finalization. Single-workspace boot remains; a verified registry resolver, profile IPC generations and background transcript persistence are still required before switching profiles.
