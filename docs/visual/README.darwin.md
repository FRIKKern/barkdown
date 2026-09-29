# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). New settings/library-switch frame: Settings › Barkpark scrolled to the Library switch row (status line, disabled Switch to Paper without an owned profile, Roll back hidden). A hidden-button style rule fixed the Roll back button showing through. All other frames within tolerance against the 2026-09-29T01-54-31 darwin baseline. Limits: darwin only; the actions are exercised by the live switch rehearsal, not the tour.

Source commit: fda7018f3edee3ced879a309718951aaac1baa01; review: docs/visual/reviews/approval-383bc553cb111fe91f280b87e977d9afffac43bc3dda13e164c5c272f2c80e61.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T02-02-28-073Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T02-02-28-073Z/adoption.gif)

