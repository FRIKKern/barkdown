# C097 — Windows return

Status: active; P2/A2 unaccepted. Owner: Codex Windows return. Phase: integrating.

## Portability harness quit timer

[Startup checkpoint](evidence/C097/startup-timing-closeout.md) is published at8863e703. [Hosted31](evidence/C097/hosted-31-review.json): full Windows Desktop37711599045 and Verify37711599047 pass, five existing skips. All17 coordinator images reviewed; max launch-to-handshake3.573s and shutdown acknowledgement4.576s. The prior intermittent latency remains unexplained; diagnostics and failures stay retained.

Outcome: clear the losing90-second watchdog after app.close resolves or rejects in the local two-installation portability harness. The existing helper leaves a referenced timer; exact-source scaled probes reproduce that wait, and the prior native result-to-exit gap was89.032s. Reuse the already-proven finally/clearTimeout helper from paper-quit-during-save. No production behavior, deadline, test assertion or failure propagation changes. This harness is outside the hosted Desktop chain; no hosted speedup claim.

Budget:30minutes from01:44UTC. Stop after exact candidate/source match, native two-installation journey, source commit, required reviewed capture/root and one publication consolidating hosted31. Do not expand into a helper sweep. Affected boundary: app/tests/profile-portable-two-installs.live.mjs only, plus code-area documentation. Six candidate child-process cases already pass success, reject, synchronous throw, hang and late resolve/reject. Ready checkpoint requires four actual native checks, reviewed dark screenshots and measured post-result exit interval; keep any failure.

Preflight: healthy locked Windows Node22.13.1/npm11.5.2/Electron44.5.1; isolated pinned runtime944a57a1 unchanged. Serialize native suites. No real-library mutation, provider retry, Mac export, merge or deployment. Standard capture uses explicitly labeled sample transcript; capture30 separately proved one Claude turn. Existing dark README demo remains applicable to test-only cleanup; light fixture coverage retains comparison purpose.

Estimate unchanged495/(495+156), about75%, low confidence; no accepted migration scope added. Inventory33: main+one lane,46worktrees/43locked; sibling14/7locked. Cycle maintainer reviews cleanup after integration, preserving unique/locked work. Retention28 complete; do not rerun. Deadline8October04:25:45UTC then safe checkpoint and pause heartbeat. Current publication truth is .git/pr75-coordinator-ack-publication.json.

Checked candidate applied exactly; syntax/diff checks pass. Native proof quit-timer-native-01 passes four checks in326.807s, all four dark images reviewed. Result-to-runner-exit interval17.159ms versus89.032s before; this supports cleanup without claiming precise total time saved. [Review](evidence/C097/quit-timer-review.md). Source committed at 8873261f. Capture34 passes (Paper 97.335s, standard 26.807s, comparison 7.770s), all required frames reviewed and explicitly approved. [Review](evidence/C097/review-quit-timer.json). Root50 passes in 45.865s. Consolidate and publish this evidence once, then inspect resulting-head hosted checks before another source push. The exact published head and runs live in the local publication receipt; no merge authorization.
