# Accepted design decisions

These record the user's decisions through the private handoff. Preserve the intent, even when the production implementation differs from the concept's internals. The latest user instruction always supersedes this record.

| ID | Decision | Observable behavior |
|---|---|---|
| D01 | Barkdown combines conversational work and structured documents. | Start from chat or a document; keep the related work within reach. |
| D02 | Use Barkpark's existing capabilities. | Reuse Paper, PortableDoc, content types, references, media, revisions, permissions, and search. Do not build a disconnected document store. |
| D03 | Historical T3 Code foundation proposal; not the current runtime backlog. | The implemented Electron/provider runtime in `app/` and D31 delivery plan govern current work. Any future import needs a new bounded audit; do not replace functioning code from this old proposal. |
| D04 | Barkdown is app-wide. Agents work in folders. | No active filesystem project at the top of the app sidebar. Switching chats changes agent context, not the global document/chat navigation. |
| D05 | Documents first in the sidebar; recent chats below. | A compact library above app-wide conversation recents, without an Agents section. |
| D06 | A compact Notion-like top is desirable. | Use compact navigation and work tabs; avoid duplicated title/status rows. |
| D07 | Main chat has priority. | Default to 60% chat / 40% work area after subtracting the sidebar; allow adjustment. Keep chat plus the latest work when possible. |
| D08 | Work tabs are browser-like and typed. | The right workspace can host documents, websites, code reviews, project editors, and independent side chats. The + action opens these types. |
| D09 | Every main chat owns its workspace. | Switching chats restores tabs, active target, document paths, drafts, scroll, and agent context. |
| D10 | Linked documents open to the right within their document tab. | Retain the source path. Collapse earlier document panes based on available width; they remain reachable from the tab/path navigation. |
| D11 | Direct document navigation is quiet. | Clicking a sidebar document opens it without an expanded chat or agent panel. |
| D12 | The UI can follow AI work from chat. | Activity references a typed target. Open the corresponding work tab or mark it updated. Manual navigation or typing pauses automatic focus. |
| D13 | No permanent “Ada ready” or Follow/title row. | Actor information belongs in messages, activity, and edits. A contextual “Go to latest activity” action is enough. |
| D14 | Editing feels like Notion. | Direct text editing, block controls, slash insertion, selection formatting, and attached type menus. Preserve text selection and menu focus. |
| D15 | The Types submenu is attached. | It travels with its parent selection menu, flips at pane edges, and remains open while selecting a type. It is not a floating unrelated menu. |
| D16 | Hide scrollbar tracks and collapsed vertical tabs. | Content still scrolls with mouse, touch, and keyboard. No vertical “earlier panes” strips consuming space. |
| D17 | Tab hover or keyboard focus exposes contextual controls; pin semantics superseded by D19a. | Controls remain reachable by touch and keyboard. Closing a view does not delete its content or cancel a run. |
| D18 | Historical: pins restore the exact route (superseded by D19a). | A right-side Pins dropdown restores the chat, work tabs, focused destination, document path, reading anchors, and layout. |
| D19 | Historical: pins are navigation snapshots (superseded by D19a). | No extra pinned sidebar, no content rollback, no repeated agent actions. Unavailable paths remain visibly unavailable. |
| D19a | Favorites supersede pins (2026-09-19). | D18 and D19 are superseded: a pin snapshotted a whole workspace route and could only be restored into its own chat. A favorite bookmarks one tab (document, paper, website, file, review, terminal or side chat) and reopens it from any chat, after the tab was closed, by name. Tabs rename in place; a side chat's tab name is its title, a document tab's name is the document title. |
| D20 | Agent context is local to the conversation. | A compact composer control shows the working folder. Side-chat agents inherit that context when created. File viewing does not silently rebind a run. |
| D21 | Open the agent's project as an editor. | A chat action or working-folder menu opens files on the right. Expand if needed; Back to chat restores the conversation and split. |
| D22 | Start a chat from the current file's folder. | Create a new chat whose agent uses that folder, retaining the original chat and unsaved buffers. |
| D23 | Search and the content graph are central. | Search real permitted content and media; open the exact source; distinguish stored references/backlinks from ranked suggestions. |
| D24 | Prototype before full application delivery. | Preserve working interaction studies and an implementation-ready PRD. Do not present simulated actions as production integration. |
| D25 | Menus anchor to their control; questions are in-app dialogs. | A popup opens where its control is (below a toolbar button, above a composer chip) and never at a fixed window corner; all menus share one dismissal policy. Electron has no `window.prompt`, so nothing in the renderer calls `prompt()` or `confirm()`: page titles, names, model ids, link addresses and confirmations use the app's own dialog sheet. Settings is a sectioned sheet (General, Assistant, Barkpark, Shortcuts, About) with app-styled controls; appearance previews live and reverts on Cancel. |

