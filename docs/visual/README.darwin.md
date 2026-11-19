# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). macOS run 2026-11-19T19-23-21-158Z at 75b55024 (mention rules with main 6d739763) approved against 2026-11-19T17-45-16-451Z: 43 frames within tolerance; settings-0 (assistant) differs by 0.02% of pixels with no visible change in the diff image; mention changes are behaviour-only and draw nothing new

Source commit: 75b55024b18d6ee37418e7dabec22be3a53b5612; review: docs/visual/reviews/approval-0438de3bbb1f9407216f8f3b6ed056daa160a8722708e3474e30ff22304b49c1.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T19-23-21-158Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T19-23-21-158Z/adoption.gif)

