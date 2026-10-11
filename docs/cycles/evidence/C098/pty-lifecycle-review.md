# Isolated Windows ExPTY lifecycle repair

The private candidate now delivers natural exit callbacks, forced Windows termination, normal wrapper stop, owner-death cleanup and failed-process cleanup. [Final native12](pty-lifecycle-native-12/result.json) passes80.325seconds/24checks. After three natural children, forced9/15, two wrapper closures, an observed blocked writer and twenty alternating spawn/connect failures, all ten owned PIDs are absent. The still-running BEAM ends at316handles/99threads versus312/100 baseline. The accepted application, runtime and package remain unchanged; this is a tested prototype awaiting integration.

| Case | Actual proof |
|---|---|
| Three natural exits | Real nonce input,112×34 console geometry, code23/nil callbacks within5seconds, two closed writes and resize refuse |
| Windows kill9/15 | Unsupported signal2 refuses; exact137/9 and143/15 callbacks, closed writes/resize refuse |
| Wrapper normal stop/death | Actual GenServer stop or monitored :killed; each native child absent before sampling |
| Blocked write and owner death |32MiB writer observed twice100ms apart inside ExPTY.Nif.write; monitored wrapper kill settles its caller, native child disappears and no accumulating native threads observed |
| Failed spawn/connect | Ten missing executables return File not found; ten nonexistent working folders return Cannot create process; actual newly spawned wrapper PIDs traced and confirmed stopped |
| Identity and lifetime | Wrong launcher start, metric start, BEAM path and native resource caller refuse; physical DLL/BEAM identity/hash proven; duplicate callback guards wait500ms per child and at final close |

Children6–8 have no live wrapper to receive an exit callback or invoke closed APIs. Native09/11 incorrectly marked their closed-operations flag true; review caught it and native12 records false. Their OS absence and wrapper death are the applicable proof. No old receipt was corrected in place.

| Final phase | Handles | Threads | Process CPU ms | Sample interval ms |
|---|---:|---:|---:|---:|
| baseline | 312 | 100 | 109.375 | 1654.807 |
| exited-1 | 315 | 100 | 0.000 | 1560.879 |
| exited-2 | 315 | 100 | 62.500 | 1508.323 |
| exited-3 | 316 | 100 | 0.000 | 1522.288 |
| exited-4 | 316 | 100 | 46.875 | 1637.347 |
| exited-5 | 316 | 100 | 0.000 | 1647.259 |
| exited-6 | 316 | 100 | 0.000 | 1549.013 |
| exited-7 | 316 | 99 | 15.625 | 1467.241 |
| exited-8 | 316 | 99 | 0.000 | 1424.790 |
| failures-stopped | 316 | 99 | 31.250 | 1442.270 |
| wrappers-stopped | 316 | 99 | 0.000 | 1505.548 |

Counters are aggregate BEAM values, sampled twice with exact PID/start/path around a1000ms wait. CPU uses process ticks divided by monotonic elapsed time, not whole-machine utilization. Four additional handles persist, and thread counts vary between runs; their types and cause are unproven. This bounded sequence shows no per-child accumulation comparable to the [unchanged carried component](pty-resources-review.md), which ended401/106 versus317/100. It is not exhaustive leak freedom, saturation or an every-race guarantee. Earlier prototype08/09/11 pass36.114/58.455/72.543seconds with their original scope; native11 temporarily reaches102threads before ending99.

## Source and build review

[Source02](pty-lifecycle-source-02/inputs.json) replaces the raw baton with a monitored Erlang resource. Separate reader and exit workers retain native ownership through pipe draining, writer cancellation and reader join. The down callback sets atomic flags without acquiring an operation lock or touching handles that may close concurrently. Dirty writes use scoped locks and a retained native thread handle for cancellation; closed writes cannot keep the mutex locked. Exactly one worker sends the three-element exit tuple after closing operational handles. Wrapper connect failure closes the resource; failed outer spawn stops its GenServer. Windows terminate closes a connected resource. Public spawn still returns its GenServer PID; internal raw integer becomes a reference. Windows9 and15 both force termination;15 does not provide Unix graceful SIGTERM semantics.

