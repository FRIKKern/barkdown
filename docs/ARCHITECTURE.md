# Ownership for the next delivery

This describes the implemented profile foundation and the remaining P1–P5 targets. Migration, portability and sync are not complete. The real modules in `app/` and audited Barkpark contracts govern implementation. The [previous architecture proposal](archive/2026-09-21-architecture.md) and [typed sketch](contracts/workspace.ts) remain historical references.

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

The app now has a versioned profile registry, backed-up adoption of the legacy workspace, profile-qualified document and run ownership, and owned local runtimes. The original single-workspace store remains an adoption/rollback source. Combined native evidence covers profile switching, repeated adoption, recovery, caches and missing references; see [C008](cycles/C008-integration.md). Device provider authentication is shared by default without a per-profile prompt; profile-owned API keys remain isolated and take precedence. [C039](cycles/C039-provider-authentication.md) verifies this declared boundary across ordinary and goal runs. These implemented foundations do not establish migration to one note engine or cross-machine portability.

The Paper adapter loads the editor from the connected Barkpark, with cached/vendored fallback. Editor truth stays upstream. The legacy document store remains until P2 migration passes; its continued presence is deliberate compatibility, not the intended final architecture.

## Migration, recovery and export contracts to establish

- Version the profile registry and persisted records. Keep stable identity separate from mutable endpoint URLs and display names. Missing or inaccessible targets remain missing; never substitute a same-slug object from another profile.
- Quiesce or snapshot consistently before export. Use a supported logical database export and include referenced media and profile metadata; do not zip a live PostgreSQL directory and call it portable. Audit upstream bundle/export capability before choosing a format.
- Write migration checkpoints and source-to-target mappings durably. Verify structured content, IDs/references and media before switching authority. Interrupted execution must resume or roll back without duplication or lost source data.
- Capture expected revisions and reconcile uncertain acknowledgements against authoritative state. Persist recoverable human drafts. Recovery never implies permission to overwrite a newer version.
- Keep sync transport separate from people’s navigation choices. Define tombstones, conflict identity and replay behavior before two-device writes; permission loss must not be mistaken for deletion.
- Diagnostics report process/state/version information without document bodies or secrets by default. Packaged startup must preserve the source runtime’s owned-process and bounded-retry guarantees.

Acceptance scenarios are in [ACCEPTANCE.md](ACCEPTANCE.md); unresolved API choices must be recorded as findings, not silently promoted into guarantees.

The [C001 ownership audit](PROFILE-OWNERSHIP.md) and [C004 captured-run contract](RUN-OWNERSHIP.md) retain the original design evidence. Their historical single-workspace and pending-registry statements are superseded by the accepted [P1 completion audit](cycles/C039-completion-audit.md). The implemented main process owns profile resolution, IPC generations, background transcript persistence and captured provider/MCP contexts.

P2 currently provides closed-source inventory/backup, durable create-only staging, supported content/reference/PNG comparison, no-overwrite legacy restore and an offline navigation projection. The [migration contract](migration/README.md) defines their exact boundaries. There is no migration authority selector or legacy-engine retirement; C054 now reads original history/receipts as verified offline evidence, and C074 exposes it through a profile-owned native reader. C075/C076 prove captured writer fencing and live profile preparation; whole-library comparison and atomic activation/rollback still require proof. See the [comparison boundary](migration/comparison.md). C056–C060 now verify complete catalog discovery, connection-owned navigation/edit evidence and managed-local Archive classification; this does not activate migration.

## Read the code by authority boundary

| Concern | Entry points | Avoid confusing it with |
|---|---|---|
| Profile identity and runtime | `app/main/profile-registry.js`, `profile-service.js`, `profile-runtime.js` | A chat's working folder or the currently visible tab. |
| Open Paper connection and captured tool access | `app/main/paper-connection.js`, `paper-tool-connection.js` | Physical database identity or a completed migration-generation fence. Connection binding is a narrower guarantee. |
| Saved Paper destinations and edit evidence | `app/main/paper-navigation.js`, `paper-evidence-owner.js` | A bare slug, an endpoint URL or whichever profile is active later. |
| Complete catalog and local/cloud classification | `app/main/paper-catalog.js`, `paper-origin.js` | Server-claimed origin; only a trusted managed runtime lease classifies local Archive. |
| Agent edits and resumed tool compatibility | `app/main/agent-edits.js`, `mcp-server.js` | The old `propose_document_edit` name: it aliases direct edits for resumed sessions, not a new Keep requirement. |
| Legacy documents and migration | `app/main/documents.js`, `migration-*.js` | Dead code. Legacy storage, historical proposals and recovery records remain required until A2 proves retirement. |
| Rendered Paper and human organization | `app/renderer/src/tabs/paper.js`, `pages.js` | Content authority. Main/upstream enforce writes; Pages placement belongs to the person. |

Before removing a path, trace current callers, stored records and resumed sessions. Existing Keep/Discard rendering can serve retained historical proposals; it does not reverse D28 for new agent edits. Current local documents and remote Papers intentionally coexist. The [ordinary-note service](migration/ordinary-notes.md), `app/main/draft-notes.js`, now owns managed-local foreground creation/read/search/ops and durable creation intents. C069 wires API/MCP creation, draft discovery and title-preserving edits/Undo through the same service; acceptance is tracked in its cycle. Migration activation remains separate work. Keep ownership, transport revisions, Paper revisions and UI navigation distinct.
