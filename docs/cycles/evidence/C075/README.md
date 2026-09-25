# C075 writer-fence evidence

Final runtime source **e4a60ac9**; private upstream **b70214090**. Windows source prototype. [Final hosted checks](hosted-final-checks.json) pass; [PR38 merged](merge.json) at c6961328.

| Boundary | Evidence | Result |
|---|---|---|
| Admission, async acknowledgements, subprocess races, stale MCP/goal contexts | [Focused fence log](fence-final.log) |13/13 pass; also included in final full suite |
| Streaming, failed durable sinks and goal integration | [Focused log](stream-refusal-focused.log) |30 pass, including13 stream cases and six actual API/Claude/Codex refusal paths |
| Desktop, adoption, recovery, profiles and Undo | [Final desktop](desktop-release.log) |Pass on e4a60ac9 |
| Native refusal/open buffer/restarted originals | [Gallery](../../../visual/writer-fence/README.md), [log](native-release.log) |Pass;4 stills,81 raw1fps samples and51 GIF frames inspected |
| Real Claude and Paper | [Live manifest](../../../images/status/history/2026-09-25T12-49-12-713Z.json), [log](live-release.log) |Pass;5 stills/37 GIF frames inspected; table headers/alignment6/6 |
| Standard fixture review | [Gallery](../../../visual/runs/2026-09-25T12-49-16-707Z/README.md), [log](visual-release.log) |40 stills/40 differences/40 GIF frames inspected; zero pixel/geometry changes; explicit approval |
| Root verification | [Final log](root-release.log) |Pass |
| Real Paper/server matrix before provider-only follow-up | [Local report](parity.md), [initial hosted result](hosted-parity-initial.json) |20/20 at6033ee4 and944d8154 respectively; [final hosted20/20](hosted-parity-final.json) passes on0f2cfc93 |

[Named final cross-journey review](../../../visual/writer-fence/runs/2026-09-25T12-45-28-088Z/review.json) binds provenance, counts, encoding, observations and limits. [Checkpoint](final-checkpoint.json) records validation handles/results. Root README dark demo still applies to ordinary editing; the fresh dark live hero is reviewed. Light views test contrast and interaction regression.

## Measured streaming improvement

The [isolated20Hz probe](stream-probe.json) found up to2445ms dispatch backlog after fencing. Provider-only pre-sequence coalescing now preserves immediate first progress and synchronous persist-before-forward. [Corrected measurements](coalesced-stream-probe.json) retain all200 chunks/restart readback in both samples:101 persisted events,65–69ms max dispatch lag,208–211ms max durable-visible latency. These are synthetic persistence-path timings, not a native UI latency claim. Failed sinks cancel/finalize without attempting another report through that sink.

## Retained failures and earlier proof

- [Initial native failure](native-smoke-rejected/manifest.json): Windows Node/Electron device-ID mismatch; corrected with a cross-runtime regression.
- [Harness failure](native-smoke-harness-rejected/manifest.json): contextBridge strips custom Error properties; actual encoded refusal is now asserted. [Development smoke](native-smoke-passed/manifest.json) is not formal clean-source evidence.
- [Initial desktop failure](desktop-initial.log): queued disclosure toggle raced rendering. [78-check smoke](desktop-smoke.log) and [first full rerun](desktop.log) pass.
- [Concurrency assertion](race-harness-initial.log): explicit missing-value expectation corrected.
- [Rejected motion](../../../visual/writer-fence/runs/2026-09-25T11-40-27-781Z/REJECTED.json): scale/clipping fixed with actual BrowserWindow geometry. [Initial accepted review](../../../visual/writer-fence/runs/2026-09-25T11-50-28-240Z/review.json) is source4e618ef7.
- [Initial stream full-suite failure](stream-desktop-initial.log): delayed first progress. Immediate leading chunks fixed it; [e325ae6e full run](stream-desktop-before-refusal.log) passes.
- [Six actual-driver failures](driver-refusal-initial.log): refused text/error sinks caused unhandled rejection after cleanup. Corrected before final capture; all six now pass within the30 focused checks.
- Initial PR38 head944d8154 passed all hosted gates; [visual review](hosted-visual-review.json) and [20/20 parity](hosted-parity-initial.json) are retained separately from final delivery.

## Remaining boundaries

No authority activation, owned-child teardown, abrupt-restart human-draft restoration, uncertainty reconciliation, external-client fence or legacy retirement is claimed. The [mounted draft probe](draft-retention-probe.json) proves active note-label composition is omitted from recoverySnapshot/flush; preparation must retain it or wait for verified composition end. [Next-boundary audit](next-boundary.json) and [contract](../../../migration/writer-fence.md) define the next work.

Narrow Paper wrapping, startup light flash and standard step-GIF shadow quantization remain explicit visual limitations. Full recordings and PNGs are retained. [Initial repository inventory](repository.json) preserves43 locked recovery worktrees and2 stashes; final ref reconciliation follows merge.

[Final hosted visual review](hosted-visual-final-review.json) covers40 stills,40 differences and40 decoded frames; the bundle verifies and Linux/Windows differences are documented. The Windows baseline remains selected. [Pending-turn probe](run-drain-probe.json) reproduces runtime/auth starts still waiting after writer drain; both refuse before SDK dispatch when released. [Premerge inventory](premerge-repository.json) preserves recovery state. The [CI audit](ci-effort-final-pending.json) is a bounded timing snapshot, not a billing or agent-idle measure.

Documentation closeout: [root verification](closeout-verify.log) passes. No app or capture input changed; C075 reviewed media remains applicable. C076 is planned, with no implementation claim.
