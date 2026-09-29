# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). New interrupted frame in the retained area: the start-time notice for a library switch interrupted during replacement, with Resume switch and Roll back as its only actions, over the read-only legacy note. All other frames within tolerance against the 2026-09-28T22-23-42 darwin baseline (two-pixel anti-aliasing on send buttons). Settings › Barkpark's new Library switch row sits below the captured fold. Behavior evidence: migration-switch live rehearsal (prepare, backup, baseline, stage, select, rollback) on this host; documents-selection and migration-selection unit tests. Limits: darwin only; the notice's actions are not exercised in the tour.

Source commit: ec1f3ed4cdb8c3e7de7a423334747e8eed5b9c5a; review: docs/visual/reviews/approval-6f43f30edbb3574020317386672870e839c08fd394e38053c6c6de96323c7829.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/settings-3.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T01-42-22-602Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T01-42-22-602Z/adoption.gif)

