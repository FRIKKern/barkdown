# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Quit conflict banner, put-back safeguard: when the note moved on since the words were written, the notice says before the press that the newer text will be replaced and kept in Retained drafts; the press keeps it there first (no write if that fails), and a change while the notice is open reloads and asks again. On origin/main 72d5f135. Inspected run 2026-11-19T00-32-33-948Z against 2026-11-18T23-32-36-032Z: settings-assistant differs only in the random temp suffix of the command-line path; workspace narrow and side-chat draft differ by a few pixels, no geometry change. The tour has no quit conflict; the notice with and without the sentence, the reload toast and the View retained drafts toast are in app/tests/paper-quit-conflict.live.mjs pictures (real Electron, carried runtime 1482fb675). Limits: Windows not captured.

Source commit: b0611c839dd1542a09952d35cbd3d5689112599c; review: docs/visual/reviews/approval-583fc763ed9c4b4cb1939cb75eadd2fb2d8cd6ac657f3c5a70f9cf33b95405ec.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T00-32-33-948Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T00-32-33-948Z/adoption.gif)

