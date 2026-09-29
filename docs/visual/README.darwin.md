# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 database death: all 46 compared entries are pixel-identical to the previous approved run. The two new states of a note (a save the library did not answer with the words kept, and a reopened note that says words were not saved) are not in the fixture tours; both were inspected in the live rehearsal (database-death 03 and 04): the notice sits above the title, reads as plain sentences, offers Retry and Discard or View retained drafts and Dismiss, no clipping.

Source commit: 3681cc29ab0d9233c801e0accac1d35490d92d68; review: docs/visual/reviews/approval-f9299b28f09ee9be149b9e2af2f722ff6b9a50ff44b0d24b4c35e15c596273bd.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T21-32-43-384Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T21-32-43-384Z/adoption.gif)

