# Barkdown desktop

The experimental [goal coordinator](../docs/goals/HANDOFF.md) runs in opt-in Windows `--profiles` mode; legacy activation remains disabled. [C015 source 61eea4d](../docs/goals/evidence/61eea4d/README.md) passes authenticated Codex planning/three workers/evidence reviews/summary, actual Electron planning-crash recovery, full desktop/root and inspected fixture/live gates. [C020 test source 17c2cc8](../docs/goals/evidence/17c2cc8/README.md) adds verified stop races and native interrupted review/summary recovery with fresh desktop/root and visual evidence. [C023 source 3e9c0a9](../docs/cycles/C023-windows-atomic-write.md) passes 44 focused and 68 goal/native checks; its original final desktop/visual/live/root gates passed with [retained logs](../docs/goals/evidence/3e9c0a9/README.md), while combined gates remain pending. [Goal visual health](../docs/visual/goals/README.md) separates fixture, actual Electron and authenticated evidence. Workers share a captured folder: assignments must be disjoint or dependency-ordered, with no automatic worktrees. Model reviews are not human verification; uncertain effects require a person. These checks do not establish broad goal completion, power-loss durability or cross-machine portability.

[Earlier authenticated worker concurrency](../docs/goals/evidence/beefded/authenticated-codex.json), [crash-dialog recovery](../docs/goals/evidence/e9be019/README.md) and [C013 saved-credential crash proof](../docs/goals/evidence/f7d91e6/README.md) remain separate evidence. The coordinator shares a three-turn admission cap and disables native delegation.

The working Electron application: notes and conversations on the left, agents and their work alongside them. [Product overview](../README.md) · [Active roadmap](../docs/PLAN.md) · [Contributing](../CONTRIBUTING.md)

Code-area health: [Main process](main/README.md) · [Renderer](renderer/src/README.md) · [Work tabs](renderer/src/tabs/README.md).

## Run and verify

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
| Notes | Real Barkpark Paper canvas, PortableDoc ops, acknowledged save, revision conflicts, server echo and guarded assistant Undo. Legacy local documents still use a separate Tiptap store until migration. |
| Conversations | Shared main/side composer, provider/model/effort controls, images, 100-message recall, independent drafts and saved parent links. |
| Workspaces | Per-chat working folders and tabs for notes, project files, websites, terminal, reviews and side chats. Favorites reopen individual destinations. |
| Pages | Human-controlled nesting and order. Cloud discovery stays in Cloud archive; opening a paper does not place it. |
| Agent work | Document read/search/create/direct-edit tools, visible activity, revision checks and Undo. File/command permissions retain their provider-specific boundaries. |
| Local runtime | Opt-in Windows source launcher with private PostgreSQL, health checks, bounded recovery and shutdown. Requires a built Barkpark checkout; not a bundled installation. |

## Providers

| Provider | Connection | Execution boundary |
|---|---|---|
| Claude Code | Existing local login, Claude Agent SDK | Per-chat sessions and folder; approval handling for file edits/commands |
| Codex | Existing local login, Codex SDK | Per-chat sessions; sandboxed to the captured folder, read-only without a folder |
| Claude API | Key in Settings or environment | Barkdown's streaming tool loop and tool approval handling |

No-folder conversations remain valid. A folder selected in the composer never scopes the global sidebar. Side chats inherit settings once and may change them independently.

## Source map

| Directory/module | Owns |
|---|---|
| `main/main.js`, `preload.js` | Native window, settings and IPC boundary |
| `main/store.js`, `documents.js`, `conversations.js` | Existing persistence; P1’s ownership inventory starts here |
| `main/local-barkpark*` | Private runtime lifecycle and Windows source bootstrap |
| `main/barkpark.js`, `canvas-bundle.js`, `agent-edits.js` | Barkpark adapter, editor delivery and edit receipts |
| `main/providers/`, `agent.js`, `mcp-server.js` | Provider orchestration and document tools |
| `renderer/src/state.js`, `index.js`, `composer.js`, `tabs/` | Workspace state, shared composer and tab hosts |
| `shared/` | PortableDoc/Markdown and operation helpers |
| `tests/` | Unit, Electron and live adapter/editor checks |

The canvas loads from the connected Barkpark, with cached and vendored fallback. The consumed fallback baseline is Barkpark commit `54579debe6ad4579c1a48586805498602867d983` through E011; upstream PR #19579 was still open at the roadmap reset. [The parity matrix](../docs/EDITOR-PARITY.md) carries the exact proof and limitations. Preserve vendored licenses. Selection remains connected server, then verified profile-owned cache, then vendored fallback. Updating the fallback or parity pin does not upgrade an older reachable server or valid old cache; a renderer restart is needed to change its loaded custom element. [The historical consumption audit](../docs/EDITOR-CONSUMPTION-AUDIT.md) preceded E011; [original consumption evidence](../docs/visual/fallback-consumption/IMPORT.md) now proves bounded fallback compatibility against private a544 and54579 servers.

