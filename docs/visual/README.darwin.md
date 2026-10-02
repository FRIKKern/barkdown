# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C089 slice C: 44 frames within tolerance, 2 small anti-alias differences; the Browser pane's new controls are below the fixtures' captured viewport and the pause card appears only during an agent run.

Source commit: 042e87469f1ab5a8b1c199b326a6e18b11c93447; review: docs/visual/reviews/approval-c7a3b1dc51dd07caae3761cea9bac571713a78cebfa9fb65ad8d07ef68715e6b.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/workspace-4.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/chat-4.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/documents-2.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/retained-4.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/settings-4.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/goals-8.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/profiles-3.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-02T14-21-57-749Z/adoption-5.png)

![Recorded interaction](runs/2026-10-02T14-21-57-749Z/adoption.gif)

