# Profile ownership contract and audited inventory

C001 design evidence, audited against Barkdown `b8e7bfb` on 2026-09-22. This describes current code and the proposed P1 boundary separately. It does not establish A1 isolation. The [acceptance gates](ACCEPTANCE.md) remain pending.

## Current owners and keys

All paths below are relative to Electron `userData/barkdown` unless stated otherwise. No user library was opened for this audit.

| Data | Actual module and key | Current boundary / required owner |
|---|---|---|
| Store root | `app/main/store.js`: mutable module `baseDir`; `init`, `filePath`, `readJson`, `writeJson` | One process-global root. Profile-bound store instances must replace active-root lookup for asynchronous work. JSON uses `.tmp` + rename; reads currently fall back on corruption and are unsuitable for registry validation. |
| Legacy documents | `documents.js`: `documents/<id>.json`, Markdown sidecar, SHA-256 document lock, module `cache` Map | Bare slug key; revisions, proposals, references and backlinks live in document JSON. Profile owns directory and cache; same slug in another profile is unrelated. Do not retire this engine during P1. |
| Paper content/search/media | `barkpark.js`: direct HTTP `server`, `dataset`, bearer token, or `bp` process using current CLI configuration | Content remains on selected server. Profile must capture a stable binding independent of mutable server URL; CLI active selection is not an ownership boundary. Search/history/backlinks obey the same captured binding. |
| Paper proposals | `documents.js`: `paper-proposals.json`, object keyed by slug | Profile-owned; never merge same-slug proposals across owners. |
| Agent Undo receipts | `agent-edits.js`: `agent-edits/<sha256(documentId)>.json` | Bare `bp:<slug>` or local ID, full prior content, expected revisions. Profile store and binding must remain captured across awaited read/apply/receipt writes. |
| Conversations | `renderer/src/state.js`: `workspace.json` version 1, `chats`, `order`, `current` | Chat IDs, side/parent links, messages, API history, provider sessions/options, events, folders and draft/history/images. Parent links resolve within profile only. `conversations.js` reads global workspace for MCP/context today. |
| Tabs/navigation | Same workspace: chat `tabs`, `active`, paths/scroll/closedTargets; `mode`, `directTab` | Profile-qualified owner for every tab/path/direct destination; restoring unavailable items must not substitute another profile's slug. |
| Pages/favorites | Same workspace: `pages`, `favorites`; `state.js` `favoriteKey` and old pin migration; `pages.js` delegates to shared Pages model | Keep human ordering and existing migration backup. Current favorite key omits owner. Preserve nested organization and Cloud archive boundary. |
| Project buffers | `renderer/src/tabs/project.js`: Map keyed by folder + file, draft/saved/selection/scroll | Session-only, shared between chats by path today; profile must join key even for identical filesystem folder. Restart durability is not implemented. |
| Mounted UI | `renderer/src/index.js`: controller Map keyed by tab ID; Paper/local editor closures | Async completion must retain owner, target and generation; dispose/ignore stale display work without dropping acknowledged saves. Profile switch needs draft flush/drain before replacing view. |
| Settings | `main.js`: `settings.json` | Mixed ownership. App: `theme`, `sidebarWidth`, `chatWidth`, `windowBounds`. Profile: model/provider preferences, `apiKeyEncrypted`, entire `barkpark`, `recentFolders`. Unknown fields retained in original and profile copy until understood. |
| Barkpark credentials/config | `main.js`: `local-credentials.json`, `barkpark.json`, process `BARKDOWN_BP_TOKEN` | Local credentials encrypted with Electron safeStorage when available; fallback is base64, not encryption. `barkpark.json` excludes token but is mutable. No global environment token may be consulted after a run starts. |
| Provider login | `providers/claude.js`, `codex.js`: home-directory CLI login/config and environment | External device login shared by current implementation, not profile-owned export data. API credential is profile-owned; explicit provider-login isolation/consent policy remains open. Do not claim all credentials isolated while SDKs inherit global login. |
| Attachments | `main.js` `attachments:save`: `attachments/<generated-id>.<ext>`; message path/url | Bytes profile-owned. Existing absolute paths need validated source-to-target mapping during adoption; original snapshot preserves original strings. Images outside source root require explicit missing/external handling, not arbitrary copying. |
| Canvas assets | `canvas-bundle.js`: **outside store**, `userData/canvas-bundle/current.json`, `<sha8>/` | Cached JS/CSS metadata includes server; fallback currently takes last cache regardless of selected connection. New cache root must be profile/binding-scoped; old cache may remain untouched as non-authoritative evidence. |
| Browser sessions | `tabs/website.js`: **outside store**, `persist:barkdown-web` Electron partition | Cookies/storage are presently shared. New partition per profile; retain old partition for default adoption only with explicit mapping. No shared-session fallback for new profiles. |
| Runtime data | `main.js`, `local-barkpark-source.js`: `local-barkpark/default/{pgdata,media,indx,bundles}`, owner/boot/seed markers and logs | Entire private runtime belongs to profile. Existing SourceDriver takes explicit dataDir, ports and secrets and owns its own processes. Registry switch cannot stop a runtime with captured active runs. Never copy/zip running PostgreSQL as a portable snapshot. |
| Runs/approvals | `providers/runs.js`: Map by UUID; context object, approval callbacks, abort state; `agent.js` API loop | Captures chat ID but no profile; context is currently mutable by reference. Events and tools require immutable profile/chat/folder/binding capture. Approval/cancel requests must validate owner, not just ID. |
| MCP/provider scratch | `providers/runs.js`: `mcpServerSpec(storeDir)`, `<storeDir>/scratch`; `mcp-server.js` argv[2] and readRevisions Map | Store path captured for child, token read from global env at SDK launch; MCP repeatedly reads mutable barkpark flag. Capture connection/token before first await, keep secrets out of argv/logs, qualify read revisions and local activity resolution. |
| Terminal/files/git | `terminal.js` sessions keyed by tab ID; files/git receive roots | Capture profile/tab/folder. Filesystem folder remains conversation context, never global profile selector. Terminal lifecycle and output need owner routing. |

