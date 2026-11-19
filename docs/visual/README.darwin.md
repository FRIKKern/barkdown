# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Chat note review fixes merged with main 0ef9e19a (#150, #151). 44 steps: settings: assistant differs only in the random temp-folder name in the command-line path; quick-open and side-chat open/draft under 3e-6 changed pixels; all others within tolerance with no geometry change. Kept-request toasts are covered by tests/chat-menu.live.mjs shots 03b-03d.

Source commit: 31cabe8d8c96484bdd0cbd1cef83e3c42b57eb88; review: docs/visual/reviews/approval-e677c85ca77352604776f3d8a31487bb5cbb55d9478633e749dd4e13a0d27d2d.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T08-13-18-235Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T08-13-18-235Z/adoption.gif)

