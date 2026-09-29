# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 recovery slice: all 46 compared entries are pixel-identical to the previous approved run. The one renderer change is the text of the preparation notice when a preparation stops, which the fixture tours do not reach; the interrupted-switch notice and the completed switch were inspected in the live rehearsal (runtime-recovery 01 and 02).

Source commit: 2961aa4e6003cfef549e9431236e6c83bc9276f6; review: docs/visual/reviews/approval-70a231b7dbde178811e759b698d141e5648f04bc6b2d5652ec05be0b093c1f56.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T14-55-15-425Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T14-55-15-425Z/adoption.gif)

