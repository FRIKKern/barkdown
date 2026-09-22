# Continue the dependable-workspace plan

Read [PLAN.md](PLAN.md), [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md), then the current stage in [ACCEPTANCE.md](ACCEPTANCE.md). Run `npm run plan`. **Next: P1, profile ownership and isolation.** The former lowest-open-editor-issue rule is retired.

## What exists

`app/` is a working Electron prototype using Claude Code, Codex and an API fallback. Main and side chats share controls, images, history and transcript actions; side chats are saved conversations with parent links and independent settings. Working folders belong to chats. Tabs, drafts, navigation and favorites persist.

Barkpark papers use the real Paper canvas and revision-checked operations. Direct agent edits save without Keep, reveal their intent visually and offer guarded Undo; human input ends the presentation immediately. Local legacy documents still use a separate Tiptap tab/store. Do not remove either before P2 proves migration.

A [managed Windows source runtime](LOCAL-BARKPARK.md) owns private PostgreSQL and Barkpark processes, health/recovery and normal shutdown. The [opt-in profile workspace](PROFILE-WORKSPACES.md) now binds separate UUID stores and runtime leases, saved worker conversations, website storage and Settings switching. It requires a built checkout. Explicit verified legacy adoption and offline rollback now have actual runtime proof; ordinary installation and sync remain pending.

## First implementation slice

The ownership inventory, captured runs, registry, runtime pool and explicit profile mode are implemented. Review C010 explicit adoption/cutover evidence alongside missing-workspace preservation and first-run credential durability work, then complete the combined P1/A1 acceptance gate. Use existing issue #6 for continuity. The cycle handoff records exact proof; do not infer default migration readiness from opt-in switching.

Do not change the user's actual library to demonstrate isolation. Use temporary user-data roots and private test clusters. Do not stop the shared development server, switch the CLI's server, change another checkout's branch, or migrate real notes as an incidental setup step.

## Product rules to retain

- The app is not a working folder. Documents and chats are available across the selected profile; each chat independently owns its agent folder. Profile selection is library/account ownership, never a filesystem project selector.
- Pages stay human-organized; discoveries stay in Cloud archive until placed. Preserve the existing loose-root migration backup and nested groups.
- Sidebar resizing and hover stability, 60% chat default, browser-like work tabs, quiet direct-document navigation, hidden scrollbar tracks and keyboard reachability remain.
- Favorites bookmark individual destinations; old workspace-snapshot pins are superseded. Capture profile ownership in future favorites.
- Preserve side-chat parent references, independent controls and drafts, and per-chat Up/Down recall with original-draft restoration.
- Saved means acknowledged. Do not animate fabricated saves, replay uncertain writes blindly, or replace a human draft during recovery.

## Where to work

| Source | Responsibility |
|---|---|
| `app/main/store.js`, `documents.js`, `conversations.js` | Existing persistence and content/chat ownership |
| `app/main/local-barkpark*.js`, bootstrap `.exs`/`.ps1` | Owned runtime and source launcher |
| `app/main/barkpark.js`, `canvas-bundle.js`, `agent-edits.js` | Authoritative adapter, editor loading, edit receipts |
| `app/renderer/src/state.js`, `index.js`, `composer.js`, `tabs/` | Workspace ownership, shared chat UI and real editor hosts |
| `app/tests/` | Desktop, runtime, agent and editor regression evidence |
| `docs/contracts/workspace.ts` | Historical proposal; audit before reuse, not a runtime schema |

Barkpark owns PortableDoc/schema/reader/editor contracts. Make changes there only when the current slice requires them, in an isolated authorized checkout with its own instructions and gates. The current application implementation is authoritative for what exists; the concepts and original PRD remain historical design references.

## Baseline and remaining gates

Barkdown runtime implementation: `930fc2f`, screenshot evidence `5c91d29`, on `codex/electron-prototype`. The working tree was clean before this roadmap reset. [VALIDATION.md](VALIDATION.md) separates passing tests from unproved claims.

The carried upstream editor branch is validated at `a5440345c`; PR #19579 was still open at the reset. Cross-repository CI issue #4 still needs a read token and deliberate failure proof. Recheck both before landing/releasing; neither forces P1 to wait. The local CLI was left on `local` at `http://localhost:4000`; managed runtimes use separate ports. Do not assume either service is running.

## Finish a slice

Install locked dependencies and Playwright Chromium when needed; run root `npm run verify`, appropriate app tests and the stage's real integration cases. UI/runtime changes require the existing screenshot freshness workflow: commit app changes, run `cd app; npm run shots`, then commit evidence. Report failures and scope limits exactly. Commit and push to a `codex/` branch; update plan status only with evidence. No production deployment or public hosting is authorized.

[Archived handoff](archive/2026-09-21-next-agent.md) preserves earlier investigations and commands. Consult it for evidence, not as a competing task queue.

## Current cycle checkpoint

Start with `npm run cycle` and [cycle.json](cycle.json). C002 merged through PR #29 at `b8e7bfb`. C001 completed the [ownership design](PROFILE-OWNERSHIP.md); C004 implements [captured runs](RUN-OWNERSHIP.md). This branch includes C003 registry, C007 runtime-pool source and E001 Paper guards. [C006](cycles/C006-profile-workspace-service.md) adds trusted IPC, durable transcripts, opt-in profile switching and the three-worker goal integration. Next: default adoption/cutover and combined A1 proof; P1 remains pending. C009 cold-runtime adoption is separate until its source and evidence are deliberately integrated.

## Visual handoff

The [visual health pages](visual/README.md) hold reviewed stills, GIFs and comparison reports. Follow [visual rules](visual/RULES.md) for app/dependency/harness changes: capture, compare, inspect, explicitly approve, and preserve old evidence. The main baseline is merge b8e7bfb from PR #29; C002 is merged and P1 remains pending. C006 adds profile controls and goal fixture tours plus separately recorded real Paper switch protection. Dedicated files/recovery motion coverage remains incomplete. Do not treat fixture screenshots as live integration proof.
