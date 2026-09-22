# Integration review for the parallel run

This is a pending integration checklist, not passing evidence. The [run handoff](RUN-2026-09-22.md) owns lane status and the deadline. Integrate only reviewed source milestones on an isolated `codex/` branch; preserve each lane's evidence history and union of test commands. Do not merge to main or deploy during this run.

## Composition boundaries

| Owner | Supplies | Consumer |
|---|---|---|
| C003 registry | Validated profile UUID, bound store, backed-up adoption | C006 resolver; C007 runtime pool |
| C004 run ownership | Captured scope and connection, authoritative events, awaited driver cleanup | Ordinary chat and goal provider adapter |
| C006 workspace | Main-owned transcripts and generation-checked view saves | Renderer, ordinary runs, goal sink |
| C007 runtimes | Profile connection leases, foreground selection, owned shutdown | C006 resolver and run finalizer |
| C005 goals | Durable task attempts, bounded scheduling, full worker side chats | Trusted C006 resolver/sink and existing shared composer |
| E001/E002 Paper | Pending-save guards and real external-edit/human takeover | Profile switching and visible agent edits |

## Required combined scenarios

All scenarios use disposable user-data roots and owned runtimes. Record the combined source commit, commands, server provenance and actual outputs. A unit test or fixture screenshot cannot stand in for a live integration scenario.

1. **Foreground ownership:** create A/B with the same paper slug and distinct content/media. Start a run and leave a draft in A; switch to B, write its draft, then finish A. A's transcript, receipts and edits stay in A. B's text, reading position and model/folder choices remain unchanged. Restart restores B only.
2. **Stale renderer saves:** delay A's state save across the switch to B. Reject or apply it only to the captured A generation; never overwrite B. Repeat with a stale snapshot that omits newly created worker chats. Explicit deletion must remain possible without interpreting omission as deletion.
3. **Worker parity:** create a goal from a coordinator with folder/model choices and images. Three saved side chats inherit initial choices and retain parent references. Change one worker's folder/provider/model; it becomes independent and executes only with newly captured settings. Reopen after closing tabs/restarting. Exercise the same composer history, images, approvals and activity destinations as ordinary chats.
4. **Dispatch and review:** three independent assignments overlap. A fourth waits; a dependent task waits for reviewed evidence. Duplicate reservation cannot launch twice. A failed/offline worker cannot appear completed. Editing worker context after scheduling prevents stale dispatch. A human run in that worker chat prevents simultaneous worker dispatch.
5. **Pause, cancellation and uncertainty:** pause/deadline blocks new work; cancellation waits for actual provider finalization. Fail transcript persistence and driver finalization separately. Unknown termination retains ownership and blocks replay until trusted reconciliation. Restart with reserved/running attempts does not silently repeat external effects.
6. **Runtime failure boundaries:** run A while B starts and remains ready concurrently. Stop B without stopping A. Fail B startup and retain A selection. Fail A cleanup after B becomes authoritative and show committed B plus cleanup warning. Race two stale-lock recoverers and prove neither can take the other's lease.
7. **Paper takeover:** focus an idle real Paper, acknowledge an external agent edit, then immediately type. Preserve both server edit and human input, selection and scroll; no stale canvas submission under a newer revision. Repeat reduced motion and hidden-pane cases. A pending human save must guard profile switch as well as tab/chat closure.

## Evidence and closeout

Run the combined root verification and complete desktop suite, plus real scenarios above. Capture new profile and goal journeys rather than treating unchanged legacy fixture frames as feature coverage. Inspect intermediate motion frames, narrow layouts, keyboard focus, ownership labels and recovery messages; maintain area README links/changelogs. Commit implementation before live capture, then reviewed evidence separately.

At the time limit, report each scenario as proved, failed or untested with artifacts and next actions. Keep P1 and the goal feature unfinished if combined evidence is incomplete. Upstream editor release gates and cross-machine portability remain separate claims.

## Additional review gates from live findings

