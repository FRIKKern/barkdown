# C047 — Heading formatting and alignment — accepted

Candidate implementation f5895b5 preserves native content carriers for marked headings and align for center/right paragraphs and headings. Preflight retains refusals for deep heading display, unresolved internal links, unknown metadata, unsupported nested alignment, lists/media and inline CR. No migration authority switch or real-library access. Work stays on codex/p2-migration.

## Proven checkpoint

Final native harness at 2aee376 / upstream 8d48ae661 passes all sixteen cases: actual typing, acknowledged structured saves, exact saved Undo, reload and Electron restart. Computed presentation checks verify center/right alignment, h1/h3 hierarchy and linked bold-italic heading before and after reopen. Native paragraph and marked-heading Shift+Enter save correctly and Undo restores exact original carriers. Source, backup and workspace remain unchanged.

[Reviewed media](../visual/migration/README.md): 23 stills, 77 video samples, all 77 decoded GIF frames and eight restart samples. Thirty preparation/staging tests and production PortableDoc tests pass. The real sixteen-case staging interruption/reconciliation run passes, retaining later human edits; [API result](evidence/C045/staging-1790205542558.json) is append-only under the harness's existing output directory.

Two failed native assertions are retained with source-bound captures and logs under evidence/C047. Literal-LF DOM input may split one marked carrier; the edited field compares marked text runs while Undo remains exact. Native Shift+Enter inserts an unmarked break; the corrected expectation verifies unchanged marks on both existing text runs, without inventing marks on the new break. The intermediate sixteen-case pass had a stale hardcoded summary label, now dynamic.

## Closeout

Full desktop and root verification pass. Five fresh live status stills and all 37 GIF frames were inspected after a real Claude turn. Fixture comparison has no geometry or above-tolerance pixel differences: three changed PNGs were inspected beside prior frames; 37 PNGs and all eight GIFs are byte-identical to the fully reviewed prior candidate. Explicit approval and hashes are retained in [results](evidence/C047/results.json). Source b837e13 precedes captures and this evidence commit. All owned capture/API runtimes stopped; shared services remain untouched.

Truth review: README/live health pages, guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, migration contract and accepted decisions were checked. Only P2 content coverage changes; app navigation, profile ownership and legacy authority remain unchanged. Barkdown has main plus one delivery branch; upstream has main plus three. Next: archive this record and plan bounded quote/nested-list coverage on the same branch.

Upstream doc budgets and anchors pass at 8d48ae661. Documentation-only 2289cf270 also fixes a stale list-boundary paragraph; its doc budgets and anchors pass with explicit Git Bash/bundled Python. Native implementation is unchanged. Separate upstream CI failures concern workflow coverage, stale React tarballs and Sobelow census; none of those inputs changed relative to stacked base bf23f773. G1/G2 remain integration gates; no merge/deployment. C046 evidence supplement retains details. Inline-break task task-46160685b0b510c7 has criteria 1/2 stamped, while criterion 0 needs native list coverage. Claim epoch 5; create-only task epoch 11; both lease through about 00:12 UTC. Use fresh task reads before stamps.

The six-hour goal remains active through at least 2026-09-24 04:17:20 UTC. After C047 closeout, plan the next bounded P2 outcome from actual remaining mappings; nested lists/quotes, references/media, activation and rollback remain open. Preserve every source and backup.
