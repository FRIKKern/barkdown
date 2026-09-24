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

P1 is accepted at the [C039 audit](cycles/C039-completion-audit.md) and merged through PR #31. P2 has verified preparation/staging,21 native content cases, internal links/backlinks, owned PNG recovery, exact retained-backup restore, native persisted defaults, navigation projection and read-only original evidence. [The migration contract](migration/README.md) maps each result and its limits. C054 at aa97781 passes 131 migration checks, full desktop/root and reviewed standard visuals; C053 Linux parity passes 20/20.

C055 audits the remaining cutover contracts. C056 implements complete foreground catalog discovery and honest refresh failure handling, with native200/201 HTTP/CLI proof. Review identified an open-Paper connection-binding risk to address before owned-local Archive classification. Ordinary blank-note lifecycle, a retained-evidence viewer, writer fencing/sealed activation, and rollback/retirement follow. These are prepared slices inside P2, not completed features. Preserve the legacy store; no real library or authority has moved, and the upstream creation route remains unmerged.

## Carry forward

- [Accepted interaction decisions](DESIGN-DECISIONS.md), especially favorites (D19a), sidebar/organization and direct editing (D26–D28), history (D29) and full side chats (D30).
- Real Paper, PortableDoc, acknowledged revisions, conflict handling, direct assistant edits and guarded Undo.
- Per-chat folders/drafts, attachments, parent references and correctly owned activity.
- The opt-in [local runtime](LOCAL-BARKPARK.md): a built Windows checkout is still required.
- The [editor regression matrix](EDITOR-PARITY.md), live suites, upstream licenses and provenance.

## Unfinished integration gates

| Gate | Current evidence | How it clears |
|---|---|---|
| G1: upstream editor integration | [Barkpark PR #19579](https://github.com/FRIKKern/barkpark/pull/19579) is open with merge conflicts in the 24 September audit. | Required checks and merge verified; pin and retest the consumed baseline. |
| G2: cross-repository regression enforcement | [Issue #4](https://github.com/FRIKKern/barkdown/issues/4) needs the private-repo read token and deliberate broken-Tab proof. | Both repositories run the matrix; an intentional regression blocks the upstream PR. Never commit a credential. |

The [22 September read-only gate audit](cycles/evidence/release-gates-2026-09-22.json) recorded PR #19579 open/blocked at a5440345c. Its green parity job skipped checkout, build and the actual rows because the read token is absent. It does not establish matrix enforcement. No secret configuration or upstream workflow was changed.

The [24 September gate audit](cycles/evidence/C054/release-gates.json) supersedes that external-state snapshot: PR #19579 now reports merge conflicts (DIRTY); PR #20020 is open/unstable. The upstream read-token name remains absent. No secret or workflow was changed.

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

The ordered next P2 slices and acceptance are in the [migration contract](migration/README.md#ordered-cutover-work--prepared-not-implemented). The [four completed September23 briefs](tasks/2026-09-23-next-four.md) are historical preparation evidence; they are not the next queue.

## Delivery cadence

Deliver stages through [bounded cycles](CYCLES.md). [The current cycle](cycle.json) is C056 complete Paper discovery after the C055 readiness audit. The ordered next slices live in the [migration contract](migration/README.md); original preparation/editor/profile evidence remains linked there and in the [P1 audit](cycles/C039-completion-audit.md). Device authentication is shared by default without asking. Closing a cycle does not complete a stage.

Historical integration checkpoints remain in [C008](cycles/C008-integration.md); they are evidence, not an active queue.
