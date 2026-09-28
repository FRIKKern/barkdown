# One dependable place for notes and agents

Active direction, set 2026-09-21. This replaces the editor-feature backlog as the primary delivery plan. The [earlier plan](archive/2026-09-21-plan.md) is history; its implementation and regression evidence carry forward.

## The next complete journey

**Create a local profile → write and edit with an agent → restart without losing work → move the profile to another machine and continue.**

Local-only use stands on its own. Cloud connection is optional. People organize Pages; cloud discovery stays in Cloud archive. Agents visibly edit the same documents people edit, with revision checks, human takeover and guarded Undo.

This journey is not complete today. The Paper editor and Windows source runtime work; P1 profile isolation is accepted at source27ea120, while migration and portability remain pending. Do not express progress as closed-issue percentages: integration and failure handling are the remaining work.

## Migration effort estimate

**Reviewed 2026-09-28 · provisional working estimate: about 50%; scenario range about 15–80%; low confidence.** Up from about 45% on 2026-09-27 because completed scope grew: the admission doors for note, Paper block, cache-repair and media writers are merged and deployed, and a held instance is proven to refuse them. Confidence rises from very low to low because the known writers now fit the controller without redesign; the unaudited direct writers keep the adverse path wide. Scope: the six “Migrate with a way back” checkpoints, not all P2 or the whole product. Acceptance remains unfinished. This is the first explicit estimate, not evidence that progress increased today.

Basis: estimated engineering-equivalent hours for demonstrated scope and remaining delivery, not measured historical hours, agent runtime, cost or a calendar forecast. Completed weights are retrospective judgments: staging/backup and real-editor preservation each span several substantial boundaries; comparison/navigation and the partial writer boundary are smaller completed slices. The range holds those provisional completed weights constant; revising them can move the range too.

