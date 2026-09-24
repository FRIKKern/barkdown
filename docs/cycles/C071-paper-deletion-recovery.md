# C071 — Paper deletion and recovery

**Outcome / status:** active. Complete safe deletion and explicit Recover a copy for an owned local draft, including restart and later human edits.

**Source / delivery:** Barkdown codex/paper-library at da788c5; reuse the clean isolated Barkpark codex/paper-create-only lane at30c007e43 for related contract work. Preserve all other worktrees and README vision changes. No merge/deploy.

**Delivery budget:** estimated ceiling3hours; stop when the bounded journey passes. Reassess concrete failures without silently reducing acceptance. Excludes same-identity restore, migration activation and general portability.

- **Affected boundaries:** server row/revision and transaction evidence; profile-owned durable deletion/copy identities; open canvas, saved Pages/favorites/tabs and recovery UI.
- **During work:** focused upstream race/rollback/permission tests; journal lost-reply, stale, corruption and cross-owner checks; scoped native smoke before captures.
- **Ready checkpoint:** full desktop/root checks, real private runtime lifecycle proof, code-area README updates; implementation commit then native/standard/live capture, actual inspection/approval and evidence commit. Capture only after code settles.

**Repository / services:** one Barkdown delivery lane; reuse suitable upstream lane rather than add a branch. Historical locked worktrees preserved. Start only owned disposable runtimes. Update this handoff after meaningful slices or failures.

**Progress, 21:37 UTC:** exact-draft SQL fence and atomic revision/event evidence implemented upstream. Initial 46 focused ExUnit tests pass, including independently committed interleaving and fault rollback. Explicit anonymous/read-only coverage is being added. Barkdown now retains a native snapshot before dispatch, never replays a sent deletion, and recovers one durable new identity. Forty focused journal/creation/connection checks pass; native and real HTTP journeys are running. No implementation/evidence commit yet.

**Task:** upstream `task-95a79f9e53c42dbe`, worker `codex-barkdown-c071`, current epoch2 (21:30 UTC pulse); parent task remains the PR20020 mission. Merge criterion stays open.

**Failures retained:** ExUnit setup initially used reserved `@type`, compared against pre-trigger row metadata, and attempted cleanup of append-only history. Corrected fixture assertions now compare fresh rows and retain disposable data. One HTTP assertion counted the deliberate human edit as retry; move its baseline after that edit. Default system Elixir was obsolete; use the configured Scoop toolchain. Dev compilation succeeds with existing unrelated warnings. These are test/tooling corrections, not waived behavior failures.

**Next action:** finish native delete/restart/copy proof, run the stable full checks, then implementation commits followed by fresh reviewed native/live/standard evidence and pushed checkpoints. Do not call unconditional restore.
