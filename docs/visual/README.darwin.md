# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). Terminal polish (faint scrollback slider, Ghostty strip and click fixes, copy on select ignoring one character); the visual run has no terminal frame, so the proof is the tour frames on the Mac and the Windows runner. The one differing frame is a cursor pixel.

Source commit: 2c541667212a942a5b34cbd4595484faca2bd88f; review: docs/visual/reviews/approval-bd2dd16ad7f87340ff4d44f77f3ed20d08d5b06c9d05558d67b747073d40291a.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/workspace-4.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/chat-4.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/documents-2.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/retained-4.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/settings-4.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/goals-8.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/profiles-3.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-04T00-36-03-407Z/adoption-5.png)

![Recorded interaction](runs/2026-10-04T00-36-03-407Z/adoption.gif)

