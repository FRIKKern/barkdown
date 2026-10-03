# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). Dependency input changed (app/package.json: npmRebuild off for node-pty's prebuilds); no UI change. The only differences are the sub-pixel cursor blink in four frames.

Source commit: d6209bb208c9df6e5e5becec883642c5c21d5f33; review: docs/visual/reviews/approval-91b1d9b9d2a95ce4f50eb982da8e9f45e822632f2b121e438010939f29a45321.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/workspace-4.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/chat-4.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/documents-2.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/retained-4.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/settings-4.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/goals-8.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/profiles-3.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-03T16-54-33-835Z/adoption-5.png)

![Recorded interaction](runs/2026-10-03T16-54-33-835Z/adoption.gif)

