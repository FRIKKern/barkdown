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
