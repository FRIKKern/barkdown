# One dependable place for notes and agents

Active direction, set 2026-09-21. This replaces the editor-feature backlog as the primary delivery plan. The [earlier plan](archive/2026-09-21-plan.md) is history; its implementation and regression evidence carry forward.

## The next complete journey

**Create a local profile → write and edit with an agent → restart without losing work → move the profile to another machine and continue.**

Local-only use stands on its own. Cloud connection is optional. People organize Pages; cloud discovery stays in Cloud archive. Agents visibly edit the same documents people edit, with revision checks, human takeover and guarded Undo.

This journey is not accepted end to end. P1 was accepted on the Windows source prototype at `27ea120`. The Mac cycles delivered migration, legacy-editor retirement, recovery, export/import and packaged nightlies; bounded Windows source journeys now pass in C097; real-library and cross-machine acceptance remain pending. Do not express progress as closed-issue percentages: integration and failure handling are the remaining work.

## Migration effort estimate

**Reviewed 2026-09-29 (switch from the app's screen) · provisional working estimate: about 75%; scenario range about 30–90%; low confidence.** Reviewed again after the switch, rollback, interruption and Resume were driven from the app's own Settings screen and start-time notice in real Electron on the pinned runtime. That run found four app-side gaps the programmatic rehearsals could not see; all four are fixed and rehearsed. The working figure stays at about 75%: the remaining work narrowed (from 40 to 30 for this row), but a real library, recovery with live writers and a reconciliation view remain. Scope: the six “Migrate with a way back” checkpoints, not all P2 or the whole product. Acceptance remains unfinished.

Basis: estimated engineering-equivalent hours for demonstrated scope and remaining delivery, not measured historical hours, agent runtime, cost or a calendar forecast. Completed weights are retrospective judgments: staging/backup and real-editor preservation each span several substantial boundaries; comparison/navigation and the partial writer boundary are smaller completed slices. The range holds those provisional completed weights constant; revising them can move the range too.

| Existing checkpoint | Difficulty | Completed estimate | Remaining: optimistic / working / adverse | Basis and uncertainty |
|---|---|---:|---:|---|
| Preserve and stage | High | 100 | 5 / 10 / 30 | [Backup and staging evidence](migration/README.md); bounded supported formats. Final integrated recheck remains. |
| Edit migrated notes | High | 100 | 5 / 10 / 30 | [Real editor and original-history evidence](migration/README.md); final integrated preservation checks remain. New format support is outside this estimate. |
| Compare the library | Medium–high | 40 | 3 / 6 / 20 | [Comparison](migration/comparison.md) and [owned navigation](cycles/C080-owned-navigation.md) demonstrated; rerun under the real hold with the full supported corpus through the switch ([C083](cycles/C083-writer-admission.md)). |
| Protect the switch | Very high | 130 | 5 / 30 / 180 | [Doors on every audited door cluster and every background job; refusal for the admin, tenancy, identity, operator and fleet groups on HTTP and LiveView; offline boots refused; trusted hold endpoint, instance view and explicit recovery — all merged upstream and pinned](cycles/C083-writer-admission.md); five live rehearsals against the pinned runtime on macOS. Remaining: the full Windows writer corpus and media/child-effect reconciliation. C097 passes hold/restart, the six-writer bypass proof and a killed internal 20-record transaction with complete rollback/readback and explicit recovery; that bounded case does not cover every writer. |
| Switch and recover | Very high | 85 | 8 / 30 / 300 | [A2](ACCEPTANCE.md#a2--one-engine-without-lost-notes): restart while held stays blocked, explicit recovery, comparison under the hold, the durable selection, the switch as one action from the app's own screen with restart, rollback after ordinary use, interruption and Resume from the start-time notice, and the corpus review of 24 notes, each proven on macOS ([C083](cycles/C083-writer-admission.md)). Remaining: a real library, recovery with live writers, merging a reconciled difference (today a changed Paper is named, opens, is compared side by side, and is kept or restored from Settings). |
| Prove the way back | Very high | 40 | 20 / 70 / 420 | [A2](ACCEPTANCE.md#a2--one-engine-without-lost-notes): rollback of a selection restores the exact retained workspace, keeps staged Papers, keeps a later Paper edit on Paper and records the divergence for reconciliation, proven once on macOS; keep/restore reconciliation and legacy retirement subsequently shipped on Mac (C083/C087); real-library proof remains; C097 adds bounded Windows rollback/reconciliation proof. |
| **Total** | | **495** | **46 / 156 / 980** | Shared prerequisites counted once; remaining estimates include implementation, validation and integration. External waiting excluded. |

Calculation: working `495 / (495 + 156) = 76%`, displayed as **about 75%**. Adverse `495 / (495 + 980) = 34%`; optimistic `495 / (495 + 46) = 92%`, displayed as **about 30–90%**. These are scenario judgments, not a measured completion fraction, statistical interval or guaranteed worst case. The wide range is intentional: no reliable historical effort calibration exists yet.

**Calibration reviewed 2026-10-07:** C097 now passes Windows switch/rollback/Resume, forced-exit recovery and export/import between separate installations. The six-writer hold/reopen and all20 editor rows also pass; visual review caught a Control+, Settings collision, now repaired with eight native regression checks. A killed internal 20-record transaction now also rolls back completely, remains blocked across runtime restart and reopens through explicit recovery. C097 also preserves a completed local upload and acknowledged control across writer death/restart with full byte hashes, and checks child settlement timeouts against the real admission modules. A pre-row upload death now proves an orphan remains across restart; the repaired host refuses automatic recovery until its effects are reconciled. This closes an unsafe acknowledgement gap, not orphan reconciliation. A subsequent committed-deletion interruption preserves an orphan, and a Windows locked-file probe shows the pinned storage adapter returning success while bytes remain. Writer death before any hold now demonstrates a separate gap: the orphan survives restart even though admission drops its pending root and a later hold succeeds. These reduce bounded transaction/media uncertainty but do not complete deletion reconciliation, real-library, S3 or processing proof. Retain the same provisional 495 completed / 156 working remaining effort weights and about 75% forecast; the row weights are sizing assumptions, not a current feature checklist. A rehearsal that finds a bypass moves the adverse case; a passing selection-and-rollback rehearsal moves the working case. Update this estimate and the README when new evidence changes the outlook; record the reason in the current cycle. Follow [the progress workflow](CYCLES.md#effort-weighted-progress).

## Delivery sequence

The machine-readable queue is [plan.json](plan.json). `npm run plan` prints the next unblocked stage and separately reports release gates. Local evidence determines completion; closing an old GitHub issue cannot automatically complete a stage.

| Stage | Deliverable | Depends on | Exit evidence |
|---|---|---|---|
| P1 | Profile ownership and isolation | Existing local runtime | Two local profiles with the same document slug share no documents, media, profile-owned credentials, chats, drafts, favorites, caches or agent results. Restart restores the selected profile. Runs retain their captured profile and folder. |
| P2 | Every note on Paper | P1 | Backup and resumable migration preserve identities, links, content, media and human organization. Interrupted or repeated migration creates no duplicates. Retire the separate editor only after fixture comparison and restart proof. |
| P3 | Recovery and portable profiles | P2 | Crash and uncertain-save recovery preserve human work. Export/import includes owned data, handles machine-bound credentials explicitly, and restores links in another user-data root. Demonstrate the whole journey above with media and side chats. |
| P4 | Optional two-way cloud sync | P3 | Two devices converge after offline edits and repeated delivery; distinguish deletion from missing access; surface overlap; never silently reorganize Pages. Local-only profiles make no sync requests. |
| P6 | The agent's browser | P1 | Claude and Codex, run through the user's own CLIs, treat Barkdown's tabs as their browser: a twelve-task bench finishes as much as Claude Desktop and ChatGPT desktop, never opens another browser, works with sign-in that works, bookmarks and history from Chrome, and pauses on sensitive actions; a person lives in it for a working day ([A6](ACCEPTANCE.md#a6--the-agents-browser)). |
| P5 | Ordinary installation and daily-use pilot | P3; P4 for cloud pilot | Install/update on a clean Windows machine without a checkout or toolchain. Start, quit, recover and uninstall without losing user data. Validate keyboard access, long notes and diagnostics. |

Packaging research may proceed alongside earlier stages. The local-only pilot does not depend on P4. Other platforms follow the Windows pilot, not assumed compatibility.

## Current next stage

[C097 Windows return](cycles/C097-windows-return.md) is active from the C096 baseline. The pinned runtime, migration and recovery pass within documented disposable-profile scopes. An earlier full hosted Windows Desktop chain passed; the latest run failed during recovery startup. Bounded startup diagnostics pass locally; inspect the next hosted evidence before declaring this checkpoint integrated. Private capture30 completed one real Claude Code read/edit turn; later diagnostic captures use labeled sample transcripts, while broader continuity and Codex success remain unverified. A real-library switch and actual Mac-to-Windows transfer remain separate acceptance proofs.

P2 remains active. [C083](cycles/C083-writer-admission.md) delivered the upstream writer fence, Settings switch, interruption/resume, rollback and reconciliation on macOS. [C087](cycles/C087-legacy-retirement.md) retired legacy editing with the owner's explicit go: originals remain readable and rollback retains them, but a rolled-back library is read-only until switched again. [C096](cycles/C096-switch-drafts.md) now carries already-open Paper draft destinations through the switch.

P3 and P5 retain their dependency order in plan.json, but “todo” does not mean no implementation: [C085](cycles/C085-portable-profile.md) demonstrates recovery and export/import between installations on a Mac; [C086](cycles/C086-packaged-runtime.md) and [C088](cycles/C088-own-agents.md) deliver a packaged Mac runtime using installed agent tools. C097 adds same-machine Windows recovery/export/import; these cycles do not establish cross-machine portability or clean Windows installation. Signing and updater installation remain pending.

[C089](cycles/C089-agent-browser.md) demonstrates browser mechanics and real-agent local-site tasks; real sign-ins, owner desktop comparisons and daily use remain. C094–C095 deliver app-control commands; C090 delivers the real terminal with hosted Windows source evidence.

## Carry forward

- [Accepted interaction decisions](DESIGN-DECISIONS.md), especially favorites (D19a), sidebar/organization and direct editing (D26–D28), history (D29) and full side chats (D30).
- Real Paper, PortableDoc, acknowledged revisions, conflict handling, direct assistant edits and guarded Undo.
- Per-chat folders/drafts, attachments, parent references and correctly owned activity.
- The [local runtime](LOCAL-BARKPARK.md): Windows still needs a built checkout; Mac nightlies carry a packaged runtime.
- The [editor regression matrix](EDITOR-PARITY.md), live suites, upstream licenses and provenance.

## Unfinished integration gates

| Gate | Current evidence | How it clears |
|---|---|---|
| G1: upstream editor integration | [Barkpark PR #20020](https://github.com/FRIKKern/barkpark/pull/20020) merged the full stack at b70214090; PR19579 is also marked merged. | C074 pins the shipped fallback to b70214090; local consumed-baseline tests, reviewed captures and hosted20/20 pass. PR37 merged at75b16f9b; G1 is clear. |
| G2: cross-repository regression enforcement | [Issue #4](https://github.com/FRIKKern/barkdown/issues/4) needs the private-repo read token and deliberate broken-Tab proof. | Both repositories run the matrix; an intentional regression blocks the upstream PR. Never commit a credential. |

The [22 September read-only gate audit](cycles/evidence/release-gates-2026-09-22.json) recorded PR #19579 open/blocked at a5440345c. Its green parity job skipped checkout, build and the actual rows because the read token is absent. It does not establish matrix enforcement. No secret configuration or upstream workflow was changed.

The [24 September gate audit](cycles/evidence/C054/release-gates.json) supersedes that external-state snapshot: PR #19579 now reports merge conflicts (DIRTY); PR #20020 is open/unstable. The upstream read-token name remains absent. No secret or workflow was changed.

G1/G2 gate the integrated pilot, not isolated P1 implementation. Recheck external state before acting. The editor matrix still records limited server-side undo proof; carry that verification into P2/P3 rather than declaring all rows complete.

C097 control-surface regression: [a captured assistant bridge can borrow the newly selected profile](cycles/evidence/C097/control-profile-review.md) in both controlled current/baseline probes and actual Windows Settings selection. Native run04 retains the failure with A/new-B positive controls. The [captured-owner repair](cycles/evidence/C097/assistant-owner-review.md) now passes focused socket/native checks, including selection during a held response; all17 resumed Desktop commands and reviewed capture27 pass after a retained terminal-navigation failure; root40 passes55.180s; later coordinator recovery repair and full hosted Windows confirmation pass at f190e831 ([retained result](cycles/evidence/C097/hosted-desktop-26-review.json)). Catalog validation is published. This newer C094 boundary is not established by historical C039 acceptance; it is outside the six migration weights, so their estimate remains unchanged.

## Existing issue mapping

- [#6](https://github.com/FRIKKern/barkdown/issues/6): P1 and portability within P3.
- [#13](https://github.com/FRIKKern/barkdown/issues/13): P2 migration and retirement of the separate editor.
- [#7](https://github.com/FRIKKern/barkdown/issues/7): P4 sync.
- [#4](https://github.com/FRIKKern/barkdown/issues/4): G2, a gate rather than the next coding task.

P3 recovery and P5 installation have local backlog entries; separate GitHub issues are not yet created. Keep issue history and evidence. Completed editor tickets stay closed; this reset does not discard their code or reopen their features.

## Done means demonstrated

Use [ACCEPTANCE.md](ACCEPTANCE.md) for scenario gates and [VALIDATION.md](VALIDATION.md) for evidence. Record the source commit, exact command, result and limitations. Update `plan.json`, this plan and the handoff together. A stage becomes done only with linked evidence; blocked gates stay visible while other useful work proceeds.

## Prepared tasks

The ordered next P2 slices and acceptance are in the [migration contract](migration/README.md#ordered-cutover-work--evidence-and-remaining-boundaries). The [four completed September23 briefs](tasks/2026-09-23-next-four.md) are historical preparation evidence; they are not the next queue.

## Delivery cadence

Deliver stages through [bounded cycles](CYCLES.md). [The current cycle](cycle.json) and [handoff](NEXT-AGENT.md) identify the current bounded outcome and its verified status. The ordered next slices live in the [migration contract](migration/README.md); original preparation/editor/profile evidence remains linked there and in the [P1 audit](cycles/C039-completion-audit.md). Device authentication is shared by default without asking. Closing a cycle does not complete a stage.

Historical integration checkpoints remain in [C008](cycles/C008-integration.md); they are evidence, not an active queue.