## Stable contract

Use a random lowercase UUID for `profileId`, never a display name, server URL, folder or document slug. Registry version 1 records selected ID and validated profile entries. Resolve directories beneath a single registry root as `profiles/<profileId>`; reject unknown IDs, unsupported versions, traversal and symlink/reparse escape. Do not accept renderer-supplied absolute profile roots.

A resource reference is `{ profileId, source, id }` (`source` distinguishes legacy local documents and Barkpark papers). Use tuple serialization for cache keys, not ambiguous string concatenation. Existing IDs and document links stay byte-identical within their profile during first adoption; qualify the containing workspace and boundary arguments rather than rewriting the content corpus prematurely. A future changed server binding gets its own stable `bindingId`/generation; changing an endpoint cannot retarget already-open work.

Capture a run before dispatch as `{ profileId, chatId, storeDir, folder, connection, providerSession }`. Freeze a copy, not the renderer's object. `connection` contains binding identity, server/dataset, enabled/write capability and private token; secrets travel only through private process environment or memory. Events carry profile/chat/run identity appended after provider event fields so tools cannot override ownership. Main, side chats and API fallback follow the same rule. Resume a provider session only within its original owner.

Tool and persistence handles must be bound to this captured store, including local documents, conversation context, receipts and MCP. Selecting B while A is running changes foreground view only. A's events update A's durable conversation; they must neither navigate B nor invalidate B's caches/draft. Keep A's runtime leased until its work drains or is explicitly cancelled. An inaccessible owner fails explicitly; no fallback to selected profile.

## Adoption, interruption and rollback

