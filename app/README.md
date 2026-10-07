# Barkdown desktop

[Provider sign-in assistance](../docs/visual/provider-login/README.md) records source `1c94f8d`: preserved main/side drafts and images, browser-login lifecycle controls, explicit retry and shared goal help. Actual Electron UI uses controlled transports; it is not a real account-login claim. See C039 for remaining integration gates.

The experimental [goal coordinator](../docs/goals/HANDOFF.md) runs in profile-owned conversations. Profiles are the ordinary launch; the earlier opt-in Windows evidence below retains its original scope. [C015 source 61eea4d](../docs/goals/evidence/61eea4d/README.md) passes authenticated Codex planning/three workers/evidence reviews/summary, actual Electron planning-crash recovery, full desktop/root and inspected fixture/live gates. [C020 test source 17c2cc8](../docs/goals/evidence/17c2cc8/README.md) adds verified stop races and native interrupted review/summary recovery with fresh desktop/root and visual evidence. [C023 source 3e9c0a9](../docs/cycles/C023-windows-atomic-write.md) passes 44 focused and 68 goal/native checks; its original final desktop/visual/live/root gates passed with [retained logs](../docs/goals/evidence/3e9c0a9/README.md), with subsequent combined integration evidence recorded in [C008](../docs/cycles/C008-integration.md). [Goal visual health](../docs/visual/goals/README.md) separates fixture, actual Electron and authenticated evidence. The C015 proof used workers sharing a captured folder. In the app, each saved worker conversation has its own folder/provider/model choices; explicit Start or Resume captures the pending task choices. Shared-folder assignments must be disjoint or dependency-ordered; no automatic worktrees are created. Model reviews are not human verification; uncertain effects require a person. These checks do not establish broad goal completion, power-loss durability or cross-machine portability.

[Earlier authenticated worker concurrency](../docs/goals/evidence/beefded/authenticated-codex.json), [crash-dialog recovery](../docs/goals/evidence/e9be019/README.md) and [C013 saved-credential crash proof](../docs/goals/evidence/f7d91e6/README.md) remain separate evidence. The coordinator shares a three-turn admission cap and disables native delegation.

The working Electron application: notes and conversations on the left, agents and their work alongside them. [Product overview](../README.md) · [Active roadmap](../docs/PLAN.md) · [Contributing](../CONTRIBUTING.md)

Code-area health: [Main process](main/README.md) · [Renderer](renderer/src/README.md) · [Work tabs](renderer/src/tabs/README.md).

## Run and verify

Coordinator failure diagnostics retain the fixture's launch records, receipt read errors, bounded Electron stderr and Windows descendant identities. They omit command lines and environment. The [retained hosted startup failure](../docs/cycles/evidence/C097/hosted-desktop-22-failure/failure.json) reached a running plan but had no HTTP request or receipt; its cause remains unconfirmed. These diagnostics do not alter worker behavior, waits or assertions.

The native coordinator journey targets Enter at the quick-open input, confirms the selected Goals command and retains navigation state/screenshots on failure. A controlled focus-loss regression covers this harness boundary; it does not establish the cause of every hosted timeout. The coordinator regression suite waits for persisted states with a bounded polling helper. [C097](../docs/cycles/evidence/C097/coordinator-ci-01/result.json) passes all104 adjacent checks; a [delayed transport case](../docs/cycles/evidence/C097/coordinator-slow-after/result.json) verifies three-attempt retry and person reconciliation without changing production deadlines.

From the repository root:

```sh
npm --prefix app ci
npm run desktop
npm run test:desktop
```

From `app/`, `npm start` builds and launches; `npm run dev` also opens DevTools. Requires Node 22.13+ and a desktop session. Install Playwright Chromium from the root before the Electron test suite. Live runtime/editor suites have additional prerequisites in [validation](../docs/VALIDATION.md).

## What runs today

