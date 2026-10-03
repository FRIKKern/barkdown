# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). The terminal gains an 'Assistant ran' strip and loses the old output/form styles; the visual run has no terminal frame, so the strip is reviewed in the tour's 03-mirror frames (docs/cycles/evidence/C090/live). The differing frames are a cursor pixel each and a dozen pixels in settings: assistant, unrelated to this change.

Source commit: be728eaf8b20178b583f1e6438be93adf7499b1e; review: docs/visual/reviews/approval-a867fde6e2e49c2102978252df3f9ae84ecbd4b99b36f4641a3e3f415459ed55.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/workspace-4.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/chat-4.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/documents-2.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/retained-4.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/settings-4.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/goals-8.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/profiles-3.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-03T23-45-47-945Z/adoption-5.png)

![Recorded interaction](runs/2026-10-03T23-45-47-945Z/adoption.gif)

