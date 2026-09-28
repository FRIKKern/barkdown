# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). Recapture after input-only changes: app/package.json npm scripts (now excluded from the fingerprint), the isolated harness's write-admission opt-in, and the visual tooling's ls-files buffer. No renderer or dependency change. All 40 frames within tolerance against the 2026-09-28T20-36-00 darwin baseline; workspace/dismiss differs by two anti-aliased pixels at the send button (diff inspected). Sampled stills inspected: Shortcuts (Mac labels), dark document view, workspace default. Behavior evidence: unit chain green on this host; hold, sealed comparison and selection rehearsals live on this host (C083 evidence). Limits: darwin only; win32 baseline stays stale until the Windows return checkpoint.

Source commit: 2821ea46108bb3b3f2446e4a7d33a066b9c90d6e; review: docs/visual/reviews/approval-2c1157741a3642c1d1301e79b611e7d2d9434b3929af2b92bab0bab31bec52d4.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/workspace-4.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/chat-4.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/documents-2.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/documents.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/settings-3.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/goals-8.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/profiles-3.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-28T22-04-21-807Z/adoption-5.png)

![Recorded interaction](runs/2026-09-28T22-04-21-807Z/adoption.gif)

