# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 two installations and an earlier export into a later Barkdown: all 46 compared entries are pixel-identical to the previous approved run. The one renderer change is the import description in Settings, below the point where the fixture tours stop; it was read in the live rehearsal (two-installs 01, portable-ui 01). Inspected in the live rehearsals, all dark: the imported profile opened on the second installation with its conversation, Pages and the picture loaded (one pixel wide, a dot), and the refusal of another version naming both versions (portable-ui 02b).

Source commit: 169811e2756c19b3def637c0dc8b6eec2e3a8bde; review: docs/visual/reviews/approval-555f1a8d28a4ae8d7204a6576bd37b9287495b6d1d21e15ee48b4a7b1d7bf36a.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T18-48-46-181Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T18-48-46-181Z/adoption.gif)

