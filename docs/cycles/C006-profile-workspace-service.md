# C006 — Trusted profile workspace service

Status: active. Parent P1/A1 remains pending. Builds on C004 source `0086867`, evidence `90d312b`, and imported C003 registry source `1505340` (local cherry-pick `6b8af8c`, preserving both test commands).

## Outcome

Resolve profile UUID/root in main, validate every owner/generation boundary, and give ordinary runs and goal workers one durable workspace repository. Preserve late background transcript events without overwriting another profile's draft/navigation. Add safe opt-in boot/switch integration only after fixtures prove those boundaries; no incidental real-library adoption.

## Shared goal sink contract

`begin(request,resolved)` returns `{history,fresh}` after durable assignment/assistant reservation. Attempt UUID determines stable message IDs; repeated begin returns the same history with `fresh:false`, never redispatch. `event(request,event)` writes to that exact assistant record before display. `finish(request,result)` records driver finalization. `stageWorkerChats` preserves existing drafts/navigation. Trusted resolver yields `{scope,chat,settings,release}`; goal request carries profile/chat/coordinator/goal/task/attempt IDs and prompt/provider/images. Main transcript operations must preserve edit/retry/delete behavior through explicit commands.

## Checkpoint

C006 foundation implemented below. C003 imported as additive source only; app boot still legacy. No owned live runtime. C007 runtime-pool agent owns private dual runtime descriptors/leases separately.

## Repository foundation checkpoint

Shared workspace-repository.js is implemented with synchronous durable begin/event/finish acknowledgements, stable attempt message IDs, fresh=false duplicate reservation, sequenced owned event replay protection, interrupted-but-unfinalized reservations, worker goal/parent binding, navigation-only renderer snapshot merge and revision-checked explicit transcript commands. Store handles now recheck root ancestors and inode identity; provider envelopes add authoritative sequence numbers. Six repository scenario groups pass, including restart and late A/B isolation; existing ownership11 and registry24 checks pass. Not boot/UI wired yet. No live service owned. Next: trusted profile-service resolver and generation authorization, then app integration.


## Service foundation checkpoint

Trusted profile-service.js resolves captured UUID/root/settings/chat context and leases in main; validates generation on saves and profile ownership on cancel/approval/wait; persists events before foreground delivery and awaits durable driver finalization. Tests pass for late A output while B draft stays unchanged, persisted approvals, cross-profile control rejection, stale view saves, input/settings snapshots across delayed runtime startup, failed switch retaining A, cancellation retaining runtime until cleanup, and committed selection cleanup warnings. Profile boot/UI is still unconnected; this is a tested additive seam for the goal adapter, not P1 completion. Next: integrate the final C007 runtime source, explicit opt-in main/preload profile APIs, state ownership and profile settings UI, with real Electron switching regression and fresh evidence. No C006 visual baseline approved yet.

Trusted resolver also derives provider catch-up from stored messages/sessionSeen before reserving a turn. Actual Claude SDK stub launch confirms a resumed session receives intervening Codex/user decisions, excluding previously seen turns. No renderer-supplied catch-up is trusted.

## Opt-in integration checkpoint

Uncommitted --profiles boot now creates an empty UUID profile without touching legacy storage, owns all preload IPC through generation envelopes, drains foreground requests before rebinding caches, and exposes create/switch in Settings. Initial real Electron test passes same-slug local docs, A draft restoration, stale snapshot refusal and legacy untouched. First UI test failed on hidden sidebar Settings selector; keyboard shortcut fixed the test. Next expected newline assertion corrected to compare normalized Markdown. An initial missing renderer function brace caused build failure and was fixed; current build passes. Shutdown now cancels captured profile runs, awaits driver finalization and releases pool before exit. Imported E0010e2feca/228a008 and C00715c0273/24e1bc3/34b17ce preserving all test scripts. More integration validation and visuals remain; no cycle closure.

## Integration validation checkpoint

Full desktop suite passed (all unit suites and76Electron checks, direct-edit/history/side-chat suites, profile UI). Subsequent focused profile service/repository/gate and real Electron profile UI reruns pass after finalization and web-session changes. Verified main UUID binds each webview partition; actual same-URL localStorage/cookies are empty in B and restored in A. Settings creates and switches empty profiles, app-wide appearance is separate, terminals stop on switch and late output carries owner. Preload requests carry a fixed captured generation, state snapshots also carry owner, and main accepts IPC only from its main frame. Renderer transcript events use acknowledged assistant identity and sequence to avoid duplicate replay after reload. No live dual Paper profile evidence or C006 screenshots yet. Next: integrate goal service prerequisites, test actual3worker UI persistence plus Paper guard, then final source/visual/evidence closeout.
