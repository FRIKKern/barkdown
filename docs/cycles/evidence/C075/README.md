# C075 writer-fence evidence

Implementation6033ee4; capture-only correction4e618ef7; private upstreamb70214090. Windows source prototype.

| Boundary | Evidence | Result |
|---|---|---|
| Admission, async acknowledgements, subprocess races and stale MCP/goal contexts | [Focused log](fence-final.log) |13/13 pass |
| Desktop, adoption, cold recovery, profile and Undo regressions | [Full desktop](desktop.log) | Pass; adoption25 checks and cold process-exit cases included |
| Real Paper/server matrix | [Parity report](parity.md), [machine result](parity.json) |20/20 pass |
| Native refusal, retained open buffer and readable originals after restart | [Gallery](../../../visual/writer-fence/README.md), [log](native.log) | Pass,4 stills and full recordings reviewed |
| Live Paper and real Claude | [Manifest](../../../images/status/history/2026-09-25T11-55-19-744Z.json), [log](live.log) | Pass,5 stills and37 GIF frames reviewed |
| Standard fixture review | [Gallery](../../../visual/runs/2026-09-25T11-56-14-104Z/README.md), [log](visual.log) |40 stills/40 diffs/40 GIF frames inspected; zero pixel/geometry changes; explicitly approved |
| Root verification | [Log](root.log) | Pass |

[Named cross-journey review](../../../visual/writer-fence/runs/2026-09-25T11-50-28-240Z/review.json) records provenance, encoding, observations and limits. [Repository inventory](repository.json) retains recovery worktrees and stashes. [Synthetic writer timing](writer-timing.json) is a single loaded-machine sample, not a UI latency claim. [Next boundary audit](next-boundary.json) prepares child teardown, draft retention and sealed selection.

## Retained failures

- [Initial native failure](native-smoke-rejected/manifest.json): Windows Node/Electron device identity mismatch, fixed with cross-runtime regression.
- [Harness failure](native-smoke-harness-rejected/manifest.json): contextBridge strips custom Error properties; encoded refusal now asserted.
- [Development smoke](native-smoke-passed/manifest.json) passes but is not formal clean-source evidence.
- [Initial desktop failure](desktop-initial.log): queued disclosure toggle raced a render. Fixed; [78-check smoke](desktop-smoke.log) and full rerun pass.
- [Concurrency assertion](race-harness-initial.log): explicit missing-value expectation corrected.
- [Rejected formal motion](../../../visual/writer-fence/runs/2026-09-25T11-40-27-781Z/REJECTED.json): capture scale and clipping corrected before the accepted run.

No authority activation, child teardown, abrupt-restart draft restoration, external-client fencing or legacy retirement is claimed. Hosted gates and merge are separate delivery steps. Root README dark demo remains applicable: no change to its demonstrated ordinary creation/editing journey; fresh live hero accompanies this checkpoint.
