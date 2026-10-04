# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). The Ghostty engine is removed: Settings › General loses the Terminal row and returns to its layout before C090 (settings: general reviewed; the four profiles frames show the same dialog). Settings › Shortcuts lists the terminal's real keys below the fold of its frame, read from the page instead. One cursor pixel differs in chat: ready.

Source commit: 3e0e2db275b4df34945f937611945fdbec32fa8f; review: docs/visual/reviews/approval-da3591c1ce8e83257e641278c323c506d351f30da5597d6f4248976073713164.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/workspace-4.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/chat-4.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/documents-2.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/retained-4.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/settings-4.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/goals-8.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/profiles-3.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-04T09-24-23-556Z/adoption-5.png)

![Recorded interaction](runs/2026-10-04T09-24-23-556Z/adoption.gif)

