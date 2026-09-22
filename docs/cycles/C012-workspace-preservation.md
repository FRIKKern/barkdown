# C012 — Missing workspace must not become an empty replacement

Status: active. Isolated branch codex/workspace-preservation-12h starts from combined56cc102. C010 helper/evidence remains clean on its original branch; central C008 queue is coordinator-owned.

## Bounded outcome

Prove a saved later profile B with chats, drafts and navigation cannot silently initialize empty when workspace.json is missing on restart. Preserve supported new profile creation by durably initializing its empty workspace before the profile becomes visible. Existing ambiguous old empty directories fail closed rather than guessing whether data was lost. No automatic repair, real user data changes, main/renderer edits, merge or deployment.

## Acceptance and test plan

Use disposable registry A/B with identical chat IDs and distinct drafts. In an actual child-process restart, move B workspace to a retained evidence path, load and attempt save; both must reject and no replacement may appear. A remains byte-identical. Repeat for corrupt/null/unsupported data. Fresh createProfile publishes a valid empty workspace and interrupted initialization/registry publication never exposes an uninitialized profile or creates duplicate visible profiles. Existing valid and adopted workspaces remain usable without rewrite.

Run targeted registry/repository/service/adoption suites and relevant Electron startup proof with disposable data, then full regression and required committed-source visual/live evidence workflow. Record aggregate verification truth. Ordinary interrupted non-goal attempts without reconciliation remain a separate followup, not included in this correction.

## Audit basis

At56cc102 workspace-repository.read uses readJson(workspace.json,null) || empty(). createProfile currently publishes only an empty profile directory. Missing previously saved workspace is therefore indistinguishable from first use. Main selected() reads with null fallback without requiring presence, and C010 marker checks its originally adopted UUID rather than every later profile. Reproducer precedes implementation.

## Reproduction and implementation checkpoint

Actual child-process restart reproduced the loss at56cc102: missing B returned an empty workspace and save wrote a replacement (retained fixture barkdown-workspace-preservation-BgfWEY). New profiles now durably initialize workspace.json before registry publication; repository reads never synthesize missing state. Four actual process exits around initialization/publication prove visible profiles are initialized and retry has only one visible result. Orphan prepublication directories remain retained evidence. Existing published creation-key retry never repairs a later missing file.

Service selection validates target and selected workspace before foreground operations, so missing/corrupt selected B uses the existing isolated startup recovery window with path/reason, restore guidance and Quit only. No main edits were needed. Failed runtime draft saves show an error toast and retain the text in the open composer. Old ambiguous empty profile directories require explicit recovery; they are never guessed pristine. Existing valid/adopted workspaces are not rewritten.

Targeted persistence/process checks passed atP3grcW; repository/service/IPC and registry24 plus composite authority16 process-exit suite passed. Actual Electron fixture zKO7o8 passed refused B selection with A draft intact, visible runtime-loss warning with unsaved draft retained, missing/corrupt B restart recovery, no replacements and original bytes unchanged. Three screenshots were inspected: no clipping; recovery path wraps and Quit is reachable. These precommit images are exploratory only; committed-source capture still required.

Locked root/app npm ci and Playwright Chromium setup completed. App install reports two existing high vulnerabilities; no dependency upgrade attempted in this scoped correction. Next: commit source, full combined regressions, committed-source evidence and root verification. C010 main runtime proof remains separate; no real library/runtime touched by C012.

Background ownership self-review found a coupling in foreground selected() validation: missing B could cancel A after A's event was saved. Event delivery now compares registry selected UUID only; A persistence continues to validate its own workspace. Focused service test removes B while A emits and finishes, verifies no cancellation and full saved A output, then restores retained B. Test passed kaGC7j. This is a followup source checkpoint; precursor visual run00-12-22 is retained unapproved and a fresh final capture will follow. Full combined regression was already running against6205 plus this focused service correction; exact provenance will be recorded.

## Committed-source evidence checkpoint

Final behavior source87ca623 (initial6205f72), dedicated coverage registrationba0aa59. Actual Electron committed-source fixtureMBDlw0 passed and three images are preserved at docs/visual/workspace-recovery/87ca623. Full combined npm run test:desktop session33157 passed all goal/ownership/backend suites,76 shell assertions, direct-edit/history/side-chat, profile website isolation, actual owned goal process jobs, C012 missing-workspace UI, sixteen authority exits and adoption/recovery UI. It started at6205f72 and loaded the focused87ca service correction later in the sequence; final service test was also run independently after the change. No source edits occurred after87ca.

Live Paper session97704 used clean87ca+a5440345c trees, actual server0.2.26.3877 on privateEEulDl, and a real Codex turn after Claude weekly limit. Five stills and every37 GIF frames inspected; slash target/type, table selection, quick-open and themes look intact. Runtime stopped normally, CLI unchanged, source slot released. Manifest retained as C012-87ca623 history. The showcase does not prove workspace-loss recovery; the dedicated Electron evidence does.

Final deterministic run2026-09-22T00-18-43-302Z includes the registered coverage map. All37 stills and37 frames in8 GIFs inspected: compared to prior reviewed00-14-30,41 of45 media files were SHA256-identical and the4 changed stills were viewed directly. Inherited60percent default explains side-chat/settings/reset-label changes from integration baseline; inherited goal controls and newly covered adoption states reviewed. Earlier runs00-12-22 and00-14-30 remain unapproved. Attempted approval before coverage-map recapture correctly failed; aggregate verify then stopped at visual freshness. No evidence was restamped or bypassed.

Repository truth review: README live images updated by the capture; app guide/product decisions unchanged; P1/ACCEPTANCE remains pending, central C008 queue left coordinator-owned. NEXT-AGENT and validation gain this bounded checkpoint. See C012-A1-AUDIT.md for remaining adoption, ordinary-chat crash and combined real Paper isolation gaps. Root verification after final approval is running; C012 remains active until it passes and evidence commits.

Final npm run verify session99136 passed (build, syntax/types, local links, roadmap/cycle checks, current visual/source hashes and all root concept/portable-preview tests). C012 bounded outcome is complete; P1 and C010 remain independently open. No owned processes remain. Next coordinator action: review/import6205f72+87ca623 into integration, preserving union test scripts and existing evidence; prioritize ordinary-chat forced-exit/reconciliation proof from the audit. Old ambiguous empty profile directories are deliberately blocked and require explicit original/backup restoration.

Staged diff check at evidence commit reports generated comparison README trailing blank lines (00-14-30 and00-18-43 runs). Reviewed artifacts remain immutable; these formatting warnings do not change the passed source/link/visual/behavior gates. Tracked source diff check passed before staging generated reports.