1. Acquire an exclusive adoption lease in an isolated destination. Validate all source files, versions, paths and external references. Require quiescent source writers. Preserve unknown source files; unsupported directories block an automatic completion claim.
2. Create an immutable manifest and byte-for-byte backup with sizes and hashes. Original workspace remains untouched. Source changes during copying invalidate the attempt; do not publish a partial snapshot. A live managed database blocks shell-only adoption: supporting its cold/logical backup plus media is a separate integration proof.
3. Stage the default UUID exactly once. Persist a journal mapping source identity/fingerprint, backup, destination and phase. Copy owned files and validate contents/counts/references, converting attachment paths only in the staged destination with a recorded map. Extract only app appearance settings; retain original mixed settings in backup and preserve unknown fields.
4. Publish a fully validated versioned registry generation atomically. Keep last valid generation, backup and journal. Validate the registry strictly rather than `store.readJson` fallback. Corruption must be visible; never create an empty default over unreadable data. On interruption either resume the same operation/UUID or expose prior committed generation.
5. Repeating adoption returns the same owner without duplicating chats/documents. Rollback changes authority to retained valid source/generation; it does not recursively delete profiles, backups, receipts or unknown data. If either side changed, retain both and require reconciliation rather than overwrite.

The next-cycle registry agent owns the additive, fixture-only shell adoption module. It is deliberately not app-startup wiring. A refusal when `local-barkpark` exists is honest partial support; it does not satisfy whole-workspace adoption in A1. Browser partitions and outside-store asset caches need explicit default mapping during later boot integration. Existing settings, DB and live user data are not changed by this cycle.

## Audited contracts and open questions

The existing Barkdown adapter implements dataset-scoped reads under `/v1/data/...`, revision-checked Paper ops under `/v1/plugins/bulldocs/papers/<slug>/ops`, and multipart `/media/upload`. This is code inspection, not fresh endpoint verification. CLI calls run `bp` with ambient active configuration; they must be made explicit or rejected in captured-profile mode. The local source launcher redirects Postgres, media, index state and bundle spill paths explicitly. No export/import, tenancy creation, CRDT, sync or cross-machine credential guarantee is established by these modules.

Before claiming A1: audit SDK external login boundaries, prove immutable CLI endpoint/token behavior, define offline local-runtime adoption, scope Electron sessions/cache, and replace global local-document caches. Before P3: audit a supported logical export/restore with media and external path/credential handling; same-machine directory copies cannot establish portability.

## Executable proof sequence

| Slice | Required isolated fixtures / assertions |
|---|---|
| Registry/adoption | Adopt twice; identical content/backup hashes and one UUID. Fail after each phase, resume; corrupt pointer/generation; reject unknown version and path escape. Preserve originals/unknown files. Prove explicit refusal of unsupported local DB adoption. |
| Run capture | Start A, mutate settings/context and select B before delayed SDK load; MCP spec retains A token/root/connection and A folder. A events cannot spoof owner. Same chat/document IDs in A/B remain distinct; API and CLI-provider transports included. |
| Store isolation | Bound document/conversation/receipt handles for A/B with identical slugs and revisions; concurrent reads, writes, Undo, proposals and search remain local. Invalid/unknown owner never falls back. |
| Desktop switch | A pending draft + image + side chat + favorites + open paper + running agent; switch B, edit same slug, finish A, restart B. Assert A changes only A and B draft/scroll unchanged. Isolate web cookies, project buffers, bundle/cache and credentials. |
| Real runtimes | Two private clusters/ports/tokens/media roots; same slug, real acknowledged revisions and media fetch; no same-slug substitution after one runtime fails. Shutdown stops only owned processes. |

Close each slice with implementation commit, relevant behavior checks, deterministic capture/compare/actual review/approval and live Paper capture where app-source freshness requires it, then evidence commit. C001 changes documentation only; current images remain applicable. P1 stays pending until every A1 scenario is demonstrated.