8. **Existing workspace authority:** C010 must combine shell and cold-runtime adoption in a private candidate, then publish only to an absent final registry. Explicit invocation precedes ordinary boot/profile creation. Interrupt before/after the authority rename and rollback retirement; never seed an empty Personal profile after a partial transaction. Validate final attachment paths after relocation, retain all original/edited copies and refuse unknown writers. Existing C009 real proof covers runtime-only staging, not this combined gate.
9. **Native worker termination:** exercise actual child/grandchild trees, app/supervisor death, approvals pending during cancellation and restart reconciliation. Durable attempt identity must precede provider side effects. Verify zero owned processes before releasing execution ownership; do not treat a dead parent PID as sufficient. Authenticated three-worker proof must preserve folders, saved replies and coordinator draft, with committed source provenance.
10. **First edit receipt geometry:** capture the first receipt insertion, not only later edits when a receipt row already exists. The title/body and a focused person's reading position must not jump when target/select/write presentation finishes. Keep hidden/reduced-motion/IME cases and check actual server revisions; a clean final still cannot establish motion stability.

The reviewed C010 direction uses explicit `--adopt-legacy` invocation and a userData ownership guard; older binaries must be closed because they do not honor that new guard. Browser session migration and cross-machine credential portability remain separate. Root review also requires native bridge payload limits to preserve valid images/history and malformed protocol input to end in explicit failure/uncertainty.

Latest combined source82cc622 includes C012 workspace fail-closed/background ownership, E003 rich conversion/structured reads, C010 startup draft fix and C013 Windows credential-key durability. Full desktop65988 passed at466dfd9; rebuilt delayed-startup regression passes at7248ef8. Fresh full combined44785 and deterministic capture79913 running at82cc622 with source frozen. Existing approvals remain attributed to older source until actual image review. Integration push62697 timed out GitHub443; local checkpoints preserved, last remote b56f379. No root runtime currently owned.

C012 bounded evidence608fcb4/6c32880 passed full desktop, rootverify, actual3 recovery images and private statusEEulDl; runtime stopped. C014 ordinary-chat crash recovery now assigned next_cycle at82cc622 in isolated barkdown-chat-recovery worktree, starting with actual lifecycle audit. C010 real adoption40608/Mk5fgj owns a544, followed by its status, then C013 status, then root combined. E003 exact9424/8530 rich run passed real MCP read and five edit cases; stopped, motion review ongoing; editor source slot is free. C013 sourcef7d91e6 imported as82cc622 preserving adoption existing-only credentials and structured-import refusal; actual saved-key crash/restart tests passed in lane, combined gate pending. Nothing merged/deployed.

At82cc622 the complete combined desktop44785 passed, including actual saved Windows credentials after main-process death, invalid-key refusal and cross-profile pending saves. abbbcee records reviewed37-frame fixtures and unchanged original comparison baselines. Rootverify now correctly blocks only on old live status provenance; combined status remains queued behind C013.

Combined rich Paper55330/privateXP8A6P passed actual MCP read and five edit/save cases at cleanabbbcee with upstream8530a9e23, then stopped normally. Root reviewed ten stills,26 whole-video samples at1fps and42 table-transition samples at10fps; commit e877428 records hashes, original video, sampled GIF and health README. This is adapter/server proof without a model turn, not all rich authoring or release readiness. Editor source freeze released; E004 is implementing audited cell-level structured editing/export.

C010 actual40608/Mk5fgj and status51604/Dmsx79 passed and stopped. C013 now owns a544 slot; rootcombined next. C014 ordinary managed-chat crash recovery and C015 natural-language goal coordination share the owned-process adapter with distinct file ownership. C016 A1 evidence audit is assigned after C010 handoff. GitHub timed out earlier; local commits remain recoverable and a spaced push retry is in progress.

Latest integration8cabf36 is pushed, including original C010/C012 evidence and refreshed README/NEXT-AGENT/VALIDATION. Combined source82cc622 full desktop and rich proof are unchanged. Corrected an overly broad earlier API claim: remote structured Paper read/edit currently routes through MCP, not the API fallback's local-only agent tools; E005 is the proposed parity follow-up after E004.

Root now owns shared a544 source slot for status27672/privatepajcVS at clean8cabf36, using verified C:/Users/Frikk/Documents/GitHub/barkpark-editor (a5440345c, clean). An initial command pointed at a nonexistent worktree and failed source validation before starting any runtime; corrected path only, no source change. C01377034/DbndDW passed and stopped before this start. C016 is next after root explicitly releases the slot. E004 owns separate8530 private test runtime; C014 and C015 remain isolated source work.
