# C080 — owned migration navigation

Source058554fd on codex/migration-navigation adds read-only owned projection: tabs, favorites, Page keys/labels and unplaced local Archive. Comparison consumes it; media awaits asynchronous ownership/source checks. Missing identity or changed source/runtime refuses. No authority selection or legacy retirement.

- **Passed:**81 focused checks24.481s;85 migration regressions20.576s; full desktop777.915s; native managed navigation/restart203.836s; real whole-library comparison113.078s. [Desktop/native](evidence/C080/desktop-01/result.json), [real comparison/live](evidence/C080/live-01/result.json).
- **Reviewed:** [native gallery](../visual/migration/README.md),6 stills/206 recording samples/25 decoded GIF frames; live5 stills/37 decoded GIF frames, real Claude and table headers6/6. Development fixture failures retained; corrected fixture observes production data and does not repair navigation.
- **Remaining:** final live refresh after documentation cleanup, standard capture/compare/actual review/approve, root verification, one coherent push and hosted integration. App implementation is unchanged; temporary status was removed from the main-process README, so its conservative freshness gate requires another live capture. Keep transient status in this handoff on future cycles.

Two-hour estimate was the validation budget, not a completion claim. Node22/npm11 locked dependencies and upstream b70214090 reused. No owned services now. Current plan isP2/A2; exclusive upstream mutation admission, activation, interruption recovery and rollback remain open.

Repository inventory: main plus this delivery lane, remote main,43 locked recovery worktrees,44 detached worktrees and two stashes. Preserve recovery history; retire the delivery lane after verified merge. C079 PR44 and post-merge gates are green ([record](evidence/C079/merge.json)). Next: commit reviewed native/live evidence and documentation, then finish capture gates without expanding scope.
