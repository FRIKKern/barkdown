# C049 — Internal references

Accepted bounded checkpoint, starting from C048 `731d959`. Implementation `4f240e2` plus policy-refusal correction `8dd0113`; final native/desktop source `1e57023`, standard captures `fff3110`, private Barkpark `30c007e43`. Work remains on `codex/p2-migration`, draft PR #32; upstream draft PR #20020 remains stacked and unmerged. No real-library writes, authority switch, merge or deployment.

## Outcome

Two-pass preflight resolves canonical `barkdown://doc/<id>` links against the complete captured profile. Staging rewrites them to native `wikilink` carriers with profile-qualified `docId`, preserving marked display text. Forward, cyclic and self references work. Missing/malformed/foreign-profile targets and ambiguous double-link marks refuse before network access. Immutable plans bind mapped payloads; changed journals refuse instead of being rewritten. Policy 409s are explicit `create_refused`; only `paper_exists` permits existing-paper reconciliation. No publishing-policy bypass.

## Evidence

[Results and hashes](evidence/C049/results.json), [paired identities](evidence/C049/paired-profiles.json), [reviewed stills/GIFs](../visual/migration/README.md).

- 36 preparation/staging unit checks pass, including corrupt plans, partial resume, same-slug profile separation and later human edits.
- Two separate owned runtimes pass seven marked links across six carriers: paragraph, heading, quote, bullet, task, cell and a self reference. Real typing/save/exact Undo, hover/Open, cyclic navigation, actual asynchronously projected backlinks, reload and clean Electron restart agree with server state. Child exit after the first receipt resumes without duplicate notes; source, backup and workspace remain exact.
- All 38 native stills, 103 raw-video samples, 103 decoded GIF frames and 20 restart samples inspected. Full-size previews and 760px layout fit. Two-fps review is not every raw video frame; originals retained.
- Full desktop suite passes; existing POSIX-only authentication test skips on Windows. Isolated table row passes 6/6 using native Home/Shift+End selection, retaining server/reader assertions.
- Fresh live status capture has a real Claude edit; five stills and all 37 GIF frames inspected. Fixture tour has 40 frames/eight GIFs byte-identical to the reviewed C048 baseline, no environment/pixel/geometry changes. Current narrow workspace/side-chat images also inspected. Explicit approval `56030e54…` is linked from results. Root `npm run verify` passes.

## Retained failures

Native runs under `docs/visual/migration/runs/`: `00-34-13` exposed a duplicate-policy refusal from multiword fixture tags (fixed explicit handling, single-token category and separate runtimes); `00-37-34` sampled graph before its real five-second projector and assumed the wrong source key (bounded polling of actual `from_doc_id`); `00-40-00` had a malformed UTF-8 saved-state regex (explicit Unicode escape); `00-43-27` and `00-45-47` raced navigation or inspected a blank human breadcrumb (wait for exact path plus mounted content). Full timestamped folders are retained. Earlier paired six-case passes remain historical; final seven-case runs are `2026-09-24T00-52-48-801Z` and `2026-09-24T00-54-54-614Z`.

C048 Linux parity `35938173825` failed 19/20 because the table test's synthetic selection collapsed before toolbar access. Retained trace and inspected screenshot show a hidden toolbar with anchor=head=71. Native keyboard selection now passes locally; fresh Linux verification after push remains required. Root and visual CI at C048 passed.

## Repository truth and next action

[Inventory](evidence/C049/repository-truth.json): Barkdown main plus one delivery lane; three owned upstream lanes. Other upstream contributors' remote branches are not this run's cleanup scope. Forty-three historical Barkdown worktrees remain locked/recoverable; the user's detached test app and shared services were untouched. No branch retirement is currently due. Append-only evidence storage needs a separately reviewed retention policy if size becomes a problem; never delete baseline evidence to pass checks.

README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, migration/visual pages and relevant area READMEs reviewed. A2 and product decisions remain accurate and unchanged. Guerrilla claim epochs: inline breaks 9, create-only 15, nested tasks 4 at 01:05 UTC; not closed because upstream is unmerged. Named upstream workflow/SDK/security/doc gates remain separate; their source inputs match the stacked base (ledger retained).

Push this evidence, monitor fresh Linux parity and start a bounded owned-image staging/recovery slice. Media, remaining unsupported structures, production source-quiescence adapter, navigation activation, history/receipt conversion and rollback remain open. No automatic upload retry contract is assumed. Six-hour goal continues through at least 04:17:20 UTC.
