# C046 — Verified subset; inline-break gate remains blocked

`codex/p2-migration`, draft [PR #32](https://github.com/FRIKKern/barkdown/pull/32). Nine permitted migrated cases are verified; the original ten-case acceptance is **not complete**. No real-library write, authority switch, merge or deployment occurred. The autonomous run continued beyond its two-hour minimum of 2026-09-23 21:43:38 UTC.

## What changed and passed

- `4b7a25d` corrects production code language to Paper's native `lang` carrier; legacy Markdown export compatibility remains.
- `2b64534` refuses hardBreak and literal inline CR/LF after real native-input proof exposed an upstream serializer boundary. Exact source and backup remain readable; code-block newlines remain supported.
- `fe8696c` wraps long Paper titles in normal/narrow panes, preserving single-line stored values, IME Enter, dirty/save ownership and retry/discard.
- The real server-supplied Paper rehearsal at `fe8696c` passes all nine permitted cases: keyboard edits, exact saved Undo, server equality, reload and Electron restart. Source, backup and workspace bytes stay identical. [Media, failure trace and review](../visual/migration/README.md).
- Full `npm --prefix app test` passes, including seven preflight and 22 staging tests; one existing POSIX-only authentication check skips on Windows. Paper-host and converter checks pass.
- `npm run verify` passes after correcting the cycle's checkpoint field from an ISO timestamp to its required date format. Earlier freshness/date failures are retained in [results and logs](evidence/C046/results.json).

Final live evidence uses clean source `68fbdf5` / private Barkpark `844ecd321`; five stills and all 37 GIF frames were inspected after a real Claude edit. The final 40-frame fixture tour reports no threshold/geometry changes. Forty-four of 48 media files exactly match the preceding fully inspected tour; the changed side-chat sequence was inspected again. Migration review inspected 14 stills, 51 GIF frames and eight restart video samples. All 83 retained migration artifact hashes verified. Named visual approval and source hashes are linked from the results.

## Exact continuation

Register/claim an upstream task for native inline-break support before implementation. The retained trace shows Chromium replaces the embedded newline with a PM hardBreak during actual typing; Paper's boundary rejects it because serialization would lose it. A later valid transaction can clear its notice. Do not simply remove that guard. Prove native DOM input, structured serialization, saved Undo and reopen before allowing the tenth case in preflight. Keep media, internal links, reference-map activation and rollback as subsequent unproved A2 gates.

Reproduce the supported editor subset from this worktree with `BARKDOWN_TEST_BP_SOURCE=C:/Users/Frikk/.codex/worktrees/barkpark-paper-create` and `npm --prefix app run test:migration-editor:isolated`. Commit source first; follow live then deterministic captures, inspect images/motion and explicitly approve. Dependencies and Playwright are installed here. Use only disposable data and retain failed evidence.

## Repository and process state

Barkdown has main plus this delivery branch. Upstream has main plus three delivery branches; no new branch was added in this cycle. The create-only source remains clean at `844ecd321`, branch `codex/paper-create-only`, stacked draft [PR #20020](https://github.com/FRIKKern/barkpark/pull/20020). Its canonical Guerrilla task is `task-0974164b66eea275`, worker `codex-barkdown-c044` (pulse epoch 6 during closeout); use explicit `bp -s Guerrilla`, never change the user's default server. The route is unmerged, with separate upstream CI failures.

The Linux full matrix at `962a28e` was 19/20 due to a tablehead alignment-click timeout. [Targeted rerun](https://github.com/FRIKKern/barkdown/actions/runs/35920198439) passed; the original log, report and screenshot are retained in C046 evidence. New push CI must be checked independently; the targeted retry is not a full-matrix pass.

All owned private capture runtimes stopped and the final desktop suite exited. Shared services, the user's app and original libraries were preserved. This handoff accompanies the reviewed evidence commit; verify remote head/CI before further work. C046 stays blocked for the named tenth-case gate, P2 stays active, and no old acceptance record is promoted.

## Six-hour continuation, 2026-09-23 22:17 UTC

The user authorized autonomous work through at least 2026-09-24 04:17:20 UTC (06:17 Paris). The active goal and twenty-minute heartbeat carry that deadline; finish the current bounded slice after the minimum. No merge or deployment is authorized by this run.

Fresh PR #32 CI at d2228c3 passes repository and visual checks, but Linux parity is 19/20: highlight row 3 fails, while tablehead is 6/6. Downloaded run 35924631718 artifacts are retained at C:/Users/Frikk/AppData/Local/Temp/c046-sixhour-ci-artifacts. Its highlight log shows the first End placed typing before the final `n.` of the wrapped paragraph; the later five-character selection is `rdsn.`, not `words`. Canvas and server agree. Next: make the probe select and assert its intended range, then run real parity again; do not waive the failure.

Upstream inline-break work is registered and claimed on Guerrilla as task-46160685b0b510c7, worker codex-barkdown-c046, epoch 1, initial lease through 23:05 UTC. Three criteria cover native input/marks, exact saved Undo/reopen, and preservation of other boundaries plus regression/evidence. Candidate serializer, boundary and mounted regressions are implemented in the claimed upstream lane. Editor dependencies installed successfully in barkpark-paper-create/api/assets/paper-editor. Reuse the controlled delivery lane, add code refs to the task, and keep claims renewed. The original create-only task remains separate. No owned test service is running.

Candidate checkpoint: highlight probe c144f5e passes all six real private-server rows after explicit range selection. The inline-break candidate passes mounted canvas/field paragraph, heading and list serialization/Undo checks. Barkdown candidate preflight admits LF/hardBreak and refuses unproved CR; all 29 preparation/staging tests pass. This is not yet ten-case real-editor acceptance. Upstream full editor regression is running; next commit the tested candidate and run the isolated native migration rehearsal. No real library or navigation authority changed.