**D26 (2026-09-21): Resizable sidebar.** Drag the left sidebar’s right edge to resize it; remember the width across restarts. Arrow keys adjust the focused edge, and double-click restores the default. Keep enough room for the active workspace.

**D27 (2026-09-21): People organize Pages.** Cloud discovery stays in a separate, initially collapsed Cloud archive. Opening a paper does not place it in Pages. People explicitly add, nest, reorder, or import a local copy; refresh and disconnect preserve that arrangement. The approved one-time migration moves legacy loose cloud roots into Cloud archive, preserves nested groups, and records the previous root order for recovery.

**D28 (2026-09-21): Direct assistant editing with visible intent.** Document edits apply without a Keep step. Mark the target, move an agent caret, and reveal replacement text in the real editor. Show only actual acknowledged changes, allow immediate human takeover, honor reduced motion, and skip animation in hidden panes. Offer revision-checked Undo. This supersedes review-before-apply for new document edits; file/command permissions and disabled cloud writes retain their existing scope.

**D29 (2026-09-21): Composer history.** Up from the first visual line recalls up to 100 sent messages in that conversation. Down from the last visual line moves forward and restores the original draft and caret. Preserve normal multiline navigation, text selections, modifiers and IME. Main and side chats keep independent histories. Save the original unsent draft while browsing so restart cannot lose it.

**D30 (2026-09-21): Side chats are full conversations.** Save and list them alongside other chats, with a persistent parent reference and a link back. They share the main composer and transcript actions: provider, model, effort, image attachments, history, approvals and activity. Inherit the parent folder and model choices at creation, then allow independent changes. Closing a tab never removes its conversation; deleting the parent preserves its children. Side-chat file activity belongs to its own workspace and working folder.

## Explicitly superseded directions

- Both the pinned sidebar and later Pins route-snapshot dropdown are superseded by D19a destination Favorites.
- The earlier “one top tab per document pane” model is superseded **in chat mode** by typed work tabs, each document tab retaining its internal path.
- A global project selector and a program-wide working directory are superseded by per-agent working context.
- Earlier status chrome, visible scroll tracks, and collapsed vertical rails must not return when implementing responsive layouts.
- The old editor study still demonstrates detailed editing behavior, but its shell is not the current navigation specification.

## Recommendations that are not settled user decisions

The PRD is historical design input. Its review-before-apply proposal is superseded by D28, single-connection assumption by profile ownership, and runtime-foundation proposal by the actual Electron implementation. Remaining choices belong to the active plan and architecture; do not use this historical list to reopen settled implementation or invent a new backlog.

## Direction set 2026-09-20

