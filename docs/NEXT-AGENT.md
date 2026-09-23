# Continue the dependable-workspace plan

## Current checkpoint — 23 September

[PR #30](https://github.com/FRIKKern/barkdown/pull/30) is merged into main as `3903288`. C040 is complete: all 20 Linux parity groups, both repository checks and Windows visual CI pass at `5325300`, with explicitly reviewed evidence. No deployment. Continue [C039 provider authentication](cycles/C039-provider-authentication.md) on `codex/finish-profile-isolation`. The user chose shared computer authentication by default, without a per-profile prompt. Verify ordinary and goal dispatch against this boundary; profile-owned keys and workspace data remain isolated. P1 remains active; do not restart finished editor polish or treat the merge as full-stage completion. The selected policy and remaining evidence map are in C039.

Prepared next work: [four task briefs](tasks/2026-09-23-next-four.md). Start with login assistance and cross-path authentication proof; P1 closeout depends on both. Migration preparation may proceed, but cutover waits for P1. Tasks are prepared, not running.

## Earlier checkpoints (superseded; retained evidence)

### Previous C038 checkpoint

C038 is complete: [callout refinement](cycles/C038-callout-polish.md) on `codex/paper-polish`. C037 is archived; its completed source/evidence was pushed through `6bd8fcf`. C038 source is `ae8024f`; 31 host checks, four real-server callout checks and root verification passed, with reviewed light/dark/narrow gallery and current live/deterministic evidence. Source and evidence were pushed through `1621d45`; keep main unchanged.

### Previous C037 checkpoint

The user requested Paper visual refinement after C008. The current cycle is [C037](cycles/C037-paper-polish.md) on `codex/paper-polish`, based on the preserved integration branch. Its skin changes, reviewed live light/dark captures and real save/recovery checks are recorded there. C008 is archived as completed in `cycles/C008-completed.json`; no main merge or deployment occurred.

Integration evidence is committed through `42432cb` on `codex/integration-12h`. Full desktop passed at `1b01bf2`; subsequent changes affect capture tooling only and pass 18 focused lifecycle/history checks. Final root verification passed. Final deterministic and live Paper/Codex captures both identify source `3e8a2aa`; their named reviews cover 40 fixture stills/40 motion frames and five live stills/all 37 GIF frames. E012 now consumes clean upstream `bf23f773` and the C030 strict native matrix passed 13/13. See [C008](cycles/C008-integration.md) for exact source boundaries and retained failures.

The next action is to push outstanding local commits and confirm the remote branch. GitHub HTTPS repeatedly timed out; inspect current Git state before assuming publication. Keep main unchanged. P1 remains incomplete because shared device authentication policy is unresolved; portability, clean-machine installation and external release gates are still separate requirements. Existing evidence applies to this documentation-only reconciliation without recapture.

## Historical 22 September checkpoint (superseded by the checkpoint above)

**Current imported candidate (22 September):** `d20aa09` on `codex/integration-12h` includes E011 production consumption `22ef23b`, C033 context reservation `f19a6ef`, C032 preflight `4c1709a` and native fixture `b585640`, plus their imported original evidence. Earlier C016/C026/C028 and C021/C023/C024/C025/C027 imports remain. Global fixture approval and status images are stale for this candidate; fresh combined gates are pending. See [C008](cycles/C008-integration.md) and [A1](cycles/A1-current-evidence.md).

**Last fully validated combined fallback:** `d8acb82`. Full desktop64608 passed at app source b083c60; visual-tooling source e380385 has 40 reviewed fixture frames/GIFs, actual Codex/Paper status5397, and root verify86276 passed. Original lane proofs retain their source commits. No main merge or deployment; P1 remains incomplete.

**Current next work:** freeze the reviewed combined source and execute the [validation order](cycles/C008-integration.md#remaining-combined-validation-order). E011 now consumes exact upstream `54579debe6ad4579c1a48586805498602867d983`; its original fallback proof covers private old-a544 and new-54579 servers. [Import verification](visual/fallback-consumption/IMPORT.md) retains 755 original blobs and verifies all 53 review hashes. Connected server and verified profile cache still precede the vendor. C023 original desktop/visual/live/root gates passed; [original evidence](goals/evidence/3e9c0a9/README.md) is imported. [C032 native refusals](visual/folder-preflight/README.md) preserve main/side drafts and selected-B references across restart, with no provider dispatch. These lane passes do not validate the combined source. The coordinator's [run handoff](https://github.com/FRIKKern/barkdown/blob/codex/run-coordination-12h/docs/cycles/RUN-2026-09-22.md) owns serialized grants.

Electron 38 remains consumed. Coordinator-reported 43/44 real-app webview crashes block both upgrades; minimal 38/43 shells passing and the 43 disable-GPU failure establish no cause or fix. C035 packaging source `89a0fd2` is imported as `d20aa09` with unchanged Electron38 locks; original packaged terminal evidence passes. E012 upstream `f7fb` fixes and full checks are not consumed or proven by native combined acceptance. C034 source is imported through `28f5d00`; original authenticated Codex run at `7e07099` passes revision-checked local-document editing and owned shutdown. Claude and remote Paper are not covered. Original C034/C035 proof remains source-bound; it is not a fresh combined pass.

The goal coordinator already has source-specific C015 authenticated planning/three workers/reviews/summary and C020 native interruption evidence. Broader acceptance still requires combined validation and does not treat model review as human verification. Device CLI login and environment API keys remain a separate authentication-policy boundary from encrypted per-profile settings.

C018 imported media hashes match the original review except video-map.json, whose committed LF form differs from its originally hashed CRLF bytes; [review addendum](visual/terminal-ownership/db9b2ca/review-addendum.json) proves exact reversible normalization and preserves the original review. No media mismatch was found. Do not silently rehash historical evidence.

Prior `9c77cb7` remains an earlier validated fallback, not the current candidate. P1/A1 still needs a fresh combined native reading-position journey, remaining missing-reference and filesystem-race coverage beyond C032 and an explicit device authentication policy. C026 original attachment-rejection proof is now imported. Original C022 repeated adoption and C021 rollback proofs are now retained; portability and full editor/upstream release remain unproven.

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

The [visual health pages](visual/README.md) hold reviewed stills, GIFs, original recordings and comparison reports. Follow [visual rules](visual/RULES.md): freeze source, capture, compare, inspect, explicitly approve, and preserve attribution. Dedicated rich-edit, structured-table, adoption and recovery evidence now exists; fixture screenshots remain distinct from actual runtime/provider proof. `d8acb82` is the last fully verified combined checkpoint; newer imports intentionally invalidate combined freshness until recaptured.


C024 source268d5df and original evidence6654f34 are selectively imported: unavailable-file navigation clears write authority while retaining prior drafts; saves acknowledge captured file/text, newer typing remains dirty, and removed files require explicit recreation. Exact original dedicated captures, deterministic review and11-manifest chain verified; original live status is archived at docs/images/status/history/C024-268d5df.json. Post-import headless file-authority and global/root buffer checks plus app build pass. Current global status/approval remains unchanged and stale for the combined candidate; fresh full/visual/live/root gates are still required. C027 append-only review tooling remains intact. No native UI/runtime launched during import.


C016 original26d9461 evidence is now selectively imported alongside combined16a3b60 Paper position/queued-refresh union. Actual34ef068/a54464864 preserves B exactscroll360/anchor112.453125 through late A work and process restart; full51548,37-still/GIF deterministic, live48539 and root76307 pass in the original lane. All historical failures and unapproved intermediate captures remain;16-manifest chain and review/media hashes verified. Current combined globals remain unchanged; fresh combined gates and broader P1 criteria still apply.
