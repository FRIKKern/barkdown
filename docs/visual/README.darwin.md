# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C092: main-process and prompt changes only (strictMcpConfig, the library default, the context note); no frame needs review and two differ by a single cursor pixel.

Source commit: f22c37370a5af340d5cef3652aa0ce4f25d05963; review: docs/visual/reviews/approval-88fe8cc4537f3e2c7e457ef3d487d6c174c84d33a763ebe9bb776f0f76292108.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/workspace-4.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/chat-2.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/documents-2.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/retained-4.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/settings-4.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/goals-8.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/profiles-3.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-04T11-19-05-738Z/adoption-5.png)

![Recorded interaction](runs/2026-10-04T11-19-05-738Z/adoption.gif)

