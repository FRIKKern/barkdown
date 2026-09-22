# C029 — missing working-folder context

Base f3e67ac, codex/missing-folder-context-12h. C008 parent remains active.

Audit: profile-service resolves persisted chat.folder verbatim; agent.start adds current context every turn; Claude cwd and Codex workingDirectory use that path without filesystem fallback. Folder/provider changes clear native sessions in workspace-repository. API search root errors were corrected in e3fec49. Existing tests do not combine missing persisted B with provider SDK routing and restart.

Plan: use real stores/resolver/provider modules and controlled SDK seams to prove routing only; preserve unavailable selected folder and tool errors. Prepare actual Electron restart/reference/send fixture for later serialized grant, consuming C026 for failed-send preservation. No authentication policy change. No native provider execution or model claim from seams.

Dependencies: root npm ci passed; app npm ci passed with two inherited high audit findings (no force upgrades). No processes owned.

## Offline checkpoint

Ten routing tests pass through real profile registry/repository, resolver and provider modules, with explicitly controlled SDK seams. Missing/non-directory/null folders are preserved for API/Claude/Codex, including supplied resumed session options; fresh service handles restore selected B and draft. A folder change clears prior native sessions. No production change was needed. This is not native CLI execution proof or an actual process-restart proof.

Existing agent suite passes including real missing/non-directory/empty filesystem roots and controlled EACCES search denial. A real inaccessible Windows ACL has not been exercised. Root/app npm ci and Chromium install passed; fixture syntax passed. Root verify failed inherited global screenshot freshness (UI16a3b6085 vs capturee38038577); raw logs retained.

Prepared `app/tests/missing-folder-ui.live.mjs` is NOT RUN. It creates disposable A/B, process-restarts with missing B selected, opens same.txt to require explicit unavailability instead of A substitution, and optionally sends actual installed CLI turns using C029_NATIVE_PROVIDERS=claude,codex. It records real native errors and retained acknowledged user text; SDKs are not replaced. Authentication/login configuration is not modified. Native failures after accepted dispatch must preserve the user transcript; pre-ack failures must preserve unsent drafts and require C026 integration. The fixture presently tests accepted attempts only; do not claim C026 draft coverage from it.

Next: obtain named UI grant, consume reviewed C026 source as needed, commit source before running fixture; inspect native failure semantics without treating routing seams as execution. Then fresh deterministic/status/root gates as assigned. No owned app/runtime processes. C029 stays active.

## Combined source preparation

Merged reviewed integration2b2ec11 into this isolated lane, preserving C029 cycle/docs and tests. It includes C0265086bad send preservation and E009 evidence. Package script union verified programmatically: every integration command retained exactly (test command gains only C029 prefix), including C028 and E009.

Routing10/10 passed again; send-preservation.test, send-boundaries.test and legacy-send-preservation.test passed in JSDOM/Node. Desktop build passed. No actual UI/provider/runtime launch. Native C029 fixture remains unrun, queued after E010; pre-ack draft refusal and accepted asynchronous provider errors remain distinct. Source frozen for that grant.

## First native attempt retained

Session24359/source1e1bb50/vsA0ZD exited1 before providers. B folder/draft persisted, but fixture direct IPC seeding had not selected the chat in mounted renderer; normal close saved visible default-chat navigation. Failure screenshot inspected: No working folder, not A fallback. Corrected fixture binds seeded workspace to mounted renderer and uses normal switchChat, asserts current same before quit/restart. No production change. Owned Electron exited normally; no matching process remained. Original report/screenshot retained in evidence/C029-native-1e1bb50-failure.

Second fixture12700b6/FKpRBx stopped immediately: hand-constructed chat lacked renderer default arrays. No provider ran. Replaced setup with actual createChat factory and its returned IDs; assert visible folder/draft/current and no page errors before close. Retained original failure/report; no product defect claim.

## Actual native proof

Frozen69acbce, GGgmox: actual fixture exited0, selected-B process restart and missing-reference isolation passed; native Claude and Codex accepted then failed before model output. Exact errors retained in ../../visual/missing-folder/69acbce/report.json. User text persisted; same missing folder remained; driverFinished true. Both owned native Job receipts stopped/activeProcesses0. App normal close and no matching Electron processes; UI explicitly released for E011.

All three original screenshots reviewed full-size. No A file substitution, missing folder/draft visible; native errors readable. Claude’s diagnostic inaccurately suggests libc mismatch on Windows, a remaining error-quality limitation. Two earlier fixture setup failures remain original. No production behavior change. Real Windows ACL denial and successful native location response remain unproven.

Cycle evidence is ready for import; final combined gates remain pending and C029 is active. Next coordinator action: selectively import test/package union and exact native gallery, consume in final combined validation; do not overwrite C008 or current global approvals.
