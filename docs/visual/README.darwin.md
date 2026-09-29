# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 refusals and dismissal: all 46 compared entries are pixel-identical to the previous approved run. The refusal reasons were inspected in the live rehearsal (portable-ui 02b): five reasons as plain sentences, no internal code, readable in the toast stack.

Source commit: 614b4c7d84805150afd8de8565337c46adff35b7; review: docs/visual/reviews/approval-28f7742171c38145b4c7764d78738a629857370649b650830e8efa92d49fe7d5.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T13-56-30-158Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T13-56-30-158Z/adoption.gif)

