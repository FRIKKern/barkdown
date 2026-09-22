# Continue the dependable-workspace plan

**Verified combined checkpoint:** `d8acb82` on `codex/integration-12h`; original C018 evidence subsequently imported as `8549316`. Follow [C008](cycles/C008-integration.md). Full desktop64608 passed at unchanged app source b083c60; visual-tooling source e380385 has40 reviewed fixture frames/GIFs, actual Codex/Paper status5397, and root verify86276 passed. Original lane proofs retain their own commits. No main merge or deployment; P1 is incomplete and real user data must not be migrated.

Included: C014 ordinary managed-chat recovery, E004 structured tables, C015 native goal coordination, C017 API Paper parity, E006 Markdown paste, C018 terminal ownership, C019 unsaved project-buffer guard, and C020 coordinator interruption tests. Native crash proof uses controlled SDK transport; authenticated C015 and live Codex status are separately documented, not provider-wide parity claims.

**Current next work:** C016 two-profile diagnostic found image decode caused the initial30px offset; after image settle A completion preserved exact B scroll and text anchor. Async history footer still needs measured settling before retry; prior failed captures and cancellation hang remain recorded. E007 HTML table paste assertions passed but actual review found clipped fallback guidance, so approval is withheld pending visible-notice fix and recapture. C021 native rollback preflight has Node/native proof but actual Electron evidence remains queued. C020 owns the next serialized full/visual/live window. The coordinator run handoff in the primary checkout governs exact UI grants and the12:11Paris deadline.

C018 imported media hashes match the original review except video-map.json, whose committed LF form differs from its originally hashed CRLF bytes; owner is publishing an explicit normalization addendum, preserving the original review. No media mismatch was found. Do not silently rehash historical evidence.

Prior `9c77cb7` remains an earlier validated fallback, not the current candidate. P1/A1 still lacks complete cold repeated adoption, cache/folder failure and provider-login policy evidence; portability and full editor/upstream release remain unproven.

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
