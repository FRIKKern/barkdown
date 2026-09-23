# One dependable place for notes and agents

Active direction, set 2026-09-21. This replaces the editor-feature backlog as the primary delivery plan. The [earlier plan](archive/2026-09-21-plan.md) is history; its implementation and regression evidence carry forward.

## The next complete journey

**Create a local profile → write and edit with an agent → restart without losing work → move the profile to another machine and continue.**

Local-only use stands on its own. Cloud connection is optional. People organize Pages; cloud discovery stays in Cloud archive. Agents visibly edit the same documents people edit, with revision checks, human takeover and guarded Undo.

This journey is not complete today. The Paper editor and Windows source runtime work; P1 profile isolation is accepted at source27ea120, while migration and portability remain pending. Do not express progress as closed-issue percentages: integration and failure handling are the remaining work.

## Delivery sequence

The machine-readable queue is [plan.json](plan.json). `npm run plan` prints the next unblocked stage and separately reports release gates. Local evidence determines completion; closing an old GitHub issue cannot automatically complete a stage.

| Stage | Deliverable | Depends on | Exit evidence |
|---|---|---|---|
| P1 | Profile ownership and isolation | Existing local runtime | Two local profiles with the same document slug share no documents, media, profile-owned credentials, chats, drafts, favorites, caches or agent results. Restart restores the selected profile. Runs retain their captured profile and folder. |
| P2 | Every note on Paper | P1 | Backup and resumable migration preserve identities, links, content, media and human organization. Interrupted or repeated migration creates no duplicates. Retire the separate editor only after fixture comparison and restart proof. |
| P3 | Recovery and portable profiles | P2 | Crash and uncertain-save recovery preserve human work. Export/import includes owned data, handles machine-bound credentials explicitly, and restores links in another user-data root. Demonstrate the whole journey above with media and side chats. |
| P4 | Optional two-way cloud sync | P3 | Two devices converge after offline edits and repeated delivery; distinguish deletion from missing access; surface overlap; never silently reorganize Pages. Local-only profiles make no sync requests. |
| P5 | Ordinary installation and daily-use pilot | P3; P4 for cloud pilot | Install/update on a clean Windows machine without a checkout or toolchain. Start, quit, recover and uninstall without losing user data. Validate keyboard access, long notes and diagnostics. |

Packaging research may proceed alongside earlier stages. The local-only pilot does not depend on P4. Other platforms follow the Windows pilot, not assumed compatibility.

## Current next stage

P1 is accepted at the [C039 audit](cycles/C039-completion-audit.md) and merged through PR #31. P2 is active: [C043](cycles/C043-migration-preflight.md) provides offline inventory/preflight/backup; [C044](cycles/C044-paper-create-contract.md) proves an insert-only upstream creation route and lost-response readback on disposable data. [C045](cycles/C045-migration-staging.md) adds durable intent and conservative staging/readback recovery. The [migration contract](migration/README.md) still requires real editor roundtrip, reference and navigation proof. Preserve the legacy store; the new upstream route is unmerged.

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

The [22 September read-only gate audit](cycles/evidence/release-gates-2026-09-22.json) recorded PR #19579 open/blocked at a5440345c. Its green parity job skipped checkout, build and the actual rows because the read token is absent. It does not establish matrix enforcement. No secret configuration or upstream workflow was changed.

G1/G2 gate the integrated pilot, not isolated P1 implementation. Recheck external state before acting. The editor matrix still records limited server-side undo proof; carry that verification into P2/P3 rather than declaring all rows complete.

## Existing issue mapping

- [#6](https://github.com/FRIKKern/barkdown/issues/6): P1 and portability within P3.
- [#13](https://github.com/FRIKKern/barkdown/issues/13): P2 migration and retirement of the separate editor.
- [#7](https://github.com/FRIKKern/barkdown/issues/7): P4 sync.
- [#4](https://github.com/FRIKKern/barkdown/issues/4): G2, a gate rather than the next coding task.

P3 recovery and P5 installation have local backlog entries; separate GitHub issues are not yet created. Keep issue history and evidence. Completed editor tickets stay closed; this reset does not discard their code or reopen their features.

## Done means demonstrated

Use [ACCEPTANCE.md](ACCEPTANCE.md) for scenario gates and [VALIDATION.md](VALIDATION.md) for evidence. Record the source commit, exact command, result and limitations. Update `plan.json`, this plan and the handoff together. A stage becomes done only with linked evidence; blocked gates stay visible while other useful work proceeds.

## Prepared tasks

[Four completed task briefs](tasks/2026-09-23-next-four.md) define scope, dependencies, ownership, acceptance and evidence for the next work. C039/P1 are accepted; the four task briefs are complete at their stated preparation scope. The real migration rehearsal is P2 work.

## Delivery cadence

Deliver stages through [bounded cycles](CYCLES.md). [The current cycle](cycle.json) is C046 real migrated Paper editing/reopen, following completed C043 preparation, C044 creation-contract proof, C045 durable staging and merged P1 acceptance. Device authentication is shared by default without asking, per the user’s 23 September decision. Original integration, profile and editor evidence remains linked from [NEXT-AGENT.md](NEXT-AGENT.md) and the [P1 audit](cycles/C039-completion-audit.md). Closing a cycle does not complete a stage.

Historical integration checkpoints remain in [C008](cycles/C008-integration.md); they are evidence, not an active queue.
