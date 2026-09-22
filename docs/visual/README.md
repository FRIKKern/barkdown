# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T03-49-51-339Z/README.md).

Reviewed by Codex root. C024: inspected all40 deterministic stills and40 GIF frames, menus, dark/light and narrow layouts. Against02-13 baseline39 stills pixel-identical; quick-open differs one RGB level at one pixel, all geometry unchanged. Actual Electron file recovery268d5df separately passed seven scenes and22 motion samples; full desktop passed0fe916c before final display-only wording fix. No migration or combined integration approval implied.

Source commit: 268d5df41ef91fc4e26124fd412177a53c2b4fd1; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T03-49-51-339Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T03-49-51-339Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T03-49-51-339Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T03-49-51-339Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T03-49-51-339Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T03-49-51-339Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T03-49-51-339Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-09-22T03-49-51-339Z/adoption.gif)

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
- [project-file-authority](project-file-authority/README.md): actual-electron-file-navigation-and-explicit-save.
