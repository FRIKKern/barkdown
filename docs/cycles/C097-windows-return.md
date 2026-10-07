# C097 — Windows return

Status: active; P2/A2 unaccepted. Owner: Codex Windows return. Phase: integrating.

## Outcome and proof

Current bounded outcome: correct the coordinator native test's shutdown acknowledgement wait. Source9a74a3af is frozen. The45-minute review/repair budget began20:20 UTC. [Review](evidence/C097/coordinator-ack-review.md) retains the hosted busy-state failure, late completion and controlled reproduction. This is a harness correction; production verifier, UI and deadlines are unchanged. No retry or new product scope.

Healthy Node22.13.1/npm11.5.2/Electron44.5.1 and locked dependencies reused; native runs serialized. Controlled35-second IPC delay preserves the original handler and actual verifier: original failure50.249s, corrected replay73.486s with36.277s acknowledgement. Ordinary crash/restart/review/retry passes40.751s; both successful journeys retain eight stopped receipts. All21 commands from the failing recovery journey onward pass250.957s aggregate. Terminal passes112.204s with five stopped receipts. This is segmented Desktop validation, with five existing full-chain skips; the reason hosted native verification took longer remains unconfirmed.

Actual image review:28 coordinator hosted/before/after/native, seven terminal pages and11 Original history frames. Failure/busy and390px completion also inspected full size. [Capture28](evidence/C097/capture-28/result.json) at9a74a3af passes121.028s/30.717s/9.852s. All44 standard stills/differences/motion, five Paper stills and37 GIF frames reviewed, plus enlarged Settings/390px Goals/Paper29/36. Only temporary Settings path differs, geometry unchanged; [explicit approval](evidence/C097/review-coordinator-ack.json). Existing root demo remains applicable. Private real Paper uses a labeled sample transcript; light fixtures retain theme/contrast coverage. Retention23 executed recoverably; do not repeat. Root verification 41 passed in 52.127s ([result](evidence/C097/verify-41/result.json)).

## Integration

Published `f190e831`: hosted Verify 37683909132 passed; Desktop 37683909282 remains in progress. Exact metadata and raw Verify log are retained. The earlier Desktop25 failure remains evidence of the repaired wait, not an explained native latency cause. No production source changed during integration review. The additional synthetic rejection probe failed as intended in 18.874s at the visible-error assertion: no review form, disabled Resume, one request and one interrupted attempt without stoppedAt. Its action settled in 42ms. All four light fixture images were inspected for comparison with prior recovery failures. [Negative-path review](evidence/C097/coordinator-ack-rejected-review.json).

The [source review](evidence/C097/coordinator-ack-integration-review.json) preserves native identity/job checks, stale-owner refusal and explicit review. Production verifier timeout/cleanup is separate future work; a permanently stalled helper can leave the view busy. No such hang was manufactured or fixed here. Root verification 42 passed in 51.996s; commit this evidence locally, then wait for the current Desktop result before pushing. Consolidate later CI results in the local publication receipt/PR description to avoid another evidence-only push.

Repository truth review keeps README, plan, validation, source and evidence aligned; no acceptance or merge claim. Source/doc whitespace check passes excluding raw logs and the three exact executed diagnostic probes, whose retained trailing spaces are not edited after execution. No native process remains. Implementation-ready checkpoint is the successful delayed/ordinary/resumed runner; merged timestamp unavailable. Lesson: wait for an asynchronous native action to settle before checking its resulting view, within an explicit stage budget, and fail on an actual error; this contract is recorded in the app guide. No measured token count is available.

## Limits and hygiene

No merge or deployment authorization, including Mac nightly pickup. No real libraries, Mac export or new real-provider attempts. Real-library A2, cross-machine transfer, Windows provider continuity, installation, media/writer reconciliation, backend-drain recovery and G2 remain open. Estimate reviewed unchanged495/(495+156),about75%,30–90%,low confidence: validation repair adds no completed migration scope.

[Inventory27](evidence/C097/repository-closeout-27.json) and bounded related-task inventory retain main plus one lane,46 Barkdown worktrees(43 locked),14 sibling worktrees(7 locked). Runtime944a57a1 is clean; sibling68412eff with its five untracked files untouched. Cleanup owner cycle maintainer; review after integration, preserve unique/locked work. Deadline8 October04:25:45 UTC.

Publication readback will be retained locally at `.git/pr75-coordinator-ack-publication.json`; the next heartbeat must inspect that file and current PR head/checks before acting. Avoid a wording-only push that cancels CI.

The additional rejection proof used a 10-minute ceiling beginning 20:58 UTC and finished its assertions/image review at 20:59 UTC. Raw failure remains unchanged. Environment prerequisite: `BARKDOWN_TEST_COORDINATOR_CRASH=1`. Root verification 42 passes in 51.996s; current app visual proof remains capture 28.
