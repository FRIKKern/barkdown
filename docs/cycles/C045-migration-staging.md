# C045 — Durable migration staging

Completed at source `cf0612c` on `codex/p2-migration`, carried by [draft PR #32](https://github.com/FRIKKern/barkdown/pull/32). No real library, navigation activation, merge or deployment. Upstream `844ecd321` supplies the unmerged create-only route in [stacked draft PR #20020](https://github.com/FRIKKern/barkpark/pull/20020).

The offline module binds an immutable plan to the exact prepared source, reviewed publishing metadata and captured local runtime/profile. Every create has a durable intent first. Readback compares structured content, provenance and acknowledged revisions before recording a receipt. Resume never blindly replays an uncertain write; an absent target with an intent requires explicit reconciliation. Existing, draft, edited or missing targets and changed/corrupt source refuse. The entire journal is checked before target access, so a corrupt later receipt cannot permit an earlier write. Original notes, history, proposals and workspace bytes stay intact; authority remains legacy.

## Evidence

- `npm --prefix app test`: full desktop suite passed, including all 22 staging tests. One POSIX-only authentication case skips on Windows. The staging suite covers six actual process exits, lost committed response, concurrent stagers, changed source/target/runtime, corrupt records (including null/array/boolean), missing completed receipts and whole-batch refusal.
- `npm --prefix app run test:migration-staging:isolated`: [real private Paper result](evidence/C045/staging-1790196115260.json) at `cf0612c` / `844ecd321` passed ten independently authored content comparisons, staging-process exit after server commit, readback-only resume, repeated result and later human edit preservation. Initial pre-hardening result is retained separately.
- `npm --prefix app run shots:isolated`: [live manifest](../images/status/history/2026-09-23T20-44-42-970Z.json), real Claude edit saved. Five stills and all 37 decoded GIF frames inspected for content, menus, selection, themes and geometry.
- Deterministic visual capture/compare: 40 frames, zero pixel/geometry differences. All eight GIF sequences and narrow layouts inspected; [explicit approval](../visual/reviews/approval-2ab722e21dfe11c2b1b1883ad7a9ad18f765f1807ea8c35f878f885fa24102b5.json). UI tours are regression evidence, not migration UI proof.
- Root `npm run verify` passed; retained logs/hashes are in [results](evidence/C045/results.json). All owned capture runtimes stopped.

## Limits and next action

No UI integration or authority switch; caller must stop source writers and provide runtime ownership assertions. No database-death or power-loss durability claim. Media, internal links, navigation rewriting and legacy receipt semantics remain unresolved. The next bounded cycle should open the staged corpus in real Paper, edit/save/Undo/reopen, compare server structure and inspect visual evidence before widening migration support.

Truth review covered README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, architecture/decisions and visual area READMEs. P2 stays active; upstream G1/G2 remain blocked. Barkdown has main plus one delivery branch; Barkpark has main plus three owned delivery branches. Retired worktrees and the user's running app are preserved.

Upstream tracking correction: the CLI's active server was local, while PR validation uses Guerrilla. The local placeholder was cancelled with a transfer reason. Canonical task `task-0974164b66eea275` is published and claimed on **Guerrilla** by `codex-barkdown-c044`; all three exact criteria were stamped and read back. Its PR task gate now passes; other upstream CI failures remain. Use explicit `bp -s Guerrilla`, read the current epoch before stamps, and keep the claim alive while PR review is pending.

The existing autonomous goal/heartbeat continues through at least **2026-09-23 21:43:38 UTC**. This cycle completion does not end that run.
