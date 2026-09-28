# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, macOS host). Recapture after narrowing pixel inputs to renderer, shared, build, dependencies and the capture harness. Compared 40 frames against the darwin baseline of the same day: max changed-pixel ratio 0.0000025, no geometry change, no new or removed coverage. Behavior evidence: owned-process unit and live tours, evidence/C084/checks-02.

Source commit: 6430ab9b40fd2453cf8d5d1ca9b559df2672941f; review: docs/visual/reviews/approval-8e4e4c34083781d02ca0501c4a82e9ed6e7dfdc87e9d0c638512d1d3d51cceb1.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/workspace-4.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/chat-4.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/documents-2.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/documents.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/settings-3.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/goals-8.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/profiles-3.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-28T20-31-38-545Z/adoption-5.png)

![Recorded interaction](runs/2026-09-28T20-31-38-545Z/adoption.gif)

