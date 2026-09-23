# C047 — Sixteen migrated cases; final validation

Candidate implementation f5895b5 preserves native content carriers for marked headings and align for center/right paragraphs and headings. Preflight retains refusals for deep heading display, unresolved internal links, unknown metadata, unsupported nested alignment, lists/media and inline CR. No migration authority switch or real-library access. Work stays on codex/p2-migration.

## Proven checkpoint

Final native harness at 2aee376 / upstream 8d48ae661 passes all sixteen cases: actual typing, acknowledged structured saves, exact saved Undo, reload and Electron restart. Computed presentation checks verify center/right alignment, h1/h3 hierarchy and linked bold-italic heading before and after reopen. Native paragraph and marked-heading Shift+Enter save correctly and Undo restores exact original carriers. Source, backup and workspace remain unchanged.

[Reviewed media](../visual/migration/README.md): 23 stills, 77 video samples, all 77 decoded GIF frames and eight restart samples. Thirty preparation/staging tests and production PortableDoc tests pass. The real sixteen-case staging interruption/reconciliation run passes, retaining later human edits; [API result](evidence/C045/staging-1790205542558.json) is append-only under the harness's existing output directory.

Two failed native assertions are retained with source-bound captures and logs under evidence/C047. Literal-LF DOM input may split one marked carrier; the edited field compares marked text runs while Undo remains exact. Native Shift+Enter inserts an unmarked break; the corrected expectation verifies unchanged marks on both existing text runs, without inventing marks on the new break. The intermediate sixteen-case pass had a stale hardcoded summary label, now dynamic.

## Remaining closeout

Full desktop session 37038 exited 0; evidence/C047/c047-desktop.log retains the pass and one existing POSIX-only authentication skip. Reviewed migration evidence and source are pushed at c9ac427. Next: fresh isolated live status capture, fixture capture/compare/actual inspection/approval and root verification. Update validation/truth, commit/push, archive completed cycle only after these checks. All private migration/API runtimes stopped; no shared service needs stopping.

Upstream doc budgets and anchors pass at 8d48ae661. Documentation-only 2289cf270 also fixes a stale list-boundary paragraph; its doc budgets pass. Native implementation is unchanged. Separate upstream CI failures concern workflow coverage, stale React tarballs and Sobelow census; none of those inputs changed relative to stacked base bf23f773. G1/G2 remain integration gates; no merge/deployment. C046 evidence supplement retains details. Inline-break task task-46160685b0b510c7 has criteria 1/2 stamped, while criterion 0 needs native list coverage. Claim epoch 4; create-only task epoch 10; both lease through about 23:50 UTC. Use fresh task reads before stamps.

The six-hour goal remains active through at least 2026-09-24 04:17:20 UTC. After C047 closeout, plan the next bounded P2 outcome from actual remaining mappings; nested lists/quotes, references/media, activation and rollback remain open. Preserve every source and backup.
