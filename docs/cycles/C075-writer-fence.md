# C075 — captured writer generations

**Status:** active, implementation and focused tests in progress. Four-hour run ends25 September13:44:56 UTC. Reuse codex/paper-migration-ready, now based on merged75b16f9b; no second branch or cycle.

**Outcome:** old foreground/provider/MCP/goal contexts cannot write after quiescence begins, and pending/interrupted writers remain visible to the migration gate. [Implementation contract](../migration/writer-fence.md) and [audited owners](evidence/C074/writer-boundary-audit.json). No authority toggle or legacy retirement.

**Preflight:** Node22.13.1/npm11.5.2 and locked dependencies healthy; current private upstream b70214090 already built. C074 full desktop/root, native/fallback/live reviews and hosted20/20 pass. Preserve shared Barkpark checkout and services. Implementation, tests, area documentation and retained development evidence are uncommitted in this lane.

**Tripwires:** durable metadata ownership and atomic admission, sync/async nesting, captured tokens across subprocess startup, dead-child uncertainty, source workspace/media boundaries. Fast tests: fence races/invalid ownership/crash retention plus document/edit/run-scope/MCP/goal/profile regressions. Ready proof: actual stale native and MCP writes refused, normal save/Undo preserved, full desktop/root and real Paper parity, new reviewed standard/live evidence after implementation commit. Native keyboard suites run serially. Batch app README/harness work before formal capture.

**Progress:** writer admission and foreground/document/Paper/workspace/provider/MCP/goal wiring implemented. Thirteen focused admission/process checks pass, including delayed real HTTP acknowledgement/readback/receipt, cross-process race, stale MCP, quiescent empty MCP reads, and delayed owned worker refusal. Shell adoption25 checks and cold-authority interruption/rollback suite pass with controls preserved in backups and excluded from the destination. Native smoke passes and four stills were inspected. Full desktop found a queued disclosure-toggle race; fixed with immediate intent recording, and78-check native desktop smoke passes. Full rerun is active.

**Next action:** collect full desktop result (session50525, TEMP/barkdown-c075-desktop-2.log), commit source, then run formal writer-fence/live/standard captures serially. Review every changed image/motion and publish a tested evidence checkpoint. Child teardown, final comparison, sealed selection, human draft recovery and rollback still belong to A2.

**Cleanup:** main plus this active delivery lane. PR37 is merged; reuse its branch for the next milestone rather than leave a dead ref. Retained worktrees/stashes are recovery history. The desktop suite owns temporary services; capture them in its terminal handoff until exit.

**Rework:** native smoke1 found Node/Electron Windows device-ID disagreement; root identity now uses canonical drive path plus exact inode and has a cross-runtime test. Smoke2 exposed contextBridge dropping custom Error properties; the harness checks the actual encoded message. The first race-test assertion omitted the store’s explicit missing-value default; corrected without changing behavior. A new empty-store MCP test found read tools reseeding a closed library; reads now reload without seeding. Retain these diagnostics in [C075 evidence](evidence/C075/README.md).
