# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-10-08T12-55-29-276Z/README.md).

Reviewed by Codex Windows. Reviewed all44 fixture frames, all37 lossless and37 encoded live editing frames, five live stills, Settings before/after/diff, narrow profiles and Score selection; dark default, light contrast comparison. Sole fixture difference is random temporary CLI path (0.00021499), geometry/environment unchanged. Separate packaged terminal wide/narrow images and real restart/zero-active quit passed; native OS-only PATH fallback and ownership regression passed. Live source capture serves0.2.26.5027; it is distinct from the carried production package. Full Desktop and root checks remain pending. No installer, Mac transfer or A2/A3/A5 acceptance.

Source commit: 78a885f67a365ae3a0186b350fea070d34076961; platform: win32; Electron: 44.5.1. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-10-08T12-55-29-276Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-10-08T12-55-29-276Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-10-08T12-55-29-276Z/side-chat.gif)

## [documents](documents/README.md)

![Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.](runs/2026-10-08T12-55-29-276Z/documents.gif)

## [retained](retained/README.md)

![After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.](runs/2026-10-08T12-55-29-276Z/retained.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-10-08T12-55-29-276Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-10-08T12-55-29-276Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-10-08T12-55-29-276Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-10-08T12-55-29-276Z/adoption.gif)

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
- [migration-workspace](migration/README.md): actual-projected-Pages-favorites-sidechat-paths-and-restart; C080-managed-local-Archive-and-owner-refusal.
- [paper-catalog](catalog/README.md): actual-private-Paper-201-note-discovery-failure-retry-and-restart.
- [paper-connection](paper-connection/README.md): native-open-Paper-foreign-connection-refusal-original-retry-CLI-restart.
- [paper-evidence](paper-evidence/README.md): native-fresh-foreign-binding-readonly-legacy-evidence-and-original-HTTP-CLI-Undo-restart.
- [paper-navigation](paper-navigation/README.md): native-saved-same-slug-tabs-favorites-Pages-foreign-refusal-and-restart.
- [paper-archive](paper-archive/README.md): native-managed-profiles-and-manual-loopback.
- [paper-notes](paper-notes/README.md): native-managed-local-empty-note-typing-search-and-profile-restart.
- [agent-notes](agent-notes/README.md): native-managed-agent-create-body-edit-Undo-profile-restart.
- [paper-deletions](paper-deletions/README.md): private-real-runtime-native-restart-and-copy.
- [original-history](original-history/README.md): actual-Electron-profile-owned-backup-reader-refusal-and-restart.
- [writer-fence](writer-fence/README.md): actual-Electron-managed-Paper-quiescence-refusal-and-original-history-restart.
- [profile-preparation](profile-preparation/README.md): actual-Electron-profile-preparation-cancel-retained-drafts-and-restart.
- [editor-shortcuts](editor-shortcuts/README.md): native-Electron-keyboard-and-private-Paper-save-reload.
- [quit-backend](quit-backend/README.md): actual-electron-with-controlled-driver-cleanup-failure.
- [quit-admission](quit-admission/README.md): actual-electron-send-and-quit-with-controlled-environment-wait.
