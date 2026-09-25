# C077 — whole-library comparison contract

**Outcome:** resolve the composition gaps between live preparation and offline staging before implementing an activation-capable seal. The [comparison contract](../migration/comparison.md) distinguishes mapped legacy notes, existing Paper variants, media, workspace and fresh ownership. This checkpoint changes documentation only; it does not implement comparison or advance A2 acceptance.

**Status:** contract complete; integrating on codex/migration-comparison, based on main19f9cb8a. C076 post-merge parity and both main Verify runs passed. No open PR or unmerged application dependency remains.

**Preflight:** Node22.13.1; existing locked dependencies reused. Plan and cycle commands identify P2. Read source owners and regression tests. The existing staged-note pass omits pre-existing Papers; its mutating recovery path cannot serve as a read-only comparer. The preparation inspector is historical state, and the workspace preview still refuses unplaced notes. These are implementation prerequisites, not newly failing runtime behavior.

- **Affected boundaries:** documentation for whole-library comparison and future authority admission; no runtime or capture inputs change.
- **During work:** migration, catalog, writer-admission and preparation owner regressions; review claimed guarantees against actual code. Keep mocked orchestration distinct from real runtime proof.
- **Ready checkpoint:** focused regressions, root verify, truth/link review and clean branch/PR inventory. Existing C076 visuals remain applicable because app/dependencies/harness/generated roadmap are unchanged. Commit/push and integrate this bounded contract before another implementation lane.

**Stopping condition:** reviewed implementable contract, measured regression result and passing root verification. No extra process tooling, broad UI capture or claim of a completed seal. Next implementation is the internal read-only mixed-corpus comparison described in the contract, including a pre-staging baseline; selection/rollback follow after that checkpoint is delivered.

**Repository hygiene:** main plus this one delivery branch. Preserve43 locked recovery worktrees, two stashes and detached integration recovery. Primary agent reviews their provenance at the next cleanup; none are deletion candidates solely because they are old. No owned test services; paused heartbeat stays paused.

**Validation:**208 owner regressions passed in21.682s; root verify passed in46.549s. [Source-bound results](evidence/C077/validation/result.json) and tracked logs record the unchanged application source19f9cb8a and documentation working state. Upstream perspective tests were inspected, not executed. No app inputs changed; prior C076 reviewed images remain applicable. Root README, roadmap, guide and design decisions remain accurate without updates. PLAN, architecture, migration contract and current handoff now point to the comparison boundary.
