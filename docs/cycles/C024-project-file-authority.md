# C024 — Exact project file authority

Root-owned isolated codex/project-file-authority-12h from da9bb2e. Read AGENTS, active handoff/plan/A1 and design decisions; preserve per-chat folders and unsaved human text. No shared UI or real data used.

## Reproduction

At original project.js, actual headless Chromium + bundled real mountProject/CodeMirror + main/files.js reproduced: edit a.md, attempt missing.md (read fails), click Save. missing.md was created with A unsaved human text, while a.md retained original. Retained disposable m21t4M and baseline JSON; this is actual file-write evidence, not source inference. No Electron claim.

## Implementation

Navigation clears editable authority while loading/unavailable, keeps buffers in memory, and ignores stale read completions. Save captures root/file/buffer/text before awaiting, only acknowledges those bytes, and refuses duplicate in-flight saves. Newer typing stays dirty. Declining a conflict does not adopt the external mtime. Missing folder roots report errors rather than an empty successful tree. Stale tree reads cannot render into a newer navigation.

Headless Chromium tests pass failed-open/no-wrong-write, draft restoration, delayed acknowledgement with newer typing and navigation, stale read completion, and repeated declined conflict. Global dirty-buffer regression passes. Root npm ci (0 audit vulnerabilities), app npm ci (2 existing high) and Playwright Chromium install passed; no forced upgrades.

## Remaining

Add actual Electron proof and snapshots/GIF including unavailable-file state and returning to preserved draft; exercise delayed save through actual IPC. Source checkpoint must precede capture. Full desktop, deterministic comparison/review, isolated live Paper and root verify remain pending. Do not import into the validated integration candidate until reviewed. No production retry, autosave, profile migration or persistent unsaved-buffer claim.


Independent current-cycle review ran the focused test and found no blocker in captured read/save identity. It highlighted cached deleted-file semantics: now a missing previously opened file requires explicit Recreate; Cancel retains draft without creating it. A missing working-folder root is never silently recreated by Save. Descendant unreadable folders still use the existing empty-branch policy; broader filesystem accessibility remains outside this slice. Literal existing NUL in files.js was represented as equivalent escaped \0 so source remains reviewable.

Actual Electron fixture project-file-authority.live.mjs is prepared/syntax-checked, not run: seven scenes, missing-file authority, real disk write with delayed IPC acknowledgement, newer typing and B preservation, explicit recreation refusal, narrow error state. It uses only disposable files and a timing barrier around the real writer, not a fabricated save. Await named window after existing lanes.

Unavailable/binary views now offer a Return to previous file button for the same working folder. The headless regression uses this actual control to recover the retained draft; it does not require programmatic path navigation. Error text and recovery-button paths wrap in narrow panes. Actual Electron fixture updated to exercise the control; source-bound live proof still pending.

Independent next-cycle review found shared file/tree request generation discarded the initial sibling tree when the selected file was missing or binary. Successful file opens already request a replacement tree, so ordinary successful mount was unaffected. Controlled real-files tree response after failed initial read reproduced zero b.md rows instead of one on20d6819 (temporary2zpRWm). Tree request generations are now independent from file reads while still checking root/destroyed ownership. Regression retains real CodeMirror/file adapter and exact reachable sibling assertion. Actual UI evidence remains pending.

Second independent review exposed pending-save profile admission: Revert or typing the prior saved text makes draft equal saved while a write is awaiting acknowledgement. Actual CodeMirror/realfiles regression reproduced dirtyCount0 instead of1 (temporarysP87JV). Pending saves now count in the existing global/exact-folder dirty guard, Revert is disabled during save, and refresh cannot discard an in-flight buffer. Notifications settle after acknowledgement. Junction-based physical path escape is a separately reproduced pre-existing files adapter limitation; C024 makes no physical-confinement claim.

Source16a2f33 independently re-reviewed by next-cycle agent; focused headless real-files/CodeMirror regression passed at temporaryrgiuXs. No additional blocker found. Actual Electron capture still awaits named window after C020/C022; no live/runtime launched.