| Existing checkpoint | Difficulty | Completed estimate | Remaining: optimistic / working / adverse | Basis and uncertainty |
|---|---|---:|---:|---|
| Preserve and stage | High | 100 | 5 / 10 / 30 | [Backup and staging evidence](migration/README.md); bounded supported formats. Final integrated recheck remains. |
| Edit migrated notes | High | 100 | 5 / 10 / 30 | [Real editor and original-history evidence](migration/README.md); final integrated preservation checks remain. New format support is outside this estimate. |
| Compare the library | Medium–high | 30 | 5 / 10 / 30 | [Comparison](migration/comparison.md) and [owned navigation](cycles/C080-owned-navigation.md) demonstrated; rerun under the final write boundary. |
| Protect the switch | Very high | 70 | 10 / 60 / 400 | [Doors on note, Paper, cache-repair and media writers, deployed](cycles/C083-writer-admission.md); background-job admission and queue pausing in review. Remaining: the audit of about 125 direct database and blob writers, the trusted hold endpoint, and bypass proof. A redesign is unlikely for known writers; unknown ones set the adverse case. |
| Switch and recover | Very high | 0 | 30 / 100 / 500 | [A2](ACCEPTANCE.md#a2--one-engine-without-lost-notes): authority selection and interruption proof remain. Assumes earlier comparison and fencing can be reused. |
| Prove the way back | Very high | 0 | 30 / 100 / 500 | [A2](ACCEPTANCE.md#a2--one-engine-without-lost-notes): preserve newer edits, rehearse rollback and retire legacy editing. Reconciliation may reveal substantial extra work. |
| **Total** | | **300** | **85 / 290 / 1,490** | Shared prerequisites counted once; remaining estimates include implementation, validation and integration. External waiting excluded. |

Calculation: working `300 / (300 + 290) = 51%`, displayed as **about 50%**. Adverse `300 / (300 + 1,490) = 17%`; optimistic `300 / (300 + 85) = 78%`, displayed as **about 15–80%**. These are scenario judgments, not a measured completion fraction, statistical interval or guaranteed worst case. The wide range is intentional: no reliable historical effort calibration exists yet.

**Next calibration:** finish the direct-writer audit in [C083](cycles/C083-writer-admission.md). Every audited writer that fits an existing door supports the optimistic path; each one that needs its own boundary moves effort from optimistic toward adverse. The estimate moves again when the audit count is known, not when the next slice merges. Update this estimate and the README when new evidence changes the outlook; record the reason in the current cycle. Follow [the progress workflow](CYCLES.md#effort-weighted-progress).

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

P1 is accepted for the Windows source prototype. P2 has demonstrated migration staging/comparison, retained backups and readable originals, ordinary managed-local Paper creation/editing/search, revision-checked agent edits and deletion recovery. The [migration contract](migration/README.md) maps results and limits; [VALIDATION](VALIDATION.md) retains chronological evidence.

C074 adopted merged upstream b70214090 and shipped the read-only original-history viewer. C075 adds captured writer admission and responsive durable streaming, merged through PR38 at c6961328 after full Windows desktop/root, reviewed native/live/standard evidence and hosted real editor/server parity 20/20. [C075 evidence](cycles/evidence/C075/README.md) records failures, measurements and limits.

**C076 profile preparation is merged through PR40:** internal ordinary/goal drains now have native process and journal-settlement evidence. Internal human Paper draft retention now has native IME/IPC/restart proof. Production foreground capture and read-only restart now pass scoped Electron raw-source/chat-draft/IME/crash/B-switch checks. Abort/reopen, the retained-draft reader and native legacy/project/terminal cases now pass development checks. Full desktop/root, reviewed native/standard/live visuals and hosted20/20 parity pass. C078 now verifies a bounded internal read-only comparison; activation-capable sealing, selection, interruption recovery and rollback/retirement remain. No real library has moved; the separate legacy editor/store remains. [A2](ACCEPTANCE.md#a2--one-engine-without-lost-notes) is not complete.

C078 merged through PR43 at5ceabea3 and implements the [read-only comparison boundary](migration/comparison.md): a real disposable corpus of206 variants preserves204 existing variants and compares two staged notes, links, PNG media and workspace projection. Revalidation, interrupted reads, later edits and cancellation are exercised. [Current delivery status](NEXT-AGENT.md) distinguishes these passes from final integration. Unqualified unplaced navigation, ambiguity and unsupported media still refuse; no authority selection or real-library migration is enabled.

C079 merged at8b762a9d; PR and post-merge Verify/parity pass. C080 merged through PR45 at d4e443ee; PR and post-merge gates pass ([receipt](cycles/evidence/C080/merge.json)). It preserves connection-bound navigation and unplaced local Archive in previews. C081 defines the [exclusive upstream admission prerequisite](migration/seal-admission.md). [C082](cycles/C082-managed-admission.md) implements and tests its internal coordinator; upstream PR20420 is green but awaits a decision on the automatic production deployment that merging would trigger. Complete writer coverage, runtime adoption and authority selection remain pending.

## Carry forward

- [Accepted interaction decisions](DESIGN-DECISIONS.md), especially favorites (D19a), sidebar/organization and direct editing (D26–D28), history (D29) and full side chats (D30).
- Real Paper, PortableDoc, acknowledged revisions, conflict handling, direct assistant edits and guarded Undo.
- Per-chat folders/drafts, attachments, parent references and correctly owned activity.
- The opt-in [local runtime](LOCAL-BARKPARK.md): a built Windows checkout is still required.
- The [editor regression matrix](EDITOR-PARITY.md), live suites, upstream licenses and provenance.

## Unfinished integration gates

| Gate | Current evidence | How it clears |
|---|---|---|
| G1: upstream editor integration | [Barkpark PR #20020](https://github.com/FRIKKern/barkpark/pull/20020) merged the full stack at b70214090; PR19579 is also marked merged. | C074 pins the shipped fallback to b70214090; local consumed-baseline tests, reviewed captures and hosted20/20 pass. PR37 merged at75b16f9b; G1 is clear. |
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

Deliver stages through [bounded cycles](CYCLES.md). [The current cycle](cycle.json) and [handoff](NEXT-AGENT.md) identify the current bounded outcome and its verified status. The ordered next slices live in the [migration contract](migration/README.md); original preparation/editor/profile evidence remains linked there and in the [P1 audit](cycles/C039-completion-audit.md). Device authentication is shared by default without asking. Closing a cycle does not complete a stage.

Historical integration checkpoints remain in [C008](cycles/C008-integration.md); they are evidence, not an active queue.
