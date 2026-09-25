# C075 — captured writer generations

**Status:** done. Final runtime e4a60ac9 and evidence 0f2cfc93 merged through [PR38](https://github.com/FRIKKern/barkdown/pull/38) at c6961328 on 25 September 2026. [Merge record](evidence/C075/merge.json).

**Outcome:** captured foreground/provider/MCP/goal contexts cannot write after quiescence starts; admitted or interrupted writes remain visible to the migration gate. Provider streaming remains responsive without forwarding unpersisted events. [Contract](../migration/writer-fence.md), [evidence](evidence/C075/README.md). No authority activation or legacy retirement.

**Preflight and budget:** Node22.13.1/npm11.5.2, healthy locked installs, built private upstreamb70214090. One bounded writer-admission checkpoint within the four-hour run; implementation, focused failures, full regression, then one final capture/review/push batch. Preserve shared Barkpark checkout/services.

**Affected boundaries:** store-owned generation and cross-process admission; captured tokens in native/API/MCP/goal/workspace writes; async acknowledgement/receipt retention; backup/adoption ownership; provider sequence/persistence/finalization.

**During work:**13 fence/process checks, actual adapter failures, goal ownership and adoption regressions. Both isolated200-chunk20Hz samples preserve exact transcript/restart readback; corrected coalescing persists101 events, limits max dispatch lag to65–69ms and max durable-visible latency to208–211ms. Timings are synthetic, not native UI latency.

**Ready checkpoint:** final source e4a60ac9 passes full desktop and30 focused stream/goal tests (13 stream cases). Fresh native capture proves refusal/open-buffer retention/restarted originals;4 stills,81 raw1fps samples and51 GIF frames reviewed. Live Paper uses a real Claude edit;5 stills/37 GIF frames and6/6 table checks pass. Standard40 stills/40 differences/40 GIF frames inspected, zero pixel/geometry changes, explicitly approved. Root verification and final hosted Verify/Visual pass; real Paper/server parity passes20/20. Prior full real parity20/20 at6033ee4 remains separately identified.

**Next action:** C076 profile preparation is planned in the current handoff. Final hosted Verify/Visual and real Paper/server parity 20/20 pass. Hosted 40 stills/40 differences/40 decoded GIF frames were inspected; Linux environment differences are documented in the named review. No owned test service remains. Root README dark demo remains applicable to unchanged ordinary editing; fresh dark live hero is reviewed.

**Retained failures and learning:** initial Node/Electron Windows identity mismatch, disclosure-toggle race, capture geometry defect, delayed first progress and six actual-driver sink-refusal rejections were reproduced and corrected. Raw logs and rejected motion remain linked in evidence. Shared provider lifecycle changes need cheap actual adapter-loop fault tests before broad validation; registry-only tests missed detached-promise failure. No gate was weakened.

**Limits and next slice:** child teardown, durable human drafts, final comparison, sealed selection and rollback/retirement remain A2. The mounted draft probe proves that active note-label composition is missing from recovery snapshots; retain it or refuse preparation until settled. Startup theme flash and heavy narrow Paper wrapping remain; no complete daily-use polish claim.

**Repository truth/cleanup:** main plus one reused lane.43 locked retired worktrees,2 stashes and the detached integration recovery checkout remain preserved; inventory and final ref retirement follow merge. README/app-guide/plan/acceptance continue to distinguish the Windows source prototype from an installed or migrated product. No deployment or user-library migration.

**Delivery cost:** final hosted parity took 13m39s; Verify 1m48s and Visual 2m33s ran concurrently. The [bounded CI audit](evidence/C075/ci-effort-final-pending.json) records zero cancellations in nine recent runs; it was captured before final parity finished and is not a billing or idle-time estimate. During that wait, hosted visual review and a two-case actual-service [run-drain probe](evidence/C075/run-drain-probe.json) produced the next boundary evidence. The probe initially used a profile store facade where the controller requires a concrete store; corrected before the passing report. Token billing and active/waiting breakdown are unavailable.
