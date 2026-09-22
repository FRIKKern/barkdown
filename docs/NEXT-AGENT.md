# Continue the dependable-workspace plan

**Combined candidate:** follow [C008 integration](cycles/C008-integration.md) on `codex/integration-12h`. Current source includes C014 ordinary managed-chat recovery, E004 structured table editing, C015 native goal coordination and C017 API Paper parity. Full desktop91207 passed at `fb31be3`; the final recovery race correction and E004 import passed focused recovery, table and MCP tests. Their original reviewed evidence is retained under [chat recovery](visual/chat-recovery/README.md) and [structured tables](visual/structured-table/README.md). The current combined source still needs a fresh full suite and combined visual/live evidence.

**Verified fallback:** `9c77cb7` (app source `82cc622`) passed the full desktop suite, root verification, reviewed37-frame fixtures, actual rich Paper checks and a live Codex status capture. Do not transfer that approval to later source. P1 is not complete; do not migrate real user data.

Active parallel work: C015 natural-language goal planning/review; C016 UI isolation across two real runtimes; C017 API-provider Paper parity; C018 terminal ownership; E006 Markdown paste fidelity. C014/E004 bounded cycles are closed. Imported API parity fixes activity routing and first-host-load refresh; focused API/provider/host tests pass, while its final real Undo/reload proof is pending after a fixture array-comparison correction. C015 explicit final-message provenance passes focused checks and authenticated Codex in its original lane; full combined and final visual gates remain open. A failed final journal replacement retained the previous authoritative state, and a copied-fixture recovery completed without provider replay; the original OS error remains unknown. The two-profile journey retains an unresolved historical in-process cancellation hang; no speculative lifecycle fix is claimed.

Read [PLAN.md](PLAN.md), [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md), then the current stage in [ACCEPTANCE.md](ACCEPTANCE.md). Run `npm run plan`. **Next: P1, profile ownership and isolation.** The former lowest-open-editor-issue rule is retired.

## What exists

`app/` is a working Electron prototype using Claude Code, Codex and an API fallback. Main and side chats share controls, images, history and transcript actions; side chats are saved conversations with parent links and independent settings. Working folders belong to chats. Tabs, drafts, navigation and favorites persist.

Barkpark papers use the real Paper canvas and revision-checked operations. Direct agent edits save without Keep, reveal their intent visually and offer guarded Undo; human input ends the presentation immediately. Local legacy documents still use a separate Tiptap tab/store. Do not remove either before P2 proves migration.

A [managed Windows source runtime](LOCAL-BARKPARK.md) owns private PostgreSQL and Barkpark processes, health/recovery and normal shutdown. It is opt-in and requires a built checkout. The combined candidate has isolated profile runtimes, captured background ownership and explicit same-machine adoption. It still requires a built source checkout; packaged runtime, cross-machine portability, automatic migration and sync remain unproven.

## Original P1 scope and remaining proof

Inventory existing persistence and write down profile ownership for documents, chats, tabs, drafts, favorites, media, credentials, caches, receipts and running tasks. Define stable profile-qualified identities and an idempotent adoption of today's workspace into a default profile, with backup. Prove two profiles with the same paper slug cannot affect each other before wiring the switching UI. Use existing issue #6 for continuity; the active scope and acceptance live in P1/A1.

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

Start with `npm run cycle` and [cycle.json](cycle.json). C008 coordinates reviewed source imports; its history records original commits and later combined checks. Registry/resolver, captured runs, explicit adoption, saved Windows credentials, goal process containment and ordinary-chat recovery are integrated. C014 and E004 handoffs state their exact evidence and limitations. Continue the real P1/A1 proof and pending provider/editor milestones; stage completion requires the original acceptance scenario, not the number of closed cycles. C002 is already merged through PR #29 at `b8e7bfb`; main has not received this integration candidate.

## Visual handoff

The [visual health pages](visual/README.md) hold reviewed stills, GIFs, original recordings and comparison reports. Follow [visual rules](visual/RULES.md): freeze source, capture, compare, inspect, explicitly approve, and preserve attribution. Dedicated rich-edit, structured-table, adoption and recovery evidence now exists; fixture screenshots remain distinct from actual runtime/provider proof. `9c77cb7` is the last fully verified combined checkpoint; newer imports intentionally invalidate combined freshness until recaptured.

## C021 native rollback lane

`codex/rollback-native-preflight-12h` adds read-only native ownership verification across every profile before rollback changes authority state. Actual refusal/retry and native crash proof pass. [Handoff](cycles/C021-rollback-native-preflight.md), [evidence](visual/adoption/native-rollback-f3e92a1/README.md). Root verification passed (32220); bounded evidence closeout ready for coordinator import; keep C008 integration queue authoritative and P1 open. Unknown ownership is preserved, never guessed stopped.
