# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Put-back safeguard merged with main at 1d93f4ca (#148 import). Inspected run 2026-11-19T01-48-42-961Z against 2026-11-19T01-07-49-091Z: only settings-assistant differs, in the random temp suffix of the command-line path; no geometry change. The quit-conflict notice is in app/tests/paper-quit-conflict.live.mjs pictures (real Electron). Limits: Windows not captured.

Source commit: 83247dc4a6ef456bcbec5b168b95ca854e12b58e; review: docs/visual/reviews/approval-eea626e91d53ef0729fb3622fe1ce5485e386334d0bffe24280e3814e576887f.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T01-48-42-961Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T01-48-42-961Z/adoption.gif)