- **D-editor:** the standing goal is that the Barkpark canvas becomes as good as the Tiptap document tab, measured by the matrix in [EDITOR-PARITY.md](EDITOR-PARITY.md); editor parity is necessary but not sufficient for retiring the Tiptap tab. D31 and A2 additionally require complete owned-note lifecycle, migration comparison, interruption/resume and rollback proof before retirement. Editor fixes land in the Barkpark repo and reach Barkdown through the connected server's bundle, not a hand copy.
- **D-identity:** Barkdown is a note + agent app utilizing Barkpark. It runs the real Barkpark locally as a sidecar (its own Postgres cluster per profile) rather than reimplementing any of it, with optional cloud sync as the P4 target. Profiles may be cloud-backed or local-only; portable export is a P3 target requiring a consistent supported export, not zipping a live database. This supersedes the earlier assumption of "one active Barkpark connection" as the only mode.
- **D-headings (2026-10-03, owner ruling, plan #22): six heading levels.** This reverses the 2026-09-20 three-level decision (kept below). Notes offer H1–H6. The canvas configures `levels: [1, 2, 3, 4, 5, 6]`: the slash menu offers Heading 1–6, the block menu and the command palette offer Turn into Heading 1–6, `#### `, `##### ` and `###### ` make H4–H6, and Ctrl+Alt+1–6 (Cmd+Option on macOS) set the level. Ctrl+Shift+1–3 still set H1–H3; Ctrl+Shift+4–6 stay checklist, bulleted and numbered list. The Barkpark reader renders levels 4–6 as real `<h4>`–`<h6>` with their own sizes, and the editor matches them (View↔Edit parity gated). BPML spells `<h4>`–`<h6>`, and the markdown importer keeps the level. A level outside 1–6 is still shown at the nearest level and never restructured. A Card title keeps its three sizes. Barkpark PR #21521 (944a57a1e).
  - *Superseded 2026-09-20 decision: three heading levels.* Notes offered H1–H3 — what Notion offers, what Barkdown's Tiptap tab offered, and what the Barkpark reader rendered (`heading_level/1` folded anything else to H2). The canvas configured `levels: [1, 2, 3]`, and `#### ` stayed text. A deeper stored level rode the node and round-tripped byte-identically.

## Active direction — 2026-09-21 reset

**D31: Complete dependable journeys.** The primary roadmap is now [PLAN.md](PLAN.md): profile ownership, one Paper note engine, recovery and portability, optional sync, then installation and daily use. The editor-first plan is archived; its tests and working features carry forward. Local-only use is independent of cloud. Profiles own library/account data and conversations, while agent working folders remain per chat. Preserve backups and identities during adoption/migration. Do not mark stages complete by old issue counts or local branch tests alone. Existing accepted interaction decisions remain in force.

**D32: Work in evidence-backed cycles.** Plan bounded goals before implementation, maintain resumable handoffs during work, and close each cycle with tests, current screenshots where applicable and a repository-wide review of claims. Preserve unfinished/blocked status honestly and carry forward evidence and the next exact action. See [CYCLES.md](CYCLES.md).

## D-device-auth — Computer authentication by default (2026-09-23)

User decision: all profiles, main/side chats and goal runs use the computer's existing Claude/Codex logins and supported environment keys by default, without asking. No per-profile opt-in prompt or separate-account requirement. Explicit profile API keys retain precedence and ownership; other profiles cannot borrow them. Shared device login does not share workspace data, run destinations or folder permissions. Machine login files are not profile content or portable export payloads. Supersedes C039's archived opt-in proposal.

## D-managed-writers — Door or refuse, per audited cluster (2026-09-28)

User decision, taken on the agent's recommendation after the [direct-writer audit](cycles/evidence/C083/writer-audit.md). The [admission contract](migration/seal-admission.md) allows each writer to participate through a door or to be explicitly refused in managed mode; silent omission is never allowed.

- **Door:** the task-board verbs (one boundary at `Tasks.Internal.fenced_content_write/4` and `insert_mutation_event!/1`), the sync bookkeeping rows written by `Sync.Worker` and `Sync.PushWorker`, the note-adjacent writes (`Content.Edges.disconnect_references`, `Papers.Proposals`, `Papers.ValueWriteback`, `Broadcast.save_event` callers, `Bulldocs.Events`, `PaperAccess.record`), and the two media side writes (lazy renditions on GET, the lazy data-key insert). These touch notes, papers or media, which is migration state.
- **Refuse in managed mode:** Studio Chat and the cycle and epic fleets; tenancy and workspace administration; account, SSO, SCIM and access management other than login; operator surfaces (secrets, plugin settings and install, schema CRUD, codelist re-seed, webhooks, sharing, status incidents). A dedicated Barkdown instance does not offer these during a switch. Refusal is a router-level refusal for those route groups plus a fail-closed boot check, recorded per group.
- **Accept as bookkeeping, recorded:** per-request side writes that are not migration state: idempotency claims, preview-token JTIs, session and token last-used stamps, search analytics, audit rows for the paths above. They keep running during a hold and are listed as such in the evidence.
- **Two fixes the contract assumed already existed:** a managed instance refuses `:seed` and `:one_shot` boots outright, and `SchemaBootstrap`'s boot-time writes are declared pre-open (they run before admission opens) or moved behind it.

Effort follows this split: the refusal path is roughly a fifth of the code that doors for every cluster would be. This decision is revisited only if a refused surface turns out to be needed during a switch.

## D-hosts — Windows, macOS and Linux are all first-class (2026-09-28)

User decision. Development moved from the Windows source machine to a Mac for at least a week; the process must keep every desktop platform current without turning each update into a wait.

- **Host on every receipt.** Evidence for a cycle that touches `app/` names the hosts it passed on and the tests that skipped per host. A cycle is not delivered on one host's green alone.
- **Skip ratchet.** Platform-only tests (`skip: process.platform !== ...`) are counted per platform and pinned; the count moves only with its twin on the other platforms or a recorded, owned gap.
- **CI runs where it matters, not everywhere.** The desktop suite gets a lane per platform, gated to changes under `app/` and its workflow; documentation and plan changes never wait for it. The Windows lane is required from day one; the macOS and Linux lanes are advisory until they are green, then required. Full matrix runs also happen nightly on `main`, so a red that no PR caused still surfaces.
- **Visual baselines per platform.** Captures already record OS and font; approvals are keyed by platform so a Mac review never replaces the Windows one.
- **One host module.** Platform branches in `app/` live behind one module; new inline `process.platform` checks outside it are refused by a ratchet on the current count.
- **Twin rule.** A change to process, path, window or keyboard behavior ships with its twin on the other desktop platforms or records the gap as a cycle item with an owner. No platform-only features.
- **Return checkpoint.** The week on macOS ends with a bounded cycle on the Windows machine that reruns the native suites and re-accepts P1 on both hosts.

## D-migration-dedup — Migrated papers bypass the publish wall's near-duplicate gate (2026-09-29)

Agent decision under the user's standing mandate to keep the run moving; the user may reverse it. The upstream `DedupWall` scores title and tag tokens and refuses a new paper that near-duplicates a published one; it exists so an authoring corpus does not fill with duplicates. A library switch ingests a person's existing notes, where two notes with alike titles are still two notes, and every migrated paper also carries the same `migrated` tag, which inflates the score. So a staged paper declares `content.dedup_bypass: true`, the wall's own deliberate, logged escape ([corpus rehearsal](cycles/C083-writer-admission.md)). Alternatives considered: refusing the switch on the first near-duplicate (the person cannot rename notes from inside a fenced switch), or `content.supersedes` (which asserts replacement, a false claim). Revisit when upstream offers a migration-scoped exemption.

## D-migration-heading-only — A heading-only or empty note is named before the switch (2026-09-29)

Paper refuses a paper with a title and no body block, mid-create. Preflight now names such notes with a plain reason and the switch does not start; the person adds a line first. Content is never padded by the migration.

## D-migration-rollback-workspace — Rollback retains the Paper-era navigation and restores the legacy one exactly (2026-09-29)

Agent decision under the user's standing mandate; the user may reverse it. Ordinary use after a switch (opening a tab, a chat, expanding a page) rewrites `workspace.json`, so the first rollback driven from the app's own screen was refused as a "changed target". That change is navigation, not notes. The rollback now retains the current workspace as `selection/workspace-paper.json` (operation-bound, hashed into the journal as `workspaceRetained`) and restores the retained legacy workspace byte for byte; nothing is merged back. Chats, tabs and page changes made while on Paper are therefore absent from the restored navigation and kept on disk; the confirm sheet says so. Alternatives considered: refusing (the person cannot roll back after touching anything), or merging chats and tabs into the legacy navigation (a partial reverse projection with its own edge cases). Revisit when a reconciliation view exists.

## D-migration-successor-baseline — A rollback after a restart accepts the baseline of the preceding preparation (2026-09-29)

The comparison baseline is bound to the preparation that captured it (id, closure, writer generation, retained drafts). A completed switch aborts that preparation and the app restarts; the rollback then runs under a new preparation whose `previousId` is the switch's. In that one case the fence identity is allowed to differ; the profile, source hash, backup manifest, projection and runtime binding must still match, and the caller still pins the baseline hash. Any other preparation is refused as before. Without this, every rollback from the app recorded a divergence and demanded reconciliation for nothing.

## D-hosts-ordinary-workers — Ordinary turns are owned workers on every host (2026-09-29)

Agent decision under the user's standing mandate and the D-hosts twin rule; the user may reverse it. C014 gave managed ordinary and side conversations the owned process-tree lifecycle of goal workers on Windows only; on macOS and Linux the profile service still ran turns in-process, so after a crash the recovery banner could only say "This older attempt has no owned-process receipt" and the person stayed blocked. Since C084 `goal-process.js` contains a worker in a process group on POSIX with the same receipts and verification as the Windows job object, and goal workers already run that way everywhere. The profile service now defaults to the owned worker agent on every host; the chat-recovery tour runs on macOS and its Windows-only skip is gone (ratchet 3 → 2). Recovery verification and owned-group checks trace to main's stderr as `[recovery]` and `[owned]`. Not changed: the terminal tour and the terminal half of the preparation tour stay Windows-only (a PowerShell-specific tour; POSIX twin pending).

## D-hosts-terminal-workers — The terminal is an owned worker on every host (2026-09-29)

Agent decision under the D-hosts twin rule; the user may reverse it. Off Windows the shell was a plain spawn: no session journal, exits reported unverified, and `status` answered `new` after every restart, so a shell left running by a crashed Barkdown was nobody's. The owned worker that already hosts goal and ordinary turns now hosts the shell on every platform, with the same journal, ownership across restart and verified shutdown. The terminal tour, the preparation tour's terminal half and the three terminal unit cases speak the host shell (PowerShell or `$SHELL`) and run on macOS (`c80038e7`). Remaining Windows-only site: the credential-durability tour (DPAPI).

## D-hosts-credentials — Credential durability is proven on every host; the key-file refusal stays Windows-only (2026-09-29)

The credential tour (save an API key and a server token, crash the host, decrypt after restart, profile isolation) now runs on macOS: `safeStorage` reports the OS store available and the values are `enc:` at rest and readable after a SIGKILL restart. The Local State key-file checks and the refusal when that file is corrupted are DPAPI-specific by design; the Keychain has no local key file to corrupt, so those two halves stay Windows-only and are counted by the ratchet (inline halves 1 → 3, live files skipped off Windows 1 → 0). No live tour is skipped off Windows any more.

## D-migration-reconcile-actions — A reconciled difference is kept or restored, never merged blindly (2026-09-29)

Agent decision under the user's standing mandate; the user may reverse it. After a rollback records a divergence, each changed Paper gets exactly one of two decisions in Settings: **Keep on Paper** records that the current Paper stands; **Restore staged text** replaces the Paper's blocks with the text the switch staged (or, for a pre-existing Paper, the pre-switch baseline) as a new revision under the Paper's current revision, through a writes lease on the profile runtime. Both are journaled per Paper (`reconciled` on the rolled-back selection); the divergence itself stays on record, and the reconciliation demand clears once every changed Paper has a decision. Restore is confirmed in place with a second click, because a confirmation sheet would replace the Settings sheet in the shared dialog host. Not offered: a merge of the two texts, and any write to the legacy notes.

## D-cycle-order — P3 groundwork starts while P2 waits for Windows (2026-09-29)

Agent decision under the user's standing mandate ("we still have 6 days until Windows is back"); the user may reverse it. P2's remaining exits are a real library and the Windows return checkpoint, both bound to a machine that returns about 2026-10-05. Rather than idle, [C085](cycles/C085-portable-profile.md) starts the portable profile of P3 on macOS, building on the hold that C083 delivered. P2 stays active in the plan and is not claimed complete; nothing in C085 retires legacy or changes a default.

## D-read-only-render — Retained originals without the editor (2026-09-30)

Agent decision under the retirement go. A retained original or a read-only copy is rendered from its blocks by `shared/doc-html.js`, in the markup the note styles know, with no editor mounted: nothing on such a page can be edited by accident, and the editing packages are needed only where editing is still allowed (until R4). Links open as before; history, references and proposals read as before.

## D-runtime-default — A new profile starts on a known runtime (2026-09-30)

Agent decision under the retirement go (R3). A profile that has never been configured runs the runtime the application carries, or else the runtime folder this installation last started, remembered in the app settings. A profile that has been configured keeps its own choice, cloud or local. New page is therefore a Paper from the first launch on any installation that knows a runtime.

## D-profiles-default — Profiles are the ordinary launch (2026-09-30)

Agent decision under the retirement go (R2). An ordinary launch opens profiles; `--legacy` keeps the single legacy library for development tours until R4 removes it. A legacy library found at an ordinary launch, with no profile registry beside it, is offered for adoption at once (prepare or quit), through the adoption window that already exists; nothing is adopted without that choice, and nothing legacy is deleted.

## D-cloud-references — A reference to the cloud stays a reference; a copy is ours (2026-09-30)

User decision. Notes that point at a cloud Barkpark are references: they are not given the local owner when a library is switched, and when access to the cloud is withdrawn they go with it. A note or folder duplicated from the cloud is ours from that moment and is used like anything we wrote. Nothing in Barkdown polices what people share: once something is on the internet, copies exist, and the person who shared it knew that. Barkdown makes collaborating easy and makes it clear what is a reference and what is a copy. This settles the question C083 left open and sets the ground for sync (P4): share, withdraw, duplicate.

## D-picture-retention — Two sets of pictures in the tree (2026-09-30)

User decision. The repository keeps the two newest visual runs per platform plus every run an approval names, and the two newest sets of status screenshots. Everything older stays in git history, and links to it in old cycle records say so. `scripts/visual-retain.mjs` applies the rule after every capture and approval; `npm run check` refuses a tree that exceeds it.

## D-legacy-retirement — Go (2026-09-30)

User decision: retire the legacy editor, stage by stage as [legacy-retirement.md](migration/legacy-retirement.md) lays them out, R1 first.

## D-packaged-runtime — A release beside the checkout (2026-09-30)

Agent decision; the user may reverse it. With Windows away, installation groundwork starts on the Mac, the way portability groundwork started while migration waited. A profile's runtime folder may be a packaged Barkpark release instead of a source checkout; the driver tells them apart by their contents, so nothing else in the app changes. The release is built from a checkout by a script and stamped with its commit, because a release has no git history to ask. The keys the production server demands are derived from the profile's database password: stable across boots, different per profile, nothing new to store or lose. The node is not distributed and is stopped through its process group. The checkout path stays for development and for Windows, where upstream has no release yet.

## D-save-again — A save the library did not answer (2026-09-30)

Agent decision; the user may reverse it. It supersedes the rule that a failed save is only ever repeated by the person. When the library does not answer, the note keeps the words as a retained draft at once and sends the save again when the library reports ready. The save carries the revision it was written against: if the unanswered attempt did land, the revision has moved and the person gets the ordinary conflict, never the words twice. A save the library refused for a reason (a conflict, a changed connection, read-only) still waits for the person.

## D-portable-version — Which exports a Barkdown imports (2026-09-29)

Agent decision; the user may reverse it. An export names the Barkpark commit it was taken at. A Barkdown imports an export of its own version or of an earlier one that its runtime's checkout descends from; the first boot of the imported runtime brings the database forward the way any update does. An export of a later or unrelated version is refused: a runtime cannot read ahead. Where the checkout carries no history, only the same version is accepted.

## D-media-origins — Pictures of an imported library (2026-09-29)

Agent decision; the user may reverse it. Notes store a picture's address with the origin of the runtime it was uploaded to, and an imported profile runs on another port. The import does not rewrite the restored database: content lives in several upstream tables and their history, and a rewrite there cannot be taken back. Instead the export records the origin, the import keeps it with the origins that library already carried, and the app answers requests for media at those loopback origins from the profile's current runtime. The cost: the address shown in a note, and read by an assistant, still names the exporting port.

## D-writer-settled — An answered write is settled (2026-09-29)

Agent decision; the user may reverse it. The writer journal kept every failed write uncertain, and one uncertain write refused every later preparation with no way to clear it. A write the server answered has ended at the server, whatever the answer, so it is settled; the operations that follow hold the runtime and read its actual state. Only a write without an answer stays uncertain. When this host has started the profile's managed runtime anew, the runtime writes of a host that no longer runs are settled too: the runtime they were sent to is gone. Local document writes are not settled this way.

## D-runtime-recover — Who reopens a runtime in recovery (2026-09-29)

**Superseded in C097 (7 October):** automatic operation/launch recovery requires explicit zero pending, live-writer and dead-writer counts. Nonempty or malformed evidence stays closed for reconciliation. An empty journal still does not prove historical media consistency: open-phase writer death can discard pending evidence while leaving bytes. [Measured limits](cycles/evidence/C097/media-open-death-review.md). The original decision below explains the prior behavior, not the current recovery rule.

Agent decision; the user may reverse it. Upstream asks for explicit recovery after the uncertain effects are reconciled. In Barkdown the reconciliation is the journal of the operation that held the runtime: the switch, the rollback, the comparison and the export each recover the runtime before they hold it again and then read the library's actual state. With no operation in flight there is nothing to reconcile, and the launch reopens it. An interrupted switch or export keeps the runtime in recovery until it is resumed, rolled back or discarded.

## D-portable-interrupt — Nothing resumes a half-written export or import (2026-09-29)

Agent decision; the user may reverse it. An export is one held state of the library; a half-written one cannot be completed later against a library that has moved, so it is discarded and taken again. A half-restored database is likewise never continued: the unfinished import is removed from the profile list and imported again from the export folder its journal names. Discarded folders go to the system trash, never deleted. An unfinished import cannot be selected. The registry can remove a profile, never the selected one.

## D-runtime-reclaim — A leftover runtime is stopped only on proof (2026-09-29)

Agent decision; the user may reverse it. A runtime left by a dead host is stopped at the next launch when the launch record in its own data folder names its process and the start time still matches; a recycled process id is left alone, the private database is addressed only through its directory, and a record whose host still runs is refused. Processes are never found or stopped by name.

## D-portable-app — Export and import as Settings actions (2026-09-29)

Agent decision; the user may reverse it. Export and Import live in Settings, General, Storage, beside the profile list. The main process chooses the folder through the native picker and keeps it; the window never names a path. An export always ends its preparation, whether it completed or failed, and the restart notice names the outcome: there is nothing to resume in a half-written export, so a failed one is moved to the system trash and taken again. Import never selects the new profile by itself; it is chosen in the list and opened with Switch. Counts shown to the person are published Papers plus draft-only notes, which is what the library lists.

## D-portable-export — What travels in a profile export and what never does (2026-09-29)

Agent decision; the user may reverse it. **Travels:** a logical dump of the profile's own database (never a copy of a live data directory), the owned media, the workspace with its conversations and drafts, retained originals, agent edit receipts, the deleted-notes registry, the selection journal with its retained evidence, and settings without their encrypted fields. **Never travels:** runtime credentials, OS-encrypted keys and tokens, the navigation owner key, ports, writer and preparation fences, caches. **Taken how:** on a prepared profile, under the upstream hold, so the dump, the media and the files are one state. **Imported how:** into a new profile only, never merged into an existing one; the same Barkpark version; a private cluster that has never booted; the exporter's token rows removed before first boot; the profile id and navigation owner rewritten for the importing library, retained originals and rollback evidence copied verbatim. Alternatives considered: copying the data directory (not portable across Postgres versions and unsafe while running), exporting through the HTTP API (loses revisions, history and drafts), keeping the owner key (would let two libraries claim the same navigation identity).

C097 clarification (2026-10-07, agent decision): exported source files and verified archive payloads must be regular files with one hard-link name and no file symlink. Multiple names refuse even when apparently inside the profile because ownership of every name is unproven. Static directory links already refuse. This does not certify filesystem substitution-race safety or all ancestor aliases. [Evidence](cycles/evidence/C097/export-file-alias-review.md).

## D-browser-import — Bookmarks and history are copied; signing in happens here (2026-10-02)

User decision (2026-10-02). *Import from Chrome* copies the bookmarks and the history of a Chromium profile on this Mac into a Barkdown profile, on demand, never silently; the source browser is not written and nothing is synced. Sessions and saved passwords are not lifted out of another browser: the person signs in once inside Barkdown, and the profile's persistent partition keeps it. A tab names Chrome and not Electron in its user agent so sign-in pages treat it as a browser.

## D-popups-beside — A sign-in popup is a child window; a new-tab link is a tab beside (2026-10-02)

Agent decision; the user may reverse it. `window.open` from a website tab makes a child window of the main window in the same partition, so a sign-in flow can report back to its opener and close itself. A link that asks for a new tab (`target=_blank`, a modifier click) opens a Barkdown tab right after the tab that asked, in the same chat, even when a tab for that host already exists; it never becomes a window. Permission requests for the camera, microphone, notifications and location are asked in Barkdown's words once per site and remembered, with Settings › Browser to forget them; everything else is answered by policy.

## D-browser-pauses — The browser asks before five kinds of action, in the window, for every agent (2026-10-02)

Agent decision; the user may reverse it. When an agent acts in Barkdown's browser, five classes of action pause for the person's answer in the window — a purchase or payment, sending or publishing, a password, a deletion, an account change — whatever the agent and whatever process the run lives in, because the pause is enforced where the tabs are driven (`browser-tools.js`), not in a provider. *Ask before every action* pauses on every click, keystroke and address; reads never pause. An allow-list of hosts makes any other site pause. A page dialog is dismissed and reported rather than left blocking. A tab the agent opens in logged-out mode runs in a private in-memory partition with none of the person's sessions. A refusal, or no answer within five minutes, is a tool error the model can act on; nothing retries by itself.

## D-context-channel — The workspace note rides the system channel where one exists (2026-10-03)

Agent decision; the user may reverse it. The `[Workspace context]` note (the run's folder, what the other chats are doing) used to be prepended to the person's message. Pasted text could forge it, and it cost its tokens on every turn. For Claude Code and the API loop it is now appended to the system prompt; Codex has no per-turn system channel, so its prompt keeps the marked block. A run's own tools come from Barkdown alone: the user's claude.ai settings are not loaded into Barkdown's runs.

## D-chat-renders-like-documents — One Markdown path for replies and documents (2026-10-03)

Agent decision; the user may reverse it. A reply in the chat is rendered by the same converter and markup as a document (`shared/markdown.js`, `shared/doc-html.js`): tables, task lists, nested lists with their numbering, quotes, code fences, strikethrough. The models write GitHub-flavored Markdown because their harness tells them to; the pane now shows it, and the system text says so. The hand-rolled renderer remains only as a fallback for text the converter refuses.

## D-real-terminal — The terminal tab is a pty behind an emulator, with the ownership contract unchanged (2026-10-03)

Owner decision (C090): the terminal must hold an interactive program and work on both Mac and Windows, like PowerShell or Ghostty. The pipe-and-textarea tab is replaced by a pty (node-pty: the login shell on macOS, PowerShell 7 or Windows PowerShell through ConPTY on Windows) inside the same owned worker, drawn by xterm.js by default; Ghostty's VT core (ghostty-web) is an engine chosen in Settings and falls back to xterm.js when it cannot load. The ownership rules stay: one shell per tab, a journal, a verified stop, refusals in words. The per-tab command draft is gone — a half-typed line lives in the shell's line editor. Find is absent on the Ghostty engine; the renderer's CSP allows WebAssembly compilation (`wasm-unsafe-eval`) and nothing else new.

## D-terminal-mirror-strip — The assistant's commands show beside the terminal, not inside it (2026-10-04)

Agent decision; the user may reverse it. The tab used to write the assistant's commands and output into the emulator between the shell's own lines. On Windows ConPTY keeps its own model of the screen and overwrote those lines with the shell's next output (seen on a hosted runner); on any platform they would scribble over a full-screen program. They now appear in an "Assistant ran" strip under the terminal — collapsible, clearable, newest in view — and the shell's screen belongs to the shell.

## D-one-terminal-engine — xterm.js is the terminal's only emulator; the Ghostty engine is removed (2026-10-04)

Owner decision; it supersedes the Ghostty option in D-real-terminal. For one day the terminal offered ghostty-web as a second engine in Settings. It was not Ghostty's renderer, only its text parser behind a simple canvas; it had no Find, no live theme change and no scroll position; it needed five workarounds in Barkdown (its WebAssembly loading, an inverted key handler, a scrollbar strip that blanked text, a click that overwrote the clipboard, its sizing) and an exception in the renderer's security policy for WebAssembly compilation. The engine, its setting, the dependency and that exception are gone; the policy is what it was before C090. A stored `terminal.engine` value from that day is simply not read. If Ghostty's quality is wanted later, the route is a native terminal view per platform, a separate and larger project.

## D-no-approvals — The assistant acts without asking unless the person chooses to be asked (2026-10-04)

Owner decision. Until now a run asked before it wrote a file, ran a command, touched a file outside the working folder or used a connected tool that changes something; the owner found the cards a constant interruption. The default is now no approvals, and a chip under the composer (also Settings › Assistant) switches asking back on, live, for runs in flight too. The browser's pauses on sensitive actions (D-browser-pauses) are untouched and keep their own setting.

## D-one-assistant-chip — Provider, model and effort are one chip with one menu (2026-10-04)

Owner decision. The composer showed three chips (provider, model, effort), each with its own menu. They are one chip that names the model and effort in force and opens one menu: provider across the top, that provider's models, effort as pills. Changing the provider resets the chat's model to that provider's default.

## D-barkdown-servers-only — A run carries Barkdown's servers and no account connectors (2026-10-04)

Agent decision carrying out the owner's C089 F2 ruling; the user may reverse it. The claude.ai connectors (Claude Docs, Gmail, Calendar, Drive) were meant to stay out of Barkdown chats since F2, but `settingSources: []` did not exclude them. `strictMcpConfig` does. They pulled documents out of the library (Claude Docs' instructions tell the agent to make docs there), repeated a sign-in notice and dropped out and came back mid-chat, for about 2.9K input tokens a turn. If a connector is wanted in Barkdown later, it becomes a setting.

## D-library-on-by-default — A profile gets its local library unless the person decided otherwise (2026-10-04)

Agent decision; the user may reverse it. Saving any setting used to store an empty, switched-off Barkpark block, and the profile then never received the carried runtime. A block that is all off and empty and never saved from Settings › Barkpark counts as never configured. A disconnect states its reason.

## D-barkdown-controls-itself — One command catalogue, for the command line and for assistants (2026-10-04)

Owner decision: everything a person can do in Barkdown should be reachable from a command line, so Barkdown can operate itself: add agents, write notes, use the app as a person does. One catalogue (`app/shared/control-commands.js`) names every command. The `barkdown` command and the assistant's `app` tool both send commands from it to one gate in the main process (`app/main/control.js`), and the window carries a command out with the same function a click calls. An agent is a chat: `barkdown agent add` starts one. A helper chat started by an assistant does not take the person's view.

## D-full-yolo — Administrative control is a switch only a person reaches (2026-10-04)

Owner decision: a "Full YOLO" switch in Settings lets Barkdown control every part of itself, and the one thing Barkdown may not do is turn Full YOLO on or off itself. Everyday work (chats, messages, notes, tabs, the terminal) needs no switch. Settings, profiles, deletions, the library and update checks need Full YOLO. The switch lives in Settings › Assistant, has its own request to the main process that no command handler calls, is held in the main process's memory and read once at launch from a value sealed with the system keychain, so a file edited while the app runs changes nothing. Agent reading of "turning on / off": no command quits, restarts or starts Barkdown, or installs an update, Full YOLO or not; the user may widen that. Secrets (API key, tokens) and the runtime path are never written by a command.

## D-wider-catalogue — The catalogue reaches notes, profiles, the switch, sign-in, goals and images (2026-10-05)

Owner decision to widen the catalogue (C095); the tiering is the agent's and the user may move a command. Editing a note's text, undoing that edit, recovering a deleted note, goals and images on a message are everyday work. Deleting a note, exporting and importing a profile, the Paper switch and its rollback and reconciliation, and starting a provider sign-in need Full YOLO; Full YOLO stands in for the confirmation sheets a person clicks. Four things stay a person's: accepting, retrying or completing a goal worker's result and confirming a worker has stopped (each is a person's word that something was verified), the restart a finished export or switch asks for, and signing out (Barkdown has no sign-out). `note edit --mode replace` needs the revision the caller read, so a note changed since is never overwritten. `--image` reads a file only when its bytes are a PNG, JPEG, GIF or WebP. A refusal before an edit is sent counts as answered by the writer fence, not as an uncertain write.
