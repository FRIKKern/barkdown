# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. Picture retention: all 46 compared entries are pixel-identical to the previous approved run; the changed inputs are the capture and approval scripts, which now apply the retention rule. No renderer change.

Source commit: bf5e2285e79ca3ac41040279a8ffe675f266ba66; review: docs/visual/reviews/approval-3391a7e14ed0e5c1df4f0dc4d12ff19440c6c13277bedee031b25ee2890dcf49.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/workspace-4.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/chat-4.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/documents-2.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/retained-4.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/settings-4.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/goals-8.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/profiles-3.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-30T19-26-25-926Z/adoption-5.png)

![Recorded interaction](runs/2026-09-30T19-26-25-926Z/adoption.gif)