| Surface | Implementation |
|---|---|
| Notes | Real Barkpark Paper canvas, PortableDoc ops, acknowledged save, revision conflicts, server echo and guarded assistant Undo. Managed local New Page and API/MCP creation use exact drafts; [human proof](../docs/visual/paper-notes/README.md) and [agent proof](../docs/visual/agent-notes/README.md) distinguish accepted scope and remaining limits. Retained legacy documents are read-only; Settings switches them to Paper with comparison, recovery and rollback ([C087](../docs/cycles/C087-legacy-retirement.md)). |
| Conversations | Shared main/side composer, provider/model/effort controls, images, 100-message recall, independent drafts and saved parent links. |
| Workspaces | Per-chat working folders and tabs for notes, project files, websites, terminal, reviews and side chats. Favorites reopen individual destinations. |
| Pages | Human-controlled nesting and order. Cloud discovery stays in Cloud archive; opening a paper does not place it. |
| Agent work | Document read/search/create/direct-edit tools, visible activity, revision checks and Undo. File/command permissions retain their provider-specific boundaries. |
| Local runtime | Windows source launcher with private PostgreSQL, health checks, recovery and owned shutdown. Requires a built Barkpark checkout; macOS nightlies carry a runtime. Current Windows proof is in [C097](../docs/cycles/C097-windows-return.md). |

## Providers

| Provider | Connection | Execution boundary |
|---|---|---|
| Claude Code | Existing local login, Claude Agent SDK | Per-chat sessions and folder; approval handling for file edits/commands |
| Codex | Existing local login, Codex SDK | Per-chat sessions; sandboxed to the captured folder, read-only without a folder |
| Claude API | Key in Settings or environment | Barkdown's streaming tool loop and tool approval handling |

The provider truth runner (`tests/providers.live.mjs`) classifies what a provider did to one note; since the legacy retirement its successful edits land on a Paper, so `npm run test:providers-runner:isolated` runs every scenario under the isolated runtime (point `BARKDOWN_TEST_BP_SOURCE` at a packaged release under `runtime/`), and the plain `test:providers-runner` skips the three that need it.

No-folder conversations remain valid. A folder selected in the composer never scopes the global sidebar. Side chats inherit settings once and may change them independently.

## Source map

| Directory/module | Owns |
|---|---|
| `main/main.js`, `preload.js` | Native window, settings and IPC boundary |
| `main/profile-registry.js`, `profile-service.js`, `workspace-repository.js` | Main-owned profile identity, workspace persistence and captured conversation context |
| `main/store.js`, `documents.js`, `conversations.js` | Bound local stores, document revisions and conversation reads; retained legacy notes remain readable before switching and after rollback |
| `main/migration-preflight.js` | Offline P2 inventory, structural refusals, exact backups and restartable preparation |
| `main/migration-references.js` | Canonical same-profile references resolved before staging and rewritten to native ID-pinned wikilinks |
| `main/migration-images.js` / `migration-media.js` | Captured owned PNG validation and single-attempt upload reconciliation with exact binary readback; unsupported sources refuse |
| `main/migration-staging.js` | Durable intent, insert-only Paper staging and exact readback/restart reconciliation; no UI wiring or authority switch |
| `main/migration-restore.js` | Verified committed-backup restoration into an empty closed legacy profile; never overwrites later human data |
| `main/migration-workspace.js` | Hash-bound offline navigation preview preserving human Pages, favorites and chat paths; explicit blockers, no authority switch |
| `main/migration-evidence.js`, `original-history.js` | Verified retained history and profile-owned backup references; Settings → Original history reads original revisions, proposals and receipts with no executable historical actions. [Native evidence](../docs/visual/original-history/README.md) |
| `main/local-barkpark*` | Private runtime lifecycle and Windows source bootstrap |
| `main/barkpark.js`, `canvas-bundle.js`, `agent-edits.js` | Barkpark adapter, editor delivery and edit receipts |
| `main/providers/`, `agent.js`, `mcp-server.js` | Provider orchestration and document tools |
| `renderer/src/state.js`, `index.js`, `composer.js`, `tabs/` | Workspace state, shared composer and tab hosts |
| `shared/` | PortableDoc/Markdown and operation helpers |
| `tests/` | Unit, Electron and live adapter/editor checks |

