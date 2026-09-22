# One dependable place for notes and agents

Active direction, set 2026-09-21. This replaces the editor-feature backlog as the primary delivery plan. The [earlier plan](archive/2026-09-21-plan.md) is history; its implementation and regression evidence carry forward.

## The next complete journey

**Create a local profile → write and edit with an agent → restart without losing work → move the profile to another machine and continue.**

Local-only use stands on its own. Cloud connection is optional. People organize Pages; cloud discovery stays in Cloud archive. Agents visibly edit the same documents people edit, with revision checks, human takeover and guarded Undo.

This journey is not complete today. The Paper editor and Windows source runtime work; profile ownership, migration and portability are next. Do not express progress as closed-issue percentages: integration and failure handling are the remaining work.

## Delivery sequence

The machine-readable queue is [plan.json](plan.json). `npm run plan` prints the next unblocked stage and separately reports release gates. Local evidence determines completion; closing an old GitHub issue cannot automatically complete a stage.

| Stage | Deliverable | Depends on | Exit evidence |
|---|---|---|---|
| P1 | Profile ownership and isolation | Existing local runtime | Two local profiles with the same document slug share no documents, media, credentials, chats, drafts, favorites, caches or agent results. Restart restores the selected profile. Runs retain their captured profile and folder. |
| P2 | Every note on Paper | P1 | Backup and resumable migration preserve identities, links, content, media and human organization. Interrupted or repeated migration creates no duplicates. Retire the separate editor only after fixture comparison and restart proof. |
| P3 | Recovery and portable profiles | P2 | Crash and uncertain-save recovery preserve human work. Export/import includes owned data, handles machine-bound credentials explicitly, and restores links in another user-data root. Demonstrate the whole journey above with media and side chats. |
| P4 | Optional two-way cloud sync | P3 | Two devices converge after offline edits and repeated delivery; distinguish deletion from missing access; surface overlap; never silently reorganize Pages. Local-only profiles make no sync requests. |
| P5 | Ordinary installation and daily-use pilot | P3; P4 for cloud pilot | Install/update on a clean Windows machine without a checkout or toolchain. Start, quit, recover and uninstall without losing user data. Validate keyboard access, long notes and diagnostics. |

Packaging research may proceed alongside earlier stages. The local-only pilot does not depend on P4. Other platforms follow the Windows pilot, not assumed compatibility.

## Start P1 with a bounded slice

1. Inventory persisted and cached objects in `app/main/store.js`, `documents.js`, `conversations.js`, `canvas-bundle.js`, `local-barkpark*.js`, and renderer `state.js`. Record current keys and migration rules before changing them.
2. Define stable profile IDs and qualify document, tab and run identities with their owner. A mutable server URL or bare slug is not an identity. Audit actual Barkpark tenancy/export APIs; [architecture](ARCHITECTURE.md) is a target, not an upstream contract.
3. Add a versioned registry and adopt the existing workspace into a default profile with an intact backup. Appearance stays app-wide; working folders stay per chat.
4. Prove two isolated local profiles with colliding slugs, a background run, a pending draft, a side chat and restart. Then add the switching UI.

No sync engine, wholesale runtime rewrite or deletion of the old store before migration proof.

## Carry forward

- [Accepted interaction decisions](DESIGN-DECISIONS.md), especially favorites (D19a), sidebar/organization and direct editing (D26–D28), history (D29) and full side chats (D30).
- Real Paper, PortableDoc, acknowledged revisions, conflict handling, direct assistant edits and guarded Undo.
- Per-chat folders/drafts, attachments, parent references and correctly owned activity.
- The opt-in [local runtime](LOCAL-BARKPARK.md): a built Windows checkout is still required.
- The [editor regression matrix](EDITOR-PARITY.md), live suites, upstream licenses and provenance.

## Unfinished integration gates

| Gate | Current evidence | How it clears |
|---|---|---|
| G1: upstream editor integration | [Barkpark PR #19579](https://github.com/FRIKKern/barkpark/pull/19579) was open at this reset. | Required checks and merge verified; pin and retest the consumed baseline. |
| G2: cross-repository regression enforcement | [Issue #4](https://github.com/FRIKKern/barkdown/issues/4) needs the private-repo read token and deliberate broken-Tab proof. | Both repositories run the matrix; an intentional regression blocks the upstream PR. Never commit a credential. |

G1/G2 gate the integrated pilot, not isolated P1 implementation. Recheck external state before acting. The editor matrix still records limited server-side undo proof; carry that verification into P2/P3 rather than declaring all rows complete.

## Existing issue mapping

- [#6](https://github.com/FRIKKern/barkdown/issues/6): P1 and portability within P3.
- [#13](https://github.com/FRIKKern/barkdown/issues/13): P2 migration and retirement of the separate editor.
- [#7](https://github.com/FRIKKern/barkdown/issues/7): P4 sync.
- [#4](https://github.com/FRIKKern/barkdown/issues/4): G2, a gate rather than the next coding task.

P3 recovery and P5 installation have local backlog entries; separate GitHub issues are not yet created. Keep issue history and evidence. Completed editor tickets stay closed; this reset does not discard their code or reopen their features.

## Done means demonstrated

Use [ACCEPTANCE.md](ACCEPTANCE.md) for scenario gates and [VALIDATION.md](VALIDATION.md) for evidence. Record the source commit, exact command, result and limitations. Update `plan.json`, this plan and the handoff together. A stage becomes done only with linked evidence; blocked gates stay visible while other useful work proceeds.

## Delivery cadence

Deliver stages through [bounded cycles](CYCLES.md). C001 completed the ownership design; [C004](cycles/C004-captured-run-ownership.md) adds captured provider ownership and finalization. C003 registry and C007 runtime leases are integrated. C006 adds trusted ownership, persisted conversations and switching UI; C010 adds explicit same-machine legacy adoption and recovery. Combined A1 acceptance remains pending. [The current cycle](cycle.json) and `npm run plan` retain exact status. C002 merged through PR #29 at `b8e7bfb`; no deployment. These bounded slices do not complete P1.
