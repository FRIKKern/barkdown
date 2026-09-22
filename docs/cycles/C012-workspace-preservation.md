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
