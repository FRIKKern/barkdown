# C097 — Windows return

Status: active; P2/A2 unaccepted. Owner: Codex Windows return. Phase: validating.

## Refuse corrupt interrupted-import journals

[Watchdog checkpoint](evidence/C097/quit-timer-closeout.md) is published at `4a14f091`; root50/capture34 pass. Verify 37715493464 passes; Desktop 37715493481 is running. Do not push again until its outcome is inspected. Earlier full hosted31 passes at `8863e703`; prior intermittent startup latency remains unexplained.

Independent review found a recovery defect: a corrupt or false-valued existing import journal is collapsed to missing by the generic store reader. `inspect` reports none, so `isIncomplete` permits selection. [Owner-function probes](evidence/C097/import-journal-before.json) reproduce six corrupt/false-valued cases, with valid/missing controls. [Native before](evidence/C097/import-journal-native-before/result.json) fails the refusal assertion: actual Electron selection succeeds and the selected registry identity changes. Both dark images reviewed; the empty screens alone do not prove identity, which the receipt records. No real content or runtime restore was involved.

Outcome: distinguish a genuinely absent journal from unreadable or malformed existing evidence; preserve that evidence and block selection. Limit the fix to `profile-import.inspect`, its regression tests and one actual native selection/restart proof. Missing ordinary profiles and valid imported profiles must remain selectable. Do not change generic store semantics, recovery/discard policy or initial import publication atomicity.

Budget: 45 minutes from 02:02 UTC. Healthy locked Node22.13.1/npm11.5.2/Electron44.5.1; no dependency change. No native suites concurrent. Affected owners: profile-import, profile-portable isIncomplete and main profiles:select. Cheap checks: malformed/falsey/schema/owner/directory/unreadable journal controls; existing import, portable and registry tests. Ready proof: actual Settings/IPC refusal, unchanged selected profile/journal, restart refusal and valid control; source commit, reviewed capture and root verify. Twelve candidate owner-function cases already pass outside production source.

[Acceptance](../ACCEPTANCE.md) remains open. No real-library mutation, Mac transfer, provider turn, merge or deployment. Capture30 proved one Claude turn; required new capture explicitly samples. Existing dark root demo remains applicable; light fixtures retain comparison purpose. Estimate unchanged 495/(495+156), about75%, low confidence: this is recovery repair, not accepted migration scope.

Inventory33/retention28 remain current: main+one lane, 46 worktrees/43 locked; sibling14/7 locked. Cycle maintainer reviews cleanup after integration, preserving unique and locked work. Recheck inventory at closeout. Current exact publication state is `.git/pr75-coordinator-ack-publication.json`. Deadline October8 04:25:45 UTC: finish safe checkpoint and pause heartbeat.

Repair applied. All 39 adjacent checks pass in6.207s; final native06 passes8.958s with three dark frames reviewed. [Review and retained harness failures](evidence/C097/import-journal-review.md). Commit source, then capture36, review/retention29/root51. Keep source/staging/HEAD frozen throughout capture. Inspect prior hosted outcome before one push.

Capture35 passed but was superseded before approval to include the new native screenshots in CI artifacts. Native06 verifies the final output path. No published source has changed during its running CI.
