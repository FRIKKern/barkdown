# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-24T09-00-59-893Z/README.md).

Reviewed by Codex. C059 source a11621d: inspected all40 candidate stills,40 difference images and40 decoded fixture GIF frames; comparisons and geometry unchanged. Also inspected5 live Paper stills and37 decoded live GIF frames (real Claude turn; tablehead6/6). Expanded native navigation9/45, retained-evidence11/58 and open-buffer9/48 still/GIF frames separately reviewed with actual restart and guarded Undo assertions. Full desktop and local20/20 parity pass. Existing fixture GIF modal-shadow palette banding remains; fixtures do not prove live provider motion. Unknown saved references remain preserved, never guessed.

Source commit: a11621d742ff3a9275cd01aa282ef0ff8e4aa176; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-24T09-00-59-893Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-24T09-00-59-893Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-24T09-00-59-893Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-24T09-00-59-893Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-24T09-00-59-893Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-24T09-00-59-893Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-24T09-00-59-893Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-09-24T09-00-59-893Z/adoption.gif)

## Dedicated journeys and remaining limits

The [Paper editor gallery](../images/status/manifest.json) records its own live server provenance. Dedicated journeys below retain their original source and review; this fixture approval does not restamp them or prove their remaining acceptance criteria. See each page for failures and coverage limits.

- [agent-takeover](agent-takeover/README.md): live-paper-agent-adapter-with-human-takeover.
- [rich-takeover](rich-takeover/README.md): live-paper-rich-content-takeover.
- [chat-recovery](chat-recovery/README.md): actual-electron-owned-job-crash-and-recovery.
- [paper-save](paper-save/README.md): live-paper-with-injected-transport-faults.
- [structured-table](structured-table/README.md): live-paper-MCP-structured-table-edits.
- [api-paper](api-paper/README.md): actual-API-SDK-and-live-Paper-with-scripted-model.
- [markdown-paste](markdown-paste/README.md): live-paper-Markdown-paste-native-history.
- [terminal-ownership](terminal-ownership/README.md): actual-electron-owned-terminal-switch-and-crash.
- [project-buffers](project-buffers/README.md): actual-CodeMirror-profile-switch-preservation.
- [native-rollback](native-rollback/README.md): actual-electron-owned-work-refusal-and-explicit-rollback.
- [html-table-paste](html-table-paste/README.md): live-paper-HTML-paste-native-history-and-keyboard-recovery.
- [coordinator-recovery](coordinator-recovery/README.md): actual-electron-coordinator-interruption-and-explicit-retry.
- [adoption-repeat](adoption-repeat/README.md): actual-Electron-cold-repeat-adoption-and-rollback.
- [project-file-authority](project-file-authority/README.md): actual-electron-file-navigation-and-explicit-save.
- [cache-integrity](cache-integrity/README.md): actual-electron-corrupt-cache-profile-switch-and-restart.
- [profile-isolation](profiles/isolation-runs/README.md): actual-Electron-two-runtime-late-edit-Undo-restart.
- [send-preservation](send-preservation/README.md): actual-Electron-managed-and-legacy-send-rejection-keyboard-recovery.
- [rich-clipboard](rich-clipboard/README.md): live-connected-Paper-3495-clipboard-recovery-and-image-upload.
- [upload-history](upload-history/README.md): live-connected-Paper-54579-upload-completion-native-Undo-Redo-save-reload.
- [missing-folder](missing-folder/69acbce/README.md): historical-C029-accepted-CLI-failure-before-C032-predispatch-refusal.
- [fallback-consumption](fallback-consumption/README.md): actual-vendored-Paper-upload-history-against-a544-and-54579.
- [folder-preflight](folder-preflight/README.md): actual-main-side-refusal-restart-and-selected-B-missing-reference.
- [paper-callouts](callouts/README.md): live-isolated-Paper-seven-tones-title-body-fold-reload.
- [provider-login](provider-login/README.md): actual-Electron-shared-login-lifecycle-with-controlled-process-and-SDK.
- [migration](migration/README.md): live-isolated-staged-Paper-keyboard-Undo-reload-Electron-restart.
- [migration-restore](migration/README.md): actual-Electron-restored-legacy-profile-history-drafts-media-save-restart.
- [migration-native-source](migration/README.md): actual-legacy-save-to-Paper-link-list-edit-Undo-navigation-restart.
- [migration-workspace](migration/README.md): actual-projected-Pages-favorites-sidechat-paths-and-restart.
- [paper-catalog](catalog/README.md): actual-private-Paper-201-note-discovery-failure-retry-and-restart.
- [paper-connection](paper-connection/README.md): native-open-Paper-foreign-connection-refusal-original-retry-CLI-restart.
- [paper-evidence](paper-evidence/README.md): native-fresh-foreign-binding-readonly-legacy-evidence-and-original-HTTP-CLI-Undo-restart.
- [paper-navigation](paper-navigation/README.md): native-saved-same-slug-tabs-favorites-Pages-foreign-refusal-and-restart.
