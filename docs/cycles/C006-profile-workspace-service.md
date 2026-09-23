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

## Goal integration checkpoint

Imported goal sources f9bc9e5/f0568b5/f99cb06/cde9794 with C006 cycle metadata and regression scripts preserved. Bound registration uses the same sender-checked profile generation envelope; goal journals remain in their own profile roots. Added Conversation goals palette action, saved worker-chat refresh preserving renderer drafts/navigation, and normal agent transcript delivery. All36goal tests pass; new actual Electron test creates/starts3workers, opens a worker during streaming, then switches B while A finishes durably. It uses deterministic API transport, not a paid/live model claim. Selected-B actual process restart test now preserves B draft/side-parent/tabs and separate persistent website storage. A session-only fixture cookie initially disappeared on process close as expected; test now uses explicit max-age for persistent-cookie assertion. Root verify found missing inherited goal evidence links (now immutable commit links) then expected stale status shots. New source-owned real Paper profile test planned before screenshot closeout; source slot requested, no live runtime currently held.

Real profile Paper proof passed at e2a3f67 in disposable bd-profile-paper-CetXTa: actual HTTP save remained owned by A, Settings switch refused while pending, acknowledgement persisted then B selection stopped A. Five stills/GIF checkpoints inspected; New profile input native border prompted type=text consistency fix. Added narrow capture and deterministic profiles area for future tripwires. Workspace-refresh responses now reject older request order or chats changed by streaming/new prompt since request. Focused real Electron profile+goals tests pass after fix. Final source recapture follows; prior candidate remains retained.

Final dedicated Paper+profile recapture at clean b58a4e4 passed in bd-profile-paper-4XVJdz, six stills plus actual-step GIF; narrow Settings remains reachable without overlap. Subsequent review caught old snapshot sessions/deleted-chat edge: extracted managed-workspace merge guard now includes folder/provider/model/effort/session context and remembers prior membership. Delayed-response regression proves newer stream text, context reset, deleted chat, draft and new prompt survive while new staged workers appear. Dedicated Paper guard code is unchanged by this follow-up; retain clean b58 proof with explicit provenance and refresh final source status/visual gates.

## C006 closeout — opt-in profile workspaces

Source `168e31b` is the final tested implementation checkpoint. Full desktop validation passed all unit suites and 76 Electron checks, plus direct-edit, history, side-chat, profile UI, goal UI and actual three-worker profile integration. Dedicated tests prove same-slug isolation, cross-generation refusal, late A replies while B remains selected, exact assistant identity, process restart with B draft/side-parent/tabs, and persistent same-URL website storage isolation. Goal transport is deterministic; it is not three live paid model runs.

Final deterministic capture at `2026-09-21T23-29-02-248Z` contains 31 inspected frames and seven step GIFs. Existing 21 frames have zero changed pixels; ten profile/goal frames establish explicit new baselines. All were explicitly approved. Final status capture at clean `168e31b` contains five inspected live stills and all 37 reviewed GIF frames, with an actual successful Codex turn. Claude's weekly quota prevented that provider's turn. The isolated runtime T0Zj5h stopped normally. Dedicated real Paper switching proof remains correctly attributed to clean `b58a4e4`; all six frames reviewed and its private runtime stopped.

See [profile contract](../PROFILE-WORKSPACES.md), [live profile review](../visual/profiles/live-README.md), [final comparison](../visual/runs/2026-09-21T23-29-02-248Z/comparison.json) and [status manifest](../images/status/history/C006-168e31b.json). P1/A1 remain pending: default adoption/cutover, integrated cold-runtime migration and broader acceptance are separate work. Driver completion does not claim arbitrary OS descendant termination. No real library migration, merge or deployment occurred.

Truth review found an inherited layout mismatch: Settings/default/reset use 40% chat while D07/AGENTS specify 60%; no superseding decision was found. Correct and recapture in the next bounded UI slice. Next storage work is the explicit first-adoption bridge; boot must inspect its transaction journal before creating any empty registry and must hold a userData single-instance gate before writers.

Final closeout validation: root `npm run verify` passed source/build/type/local-link/plan/cycle/visual freshness and all concept/handoff checks. Final focused goal-service, managed-workspace, profile-service and workspace-repository tests passed (seven Node test groups, including four goal-service scenarios). `git diff --check` passed. C006 is closed as the bounded opt-in integration; broader P1 remains pending.