The canvas loads from the connected Barkpark, with cached and vendored fallback. The consumed fallback baseline is merged Barkpark commit `b702140907921e82e9ce5eecb3e2445f13ab2d6e` (PR #20020). [C074](../docs/cycles/C074-original-history.md) records exact bundle reproduction, preserved notices and the consumed-baseline validation. [The parity matrix](../docs/EDITOR-PARITY.md) carries the exact proof and limitations. Preserve vendored licenses. Selection remains connected server, then verified profile-owned cache, then vendored fallback. Updating the fallback or parity pin does not upgrade an older reachable server or valid old cache; a renderer restart is needed to change its loaded custom element. [The historical consumption audit](../docs/EDITOR-CONSUMPTION-AUDIT.md) preceded E011; [original consumption evidence](../docs/visual/fallback-consumption/IMPORT.md) now proves bounded fallback compatibility against private a544 and54579 servers.

## Remaining work

P1–P5 deliver profile isolation, migration to one editor, interruption recovery and portability, optional sync, and clean-machine installation. Unsaved project buffers are still session memory. The Windows runtime still requires a source checkout. Original native checks cover bounded profile isolation and process-death recovery; C035 additionally proves the unpacked Electron38 application’s terminal ownership. Clean-machine installation, bundled Barkpark, other platforms, whole-profile portability and sync remain unproved. P1 is accepted at C039; P2–P5 remain unfinished.

Use [the local-runtime guide](../docs/LOCAL-BARKPARK.md) for setup and [the acceptance scenarios](../docs/ACCEPTANCE.md) to decide when a stage is complete. The prototype uses direct provider adapters; no T3 runtime import is claimed.

## Visual health by area

- [Workspace navigation](../docs/visual/workspace/README.md): renderer shell, sidebar, tabs and quick open.
- [Main chat](../docs/visual/chat/README.md) and [side chat](../docs/visual/side-chat/README.md): shared composer and conversation controls.
- [Local documents](../docs/visual/documents/README.md): the legacy editor retained pending P2; live Paper evidence remains in the root gallery.
- [Settings](../docs/visual/settings/README.md): preferences and connection controls.
- [Goals](../docs/visual/goals/README.md): component stills/GIFs; [actual coordinator recovery](../docs/visual/coordinator-recovery/README.md) and [authenticated C015 execution](../docs/goals/evidence/61eea4d/README.md) are separate evidence.

Each page contains a still, recorded interaction GIF, provenance and changelog. [Rules and coverage limits](../docs/visual/RULES.md) distinguish visual review from functional/runtime proof.

- [Terminal ownership](../docs/visual/terminal-ownership/README.md): C018 native process proof passed; combined actual UI/evidence closeout pending.

- [Project-buffer preservation](../docs/visual/project-buffers/README.md): actual CodeMirror refusal preserves unsaved text until explicit Save.

- [Editor cache integrity](../docs/visual/cache-integrity/README.md): C025 corruption refusal, owned repair and profile-isolated fallback reviewed at b93f832; combined source validation remains separate.

C026: shared composers preserve draft text and images until start acknowledgement, guard duplicate sends and newer typing, and expose keyboard/touch attachment removal. Human errors retain exact collapsed diagnostics. [Actual managed and legacy evidence](../docs/visual/send-preservation/README.md) covers rejection, restart and explicit retry; unknown dispatch outcomes are never labelled not started.

E009 clipboard fixture and original evidence are imported. The original scoped behavior was proven on connected upstream3495 while the vendor was a544. Use `test:rich-clipboard:isolated` with the explicitly built3495 source. [Evidence](../docs/visual/rich-clipboard/README.md); E011 subsequently consumed54579 with separate original native fallback proof.

## Imported milestone health — 22 September 2026

At audited candidate `3ce6b21`, the coordinator reports full desktop52348 passed at source `5e8433e`. C036 capture-lifecycle changes were imported afterward and independently pass17 controlled cases; that full-suite pass does not cover them. Dedicated combined journeys, deterministic review, live status and root closure remain pending. Global approvals still describe the earlier fallback; no P1 completion is implied.

- C016: [actual two-profile restart manifest](../docs/visual/profiles/isolation-runs/2026-09-22T04-04-36-864Z/manifest.json), source `34ef068` with a544; original reading position, draft, media and A-only Undo proof.
- C026: [managed gallery](../docs/visual/send-preservation/runs/1e138aa-managed/manifest.json) and [legacy gallery](../docs/visual/send-preservation/runs/1e138aa-legacy/manifest.json), final `1e138aa`; full44651 remains attributed to pre-CSS80ba196, with final keyboard removal covered by actual targeted proof.
- E009: [native clipboard gallery](../docs/visual/rich-clipboard/runs/2026-09-22T04-50-27-798Z/manifest.json), Barkdown `25cb114` / connected upstream3495. This historical proof did not update the then-vendored a544 fallback; E011 subsequently did.
- C028: [runner failure enforcement](../docs/cycles/C028-parity-exit.md); 24 controlled runner cases pass, while historical root freshness remains separate.
- [Third-party notices](../THIRD-PARTY.md): 49-package metadata/license/provenance audit and E011 exact54579 editor assets/pin are imported.

- E011: [original fallback import](../docs/visual/fallback-consumption/IMPORT.md), 755 blobs and 53 review hashes verified; original native old/new-server, full/visual/live/root gates passed, combined gates pending.
- C032: [native refusal and restart motion](../docs/visual/folder-preflight/README.md), original8b51fbc, six stills/four videos/two GIFs; no provider dispatch.
- C033: [context reservation](../docs/cycles/C033-context-reservation.md), 15 controlled races; no native race claim.


## Current journey links

| What a person can do | Source-bound evidence and limit |
|---|---|
| Plan a goal and open three full worker chats | [C015 actual coordinator](../docs/goals/evidence/61eea4d/README.md), [C020 interruption/retry views](../docs/visual/coordinator-recovery/README.md). Worker chats retain parent links and ordinary controls; model reviews are not human verification. |
| Keep an unavailable selected folder without losing an unsent prompt | [C032 actual main/side and selected-B motion](../docs/visual/folder-preflight/README.md), source8b51fbc. Ordinary Claude/Codex refuse before dispatch; API/null-folder paths are unchanged and goal-worker preflight is outside this slice. |
| Switch profiles and recover explicit missing data | [C016 two-runtime restart/Undo GIF](../docs/visual/profiles/isolation-runs/README.md), [C012 missing/corrupt workspace stills](../docs/visual/workspace-recovery/README.md), [C022 repeated cold-adoption GIF](../docs/visual/adoption-repeat/README.md). No automatic repair or cross-machine portability claim. |
| Launch the packaged Windows application | [C035 Electron38.8.6 gallery and original videos](../docs/visual/packaging38/README.md), source89a0fd2. Unpacked EXE terminal switch/crash/restart passed; this is not a clean-machine installer or bundled-runtime proof. |

C034’s [actual Codex read/edit/read and stopped Job receipt](../docs/cycles/evidence/C034/codex-7e07099/manifest.json) is a local-document test at7e07099, not a screenshot tour, Claude pass or remote Paper proof. Device CLI login and environment API keys remain separate from profile-owned encrypted secrets. Electron43/44 upgrades remain unconsumed; E012's bf23f773 editor baseline was subsequently consumed in C008.

### C039 authentication recovery work

Initial Settings discovery now checks supported CLI status, including keyring-backed sessions, while keeping an explicitly selected provider. Shared computer login/environment authentication remains the default; owned API keys retain precedence. An expired accepted turn keeps its original message in the transcript and offers sign-in assistance plus an explicit copy into an empty draft. Copying never overwrites newer input or resends work. Quota, transport and tool-permission failures are not classified by broad authentication keywords.

The accepted [C039 login journey](../docs/cycles/C039-provider-authentication.md) covers cancellation, explicit retry, expired-session help and newer-draft protection. Controlled adapter/repository checks cover captured owners and restart metadata; these do not manufacture real account expiry. Its source-bound [login gallery](../docs/visual/provider-login/README.md) remains historical evidence; [NEXT-AGENT](../docs/NEXT-AGENT.md) identifies current work.

C075 adds captured writer generations and durable admission before migration preparation. The internal gate refuses stale note writers and retains unresolved operations. [Proof and remaining activation limits](../docs/visual/writer-fence/README.md).

Native editor evidence observes agreement between browser focus/selection and the Paper model before chaining setup keys. C079 retains the main-run failure where initial setup entered the heading; the observer never moves the caret, retries input or repairs document content. [Current validation and limits](../docs/cycles/C079-editor-entry.md).

C097 capture repair: the status recording starts from the actual Tables row header, verifies Tab reaches its Score cell, and checks other table content remains intact. [Rejected recording and repair requirement](../docs/cycles/evidence/C097/review-file-alias-rejected.json) retain the earlier wrong-cell edit; capture assertions supplement image review.
C097 import-preservation validation extends the disposable native import journey with identity-bearing drafts/messages, real guarded Undo and deleted-note recovery; the two-installation UI journey checks literal source-profile text. Current results and limitations are in the [repair receipt](../docs/cycles/evidence/C097/import-content-repair.md).

C097 profile-recovery navigation addresses Enter to the palette input while document search is pending, preserving the delayed-search regression. Focus loss no longer sends Enter to the document body; failures retain palette/focus state and a screenshot. [Failure and repair review](../docs/cycles/evidence/C097/catalog-control-review.md).

C097 captured assistant connections now refuse after profile selection, including after returning to the original profile. Ordinary CLI access and Full YOLO gating retain native regression coverage. [Ownership repair evidence](../docs/cycles/evidence/C097/assistant-owner-review.md); full integration remains in C097.
