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

The Paper adapter loads the editor from the connected Barkpark, with cached/vendored fallback. Editor truth stays upstream. C087 retired legacy editing with the owner’s authorization. The legacy store remains as a read-only original, adoption and rollback source; its continued presence is deliberate compatibility.

## Migration, recovery and export contracts to establish

- Version the profile registry and persisted records. Keep stable identity separate from mutable endpoint URLs and display names. Missing or inaccessible targets remain missing; never substitute a same-slug object from another profile.
- Quiesce or snapshot consistently before export. Use a supported logical database export and include referenced media and profile metadata; do not zip a live PostgreSQL directory and call it portable. Audit upstream bundle/export capability before choosing a format.
- Write migration checkpoints and source-to-target mappings durably. Verify structured content, IDs/references and media before switching authority. Interrupted execution must resume or roll back without duplication or lost source data.
- Capture expected revisions and reconcile uncertain acknowledgements against authoritative state. Persist recoverable human drafts. Recovery never implies permission to overwrite a newer version.
- Keep sync transport separate from people’s navigation choices. Define tombstones, conflict identity and replay behavior before two-device writes; permission loss must not be mistaken for deletion.
- Diagnostics report process/state/version information without document bodies or secrets by default. Packaged startup must preserve the source runtime’s owned-process and bounded-retry guarantees.

Acceptance scenarios are in [ACCEPTANCE.md](ACCEPTANCE.md); unresolved API choices must be recorded as findings, not silently promoted into guarantees.

The [C001 ownership audit](PROFILE-OWNERSHIP.md) and [C004 captured-run contract](RUN-OWNERSHIP.md) retain the original design evidence. Their historical single-workspace and pending-registry statements are superseded by the accepted [P1 completion audit](cycles/C039-completion-audit.md). The implemented main process owns profile resolution, IPC generations, background transcript persistence and captured provider/MCP contexts.

P2 implements closed-source backup, resumable staging, comparison under writer admission, a Settings switch, retained originals, rollback and reconciliation. C083 proves the supported corpus on Mac; C087 retires the separate editor; C096 retains already-open Paper destinations. C097 adds bounded Windows migration and recovery evidence. Real-library and complete live-writer acceptance remain open. See the [migration contract](migration/README.md) and [current proof](cycles/evidence/C097/README.md).

## Read the code by authority boundary

| Concern | Entry points | Avoid confusing it with |
|---|---|---|
| Profile identity and runtime | `app/main/profile-registry.js`, `profile-service.js`, `profile-runtime.js` | A chat's working folder or the currently visible tab. |
| Open Paper connection and captured tool access | `app/main/paper-connection.js`, `paper-tool-connection.js` | Physical database identity or a completed migration-generation fence. Connection binding is a narrower guarantee. |
| Saved Paper destinations and edit evidence | `app/main/paper-navigation.js`, `paper-evidence-owner.js` | A bare slug, an endpoint URL or whichever profile is active later. |
| Complete catalog and local/cloud classification | `app/main/paper-catalog.js`, `paper-origin.js` | Server-claimed origin; only a trusted managed runtime lease classifies local Archive. |
| Agent edits and resumed tool compatibility | `app/main/agent-edits.js`, `mcp-server.js` | The old `propose_document_edit` name: it aliases direct edits for resumed sessions, not a new Keep requirement. |
| Legacy documents and migration | `app/main/documents.js`, `migration-*.js` | Dead code. Retained originals, historical proposals, adoption and rollback still need this storage after editor retirement. |
| The browser the agents use | `app/main/browser-tools.js`, `browser-mcp.js` | The documents MCP server (`mcp-server.js`): browser tools drive the chat's own tabs through the DevTools Protocol in the main process; `browser-mcp.js` is only the stdio face a run talks to, over a private socket with a token. |
| Barkdown controlling itself (`barkdown` CLI, the assistant's `app` tool) | `app/shared/control-commands.js`, `app/main/control.js`, `control-client.js`, `cli/barkdown.js`, `app/renderer/src/control.js` | The window, or the CLI: permission is decided only in `main/control.js` (tiers, Full YOLO, the never-list); the renderer carries out what main allowed and cannot reach the Full YOLO switch; the CLI holds no rule. |
| The browser a profile's website tabs run in | `app/main/browser-session.js`, `chrome-import.js` | The main window's own session, or the `<webview>` element in the renderer: the profile's partition owns the user agent, site permissions, popups and new-tab routing; the import copies bookmarks and history, never a session. |
| Rendered Paper and human organization | `app/renderer/src/tabs/paper.js`, `pages.js` | Content authority. Main/upstream enforce writes; Pages placement belongs to the person. |

Before removing a path, trace current callers, stored records and resumed sessions. Existing Keep/Discard rendering can serve retained historical proposals; it does not reverse D28 for new agent edits. Current local documents and remote Papers intentionally coexist. The [ordinary-note service](migration/ordinary-notes.md), `app/main/draft-notes.js`, now owns managed-local foreground creation/read/search/ops and durable creation intents. C069 wires API/MCP creation, draft discovery and title-preserving edits/Undo through the same service; acceptance is tracked in its cycle. Migration activation is implemented; complete A2 acceptance remains separate. Keep ownership, transport revisions, Paper revisions and UI navigation distinct.

### Managed migration navigation

`migration-workspace.js` keeps its synchronous unqualified preview and adds a read-only owned projection for the trusted host. It derives destination ownership from the existing profile key and captured runtime connection, checking the source and lease across asynchronous boundaries. `migration-comparison.js` consumes that projection; `migration-media.js` awaits source checks before continuing. [C080 evidence](cycles/C080-owned-navigation.md) records the demonstrated scope and delivery status. This does not choose an engine or initialize unknown ownership.
