# Carried Windows PTY resource observations

Actual carried ExPTY0.2.1 leaves observed BEAM resources after three natural terminal-child exits and explicit GenServer stops. [Final native run](pty-resources-native-02/result.json) passes 32052ms/13 checks; all three children, BEAM and its owned launcher are absent after normal eval exit. The final still-running BEAM sample retains401 handles/106 threads versus317/100 at baseline: +84 handles/+6 threads. This is a bounded resource observation, with no native repair or lifecycle acceptance.

| Phase | Elapsed ms | Process CPU ms | Logical processor equivalent | Handles after | Threads after |
|---|---:|---:|---:|---:|---:|
| baseline | 1602.447 | 93.750 | 0.0585 | 317 | 100 |
| exited-1 | 1457.704 | 0.000 | 0.0000 | 377 | 104 |
| exited-2 | 1560.422 | 171.875 | 0.1101 | 389 | 105 |
| exited-3 | 1401.566 | 0.000 | 0.0000 | 401 | 106 |
| wrappers-stopped | 1433.145 | 62.500 | 0.0436 | 401 | 106 |

Each measurement takes two identity-checked process samples around a1000ms wait. CPU uses the process CPU-tick delta over the monotonic interval; it includes other BEAM activity and observer overhead. It is not a whole-machine CPU percentage. CPU varies rather than showing sustained spinning in these short windows. First-child counts may include one-time loading/thread-pool costs; each later child adds12 handles and one thread in both runs. No handle type, thread stack, attribution to every individual allocation, long-run saturation or maximum is established. The final sample follows all three explicit OS PID absences and all wrapper stops while BEAM stays alive; counters remain401/106 at the final sample before eval shutdown.

[Initial native01](pty-resources-native-01/result.json) passes30274ms/12 checks with four samples, but its last sample precedes the last wrapper stop. The preserved [refinement producer](pty-resources-source-02/source/producer/c098-pty-resources-refine-02.mjs) adds a final stop/acknowledgment barrier; native02 is a distinct run, not a restamp. Both runs use fresh owned data/device/cache/cwd and system-only PATH. Actual child input readback and start/path/parent identities pass before each finish instruction; PID absence is checked before each exit sample. Both wrong-launcher and wrong-metric start identities refuse. These fixtures sample callbacks for500ms; the earlier [15second callback and kill-stub evidence](nif-review.md) retains its original timing. The child script intends exit23, but no child exit code is observed here. Wrapper stop and Job-owned eval shutdown do not prove native PTY teardown or Windows kill support.

[Independent review](pty-resources-review-01/review.json) passes247ms and compares25 frozen producer/source entries across both runs,32 unchanged source owners and nine pinned read-only caller/config/native inputs. Each actual ExPTY DLL path/hash corresponds to the carried package; module snapshots describe current disk bytes, not mapped memory, ABI/minimum or complete dynamic closure. The frozen source and private fixture folders remain retained.

## Caller and native source findings

At pinned upstream944a57a1, Studio TmuxConsole invokes its configured backend through apply/3, so a direct ExPTY.spawn text search misses the call. Config defaults to ExPTY/enabled; public-demo/admin controls remain separate. Its default command is tmux, start refuses a missing executable, and close invokes backend kill9 while returning :ok regardless of the backend result. TmuxLive forwards input/resize and calls close on termination. Barkdown's app terminal uses node-pty separately; these observations do not invalidate its prior packaged terminal proof. No Studio route or tmux was launched, and no exhaustive caller audit is claimed.

Pinned ExPTY Windows conpty.cc has an output ReadFile loop with no EOF/failure exit, a write-error return before mutex unlock, one thread-ID field reused for two native threads, and retained raw baton entries without observed removal. The Windows exit event schedules uv_async_send on the default loop, with no uv_run in this Windows source. Its exit message has two elements; the Elixir wrapper expects three. The callback frees the target PID and destroys the mutex without joining the reader; active close/handle cleanup is commented out. Windows wrapper kill is a stub. These are scoped source findings, not proof every source path executes or that the observed short CPU windows spin.

A callback-only patch is insufficient. A bounded repair needs owned lifetime management for pipes, pseudoconsole, process/wait handles, separate reader/writer threads and target PID; exactly one three-element exit notification; write-error unlock; and coordinated cancellation/drain/join before release. Required proof should cover natural exit, forced kill, wrapper death, failure during spawn/connect, repeated cycles and residual handle/thread counts while BEAM remains alive. Any actual implementation must run in an isolated source/build fixture, preserve sibling/accepted runtime and licenses, then undergo runtime integration/visual gates before adoption. This checkpoint makes no patch or console enablement.

## Delivery limits

Hosted36 on preceding4668cfa0: Desktop37841496305 and Verify37841496278 completed failure before steps for account billing; [raw review](hosted-driver-36/review.json) retains it. No retry/account change. PR76 remains draft awaiting its already-requested separate merge approval. Actual clean-machine proof needs a permitted disposable Windows environment; [guest management denial](guest-review.md) is unchanged. No server/database, real library/profile, credentials/provider, guest/service/feature/prerequisite/installer, accepted runtime or sibling mutation.

Estimated checkpoint ceiling60minutes, stopping at reviewed resource/caller evidence. Existing app/runtime/dependency/capture inputs are unchanged; root verification and byte applicability follow. Migration effort reviewed unchanged495/(495+156), about75%, scenarios46/156/980, low confidence: this P5 learning is outside the migration weights and adds no accepted user capability.

Frozen [root verification](pty-resources-verify-01/result.json) passes58110ms. [Applicability](pty-resources-applicability-01/review.json) passes9112ms with536app/6067source-package/32owners/EXE-ASAR/Windows8f45 unchanged. Existing GUI and full Desktop evidence retain their original time/scope; no fresh GUI, native repair, installer or stage acceptance.

[Indexed proof](pty-resources-indexed-bytes-01/result.json) verifies265 original raw files/464261 bytes and32 selected owners. [Repository inventory](pty-resources-indexed-bytes-01/repository-inventory.json) retains main plus one lane,46 worktrees/43 locked and unchanged siblings; no cleanup. [Closeout](pty-resources-review-01/closeout.json) separates measured wall time and whole-goal counter; final staged/committed readback follows.
