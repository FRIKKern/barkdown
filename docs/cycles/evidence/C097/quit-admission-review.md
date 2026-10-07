# Pending launch at quit

At source `5dc31fb9144c35b87fe41706afd829ebffbed10f`, the exact main quit handler can acknowledge exit while a profile launch that began before quit is still live. This is controlled orchestration evidence, not an observed Electron exit, provider failure, lost draft or native descendant leak.

The [first probe](quit-admission-01/result.json) fails one safety assertion and passes two controls in1.121s. It holds an existing provider completion while Windows environment hydration finishes. That existing-run arrangement is artificial during initial hydration, so it is insufficient by itself as an ordinary startup reproduction; its source and failure are retained.

The [refined probe](quit-admission-02/result.json) uses the actual terminal service's pending shutdown instead, and asserts the provider registry starts empty. It fails the same safety assertion and passes both controls in1.131s. The terminal service reads the inherited process PATH and does not await provider environment hydration, so its lifetime can overlap that first hydration. `main.js` starts hydration independently and does not await it before creating the window or releasing `bootBusy`.

| Case | Measured result |
|---|---|
| API-key launch, no local runtime lease, Windows environment wait finishes during terminal drain | One late run registers after the quit snapshot. Main invokes quit once while it remains live and uncancelled. No shutdown dialog. |
| Same wait with a local runtime lease | Main refuses quit because the actual runtime pool still has an active run lease. No runtime stop. The late run remains live; this is a protective refusal, not complete cancellation. |
| Device sign-in check pending when quit begins | Actual login service marks it cancelled, waits for its controlled host, and refuses even a late signed-in result. No provider launch occurs; quit succeeds. |

Every case reads back `Retained human draft` from the disposable workspace. The renderer also saves before dispatch and clears its submission draft only after launch acknowledgement (`conversation.js`), so these results do not establish lost input.

The refined harness uses actual profile registry/service, provider authentication, Windows environment hydrator, terminal service, device-login service, runtime pool, run registry and the exact extracted main handler. Registry-query children, terminal/login hosts, runtime driver and agent dispatch are controlled adapters. Renderer settlement is an accepted adapter reply. It exercises no real provider credentials, remote connection, Paper database, Electron process or OS-owned worker. All gates are released and fixture runs settled in `finally`; disposable directories remain for inspection. Source hashes accompany the review in [provenance](quit-admission-source.json).

## Repair boundary prepared

`profile-service.js` registers ordinary tickets before awaiting runtime/environment/authentication, but main quit only samples the global registered-run map. A session-scoped launch barrier must close admission before that snapshot, reject pending starts before reservation/dispatch, cancel any already-dispatching ticket when its identity arrives, and await its completion/lease release. It should retain failure across repeated shutdown requests. The existing durable migration `drainOrdinary` closure is not a substitute: it persists migration admission and requires reconciliation to reopen.

Integrate a profile-service shutdown with main's renderer-accepted phase, alongside login, terminal and GoalService shutdown. Do not close it when renderer settlement refuses. Audit goal callers of `profiles.resolve`, already-dispatched worker completion and legacy non-profile launch behavior before choosing the final API. Automatic reopening after backend failure remains a separate problem; no new retry guidance may imply recovery that does not exist.

Next bounded implementation needs normal owner tests for pending environment/authentication/runtime acquisition, delayed dispatch identity, repeated close and failed cleanup. Add actual Electron proof for the chosen production boundary, preserve draft/restart checks and renderer-refusal usability, then run adjacent tests, full Desktop, root verification and the required committed-source standard/private Paper captures and image review. Replay this retained diagnostic with expectations adjusted only where the intended new rejection replaces successful dispatch; retain these original failures unchanged.

No app, dependency or capture input changed in this review. Capture21 and native backend refusal evidence remain applicable to their existing scope. P2/A2, real-provider, real-library, Mac transfer and installer acceptance remain open. The working estimate remains495/(495+156), about75%, low confidence: the finding narrows existing shutdown uncertainty, not completed capability.

Root verification30 passes42.855s ([receipt](verify-30/result.json)). The expected diagnostic failure remains outside normal regression scripts until its repair adds normal owner coverage. Existing captures were not repeated because no app/capture inputs changed. Repository and relevant-task inventories22 preserve all existing worktrees; sibling checkout and runtime pin remain unchanged.
