# C075 — captured writer generations

**Status:** active, final source e4a60ac9 locally validated; PR38 awaits final evidence push/hosted review. Four-hour run ends25 September13:44:56 UTC. Reuse codex/paper-migration-ready over main75b16f9b.

**Outcome:** captured foreground/provider/MCP/goal contexts cannot write after quiescence starts; admitted or interrupted writes remain visible to the migration gate. Provider streaming remains responsive without forwarding unpersisted events. [Contract](../migration/writer-fence.md), [evidence](evidence/C075/README.md). No authority activation or legacy retirement.

**Preflight and budget:** Node22.13.1/npm11.5.2, healthy locked installs, built private upstreamb70214090. One bounded writer-admission checkpoint within the four-hour run; implementation, focused failures, full regression, then one final capture/review/push batch. Preserve shared Barkpark checkout/services.

**Affected boundaries:** store-owned generation and cross-process admission; captured tokens in native/API/MCP/goal/workspace writes; async acknowledgement/receipt retention; backup/adoption ownership; provider sequence/persistence/finalization.

**During work:**13 fence/process checks, actual adapter failures, goal ownership and adoption regressions. Both isolated200-chunk20Hz samples preserve exact transcript/restart readback; corrected coalescing persists101 events, limits max dispatch lag to65–69ms and max durable-visible latency to208–211ms. Timings are synthetic, not native UI latency.

**Ready checkpoint:** final source e4a60ac9 passes full desktop and30 focused stream/goal tests (13 stream cases). Fresh native capture proves refusal/open-buffer retention/restarted originals;4 stills,81 raw1fps samples and51 GIF frames reviewed. Live Paper uses a real Claude edit;5 stills/37 GIF frames and6/6 table checks pass. Standard40 stills/40 differences/40 GIF frames inspected, zero pixel/geometry changes, explicitly approved. Root verification passes; final hosted Verify/Visual/Parity are next. Prior full real parity20/20 at6033ee4 remains separately identified.

**Next action:** commit/push reviewed evidence, inspect fresh hosted artifacts and merge PR38 only after all applicable gates pass. No owned test service remains; source/evidence outputs are complete, documentation/evidence edits uncommitted. Root README dark demo remains applicable to unchanged ordinary editing; fresh dark live hero is reviewed.

**Retained failures and learning:** initial Node/Electron Windows identity mismatch, disclosure-toggle race, capture geometry defect, delayed first progress and six actual-driver sink-refusal rejections were reproduced and corrected. Raw logs and rejected motion remain linked in evidence. Shared provider lifecycle changes need cheap actual adapter-loop fault tests before broad validation; registry-only tests missed detached-promise failure. No gate was weakened.

**Limits and next slice:** child teardown, durable human drafts, final comparison, sealed selection and rollback/retirement remain A2. The mounted draft probe proves that active note-label composition is missing from recovery snapshots; retain it or refuse preparation until settled. Startup theme flash and heavy narrow Paper wrapping remain; no complete daily-use polish claim.

**Repository truth/cleanup:** main plus one reused lane.43 locked retired worktrees,2 stashes and the detached integration recovery checkout remain preserved; inventory and final ref retirement follow merge. README/app-guide/plan/acceptance continue to distinguish the Windows source prototype from an installed or migrated product. No deployment or user-library migration.
