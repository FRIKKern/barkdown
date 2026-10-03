# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). Terminal theme colours changed (plain hex for both themes); the visual run has no terminal frame, so the proof is the tour's light and dark frames in docs/cycles/evidence/C090/live. The three differing frames are a single cursor pixel each.

Source commit: 26a92d5e41c07add82c371d8d69a2e64f187059d; review: docs/visual/reviews/approval-2b15e05c34eb677a4635db9d53e2db548410adc431b564d9fcf740c111ff0b9d.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/workspace-4.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/chat-4.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/documents-2.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/retained-4.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/settings-4.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/goals-8.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/profiles-3.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-03T23-05-14-018Z/adoption-5.png)

![Recorded interaction](runs/2026-10-03T23-05-14-018Z/adoption.gif)