The paired source02 input repair restores upstream standard-handle policy and retains console pipe ends through child creation. Source01 actually failed keyboard input; no single cause was isolated. Retaining then releasing these ends follows [Microsoft's session lifetime guidance](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session). The output reader drains on a separate thread during [ClosePseudoConsole](https://learn.microsoft.com/en-us/windows/console/closepseudoconsole), whose shutdown behavior differs before Windows11 24H2. These developer-host results on10.0.26200 do not prove older Windows or a product minimum.

The worker retains a native resource reference until its reader joins. Dirty-NIF caller death can trigger monitors without stopping native code, so native cancellation remains necessary; see [Erlang NIF lifetime documentation](https://www.erlang.org/docs/26/man/erl_nif.html). The reviewed semantics are reference material; compilation uses actual OTP28.5/ERTS16.4 headers, not that older documentation's toolchain. A cancellation/OS-close failure can retain the native worker indefinitely while close/1 reports its10second timeout. No forced memory release beneath a live reader is implemented. Cursor inheritance, WinPTY, ARM64, hot NIF replacement, child descendants, allocation exhaustion and all shutdown races remain untested.

[Build01](pty-lifecycle-build-01/proof.json) retains11.127second Release/1.270second wrapper compilation; [build02](pty-lifecycle-build-02/proof.json) retains14.180/1.294seconds. Both use MSVC14.50.35717, /MD /O2 /DNDEBUG and fixed libuv reuse. Compiler logs, source/header hashes, complete relevant original native sources, patches/diffs, license, artifacts and BEAMs remain. Original native credits and previous [attribution originals](nif-review.md) are preserved. The tested candidate DLL SHA256 is3f5c37e71e249a706134ab6deb5114c3221edfdf21009af5c27176eabbc848fb. Static imports/current disk snapshots do not establish ABI/minimum, full dynamic closure or complete redistribution approval.

Carried start_clean.boot preloads original ExPTY, so path prepending alone did not bind the candidate. A private Job capsule runs the carried ERTS with a private boot selecting only ExPTY code paths. [Independent term comparison](pty-lifecycle-boot-review-01/comparison.json) proves exactly two leaf paths differ and every other decoded term agrees; the original transformation's self-comparison was insufficient. Actual candidate DLL/BEAM binding is observed before each successful run. No accepted boot/runtime was changed, no sysconfig server bootstrap or Studio/tmux/GUI route was exercised, and Barkdown's node-pty terminal remains separate.

[Independent review](pty-lifecycle-review-01/review.json) passes634ms, compares99 frozen source entries,32 selected unchanged owners and the pinned read-only caller/native inputs. Initial native01–07 failures retain fixture syntax, semantic macro compilation, original preloaded module, path alias and input/JSON diagnoses; native03 cleanup observed an already-absent launcher before its JS exit event. Explicit absence now settles the same owned handle. Preparation10's layout assertion also remains. These are delivered diagnosis records, not hidden or relabeled native successes.

## Integration boundary

PR76 stays draft awaiting its already-requested separate merge approval. [Hosted37](hosted-driver-37/review.json), observed9October on4cb37380, records Desktop37844212246 and Verify37844212241 refusing before any steps for account billing; no retry or account change. The earlier launcher06 timeout and upstream matrix remain open. Clean-machine execution needs a permitted disposable Windows environment; [local management denial](guest-review.md) remains. No sibling, server/database, real library/profile, provider/credential, guest/service/feature, prerequisite installation or installer/release operation.

Runtime adoption requires an explicit new bounded integration checkpoint: licensed/source-bound Windows build overlay, fresh runtime and package, actual carried server lifecycle/failure proof, relevant full Desktop and reviewed visuals. A5, complete notices/source obligations, minimum/ABI/dynamic/prerequisite closure and clean install/update/rollback/uninstall remain open, followed by the owner's P2/P3 data-safety work. Missing real library and Mac export do not block isolated synthetic preparation; no transfer was fabricated.

Estimated120minute ceiling was exceeded across the overnight interruption and fixture/debugging work. Active-work breakdown is unavailable; closeout records measured wall time separately. Migration weights reviewed unchanged on9October:495/(495+156), about75%, optimistic/working/adverse46/156/980, low confidence. This P5 prototype is outside those six migration weights and adds no accepted migration capability.

[Final root verification](pty-lifecycle-verify-02/result.json) passes75581ms; [byte applicability](pty-lifecycle-applicability-01/review.json) passes13439ms, preserving536app/6067source-package/32owners/EXE-ASAR/Windows8f45. Initial root4086ms failed on a relocated partial Markdown snapshot; the exact bytes remain as .md.bin with its retention receipt and explanatory original route. No check/source was weakened. Final raw-index/committed readback follows.

[Indexed byte proof](pty-lifecycle-indexed-bytes-01/result.json) verifies1387original raw files/4833554bytes and32selected owners. [Repository inventory](pty-lifecycle-indexed-bytes-01/repository-inventory.json) retains main plus one lane,46worktrees/43locked and unchanged siblings; no cleanup. [Closeout](pty-lifecycle-review-01/closeout.json) separates measured wall time and the whole-goal counter, whose tracker currently reports blocked and does not measure resumed active work. Authorized work/deadline is retained; no goal completion or pause is claimed.
