# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Mention edges merged with main at 1d93f4ca (#148 import). Inspected run 2026-11-19T05-47-59-748Z against 2026-11-19T01-07-49-091Z: only settings-assistant differs, in the random temp suffix of the command-line path; no geometry change. The no-match picker step is in app/tests/note-mention.live.mjs (real Electron). Limits: Windows not captured.

Source commit: 2f41ee58bbad068829e27db5c50eab777d0d2437; review: docs/visual/reviews/approval-fb30f029409fca6b12b34f9df7ea37a7880eda05b5fb51cda281f2329faa9c40.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T05-47-59-748Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T05-47-59-748Z/adoption.gif)