## Remaining work

P1–P5 deliver profile isolation, migration to one editor, interruption recovery and portability, optional sync, and clean-machine installation. Unsaved project buffers are still session memory. The Windows runtime is a source-checkout integration; forced-desktop termination, packaged installation and other platforms need further proof. Existing passing tests do not establish multi-profile or sync behavior.

Use [the local-runtime guide](../docs/LOCAL-BARKPARK.md) for setup and [the acceptance scenarios](../docs/ACCEPTANCE.md) to decide when a stage is complete. The prototype uses direct provider adapters; no T3 runtime import is claimed.

## Visual health by area

- [Workspace navigation](../docs/visual/workspace/README.md): renderer shell, sidebar, tabs and quick open.
- [Main chat](../docs/visual/chat/README.md) and [side chat](../docs/visual/side-chat/README.md): shared composer and conversation controls.
- [Local documents](../docs/visual/documents/README.md): the legacy editor retained pending P2; live Paper evidence remains in the root gallery.
- [Settings](../docs/visual/settings/README.md): preferences and connection controls.
- [Goals](../docs/visual/goals/README.md): injected-service component fixtures, distinct from live execution proof.

Each page contains a still, recorded interaction GIF, provenance and changelog. [Rules and coverage limits](../docs/visual/RULES.md) distinguish visual review from functional/runtime proof.

- [Terminal ownership](../docs/visual/terminal-ownership/README.md): C018 native process proof passed; combined actual UI/evidence closeout pending.

- [Project-buffer preservation](../docs/visual/project-buffers/README.md): actual CodeMirror refusal preserves unsaved text until explicit Save.

- [Editor cache integrity](../docs/visual/cache-integrity/README.md): C025 corruption refusal, owned repair and profile-isolated fallback reviewed at b93f832; combined source validation remains separate.

C026: shared composers preserve draft text and images until start acknowledgement, guard duplicate sends and newer typing, and expose keyboard/touch attachment removal. Human errors retain exact collapsed diagnostics. [Actual managed and legacy evidence](../docs/visual/send-preservation/README.md) covers rejection, restart and explicit retry; unknown dispatch outcomes are never labelled not started.

E009 clipboard fixture and original evidence are imported. The original scoped behavior was proven on connected upstream3495 while the vendor was a544. Use `test:rich-clipboard:isolated` with the explicitly built3495 source. [Evidence](../docs/visual/rich-clipboard/README.md); E011 subsequently consumed54579 with separate original native fallback proof.

## Imported milestone health — 22 September 2026

Candidate `d20aa09` is awaiting fresh combined gates. Global fixture approval/status still describe the earlier fallback; no new combined approval or P1 completion is implied.

- C016: [actual two-profile restart manifest](../docs/visual/profiles/isolation-runs/2026-09-22T04-04-36-864Z/manifest.json), source `34ef068` with a544; original reading position, draft, media and A-only Undo proof.
- C026: [managed gallery](../docs/visual/send-preservation/runs/1e138aa-managed/manifest.json) and [legacy gallery](../docs/visual/send-preservation/runs/1e138aa-legacy/manifest.json), final `1e138aa`; full44651 remains attributed to pre-CSS80ba196, with final keyboard removal covered by actual targeted proof.
- E009: [native clipboard gallery](../docs/visual/rich-clipboard/runs/2026-09-22T04-50-27-798Z/manifest.json), Barkdown `25cb114` / connected upstream3495. This historical proof did not update the then-vendored a544 fallback; E011 subsequently did.
- C028: [runner failure enforcement](../docs/cycles/C028-parity-exit.md); 24 controlled runner cases pass, while historical root freshness remains separate.
- [Third-party notices](../THIRD-PARTY.md): 49-package metadata/license/provenance audit and E011 exact54579 editor assets/pin are imported.

- E011: [original fallback import](../docs/visual/fallback-consumption/IMPORT.md), 755 blobs and 53 review hashes verified; original native old/new-server, full/visual/live/root gates passed, combined gates pending.
- C032: [native refusal and restart motion](../docs/visual/folder-preflight/README.md), original8b51fbc, six stills/four videos/two GIFs; no provider dispatch.
- C033: [context reservation](../docs/cycles/C033-context-reservation.md), 15 controlled races; no native race claim.
