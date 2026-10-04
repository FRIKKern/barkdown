# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C093: the editor is upgraded to Barkpark 944a57a1e. Across the whole visual run only two frames differ beyond tolerance, settings: barkpark and settings: library-switch, both by the editor bundle's sha1 line in Settings (reviewed in settings: barkpark).

Source commit: 82fbb228bad479b71158afd7dcb8d7bf11b27c42; review: docs/visual/reviews/approval-8e8ef2e2420987cef270a9a625b29687a6417042d1fefc7323e76a16c6e597c9.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/workspace-4.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/chat-2.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/documents-2.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/retained-4.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/settings-4.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/goals-8.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/profiles-3.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-04T12-25-09-732Z/adoption-5.png)

![Recorded interaction](runs/2026-10-04T12-25-09-732Z/adoption.gif)

