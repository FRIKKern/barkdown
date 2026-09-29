# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 small things: all 46 compared entries are pixel-identical to the previous approved run. The one renderer change is the wording of a toast while the library is away, which the fixture tours do not reach; its earlier wording was seen in the database rehearsal (03) and the new one is covered by a unit test.

Source commit: c0197f713875d7b7f36f0145fdec526b66591b66; review: docs/visual/reviews/approval-7d09916551fa9cad60442e4451169e41059b0000454b60b7c1afe910894663f7.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T22-17-35-446Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T22-17-35-446Z/adoption.gif)

