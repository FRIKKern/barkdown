# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C089 F4: replies now render through the shared converter; the fixtures' scripted replies (lists, bold, code) render identically — 44 within tolerance, 2 small anti-alias differences. Tables, task lists and nested lists are covered by the doc-html fixture test.

Source commit: b20a3032d9265cef40b924aeda780727b7044fd0; review: docs/visual/reviews/approval-bfe3e7c1260e391cb8bc6ed08476db7921d9b83a06aa65438f514fd5d84a10ba.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/workspace-4.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/chat-4.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/documents-2.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/retained-4.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/settings-4.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/goals-8.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/profiles-3.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-03T13-15-49-065Z/adoption-5.png)

![Recorded interaction](runs/2026-10-03T13-15-49-065Z/adoption.gif)

