# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 interruption handling and runtime reclaim: all 46 compared entries are pixel-identical to the previous approved run; the fixture tours do not reach the interrupted-export notice or the unfinished-import row. Those two states were inspected in the live rehearsal screenshots (docs/cycles/evidence/C085/live, portable-interrupt 01 and 03): notice text readable, one action offered, the Settings row aligned with its neighbours.

Source commit: e0621d07720055477e302cbc9501433404a31547; review: docs/visual/reviews/approval-433baacb1bfa34004e3c12d64a7f2dd6057f51e5019775da1b7287393b30c287.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T13-37-38-917Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T13-37-38-917Z/adoption.gif)

