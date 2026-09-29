# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent, this session). Inspected the 2026-09-29T10-43-21-937Z comparison: 46 frames within tolerance against the darwin baseline (one frame differs by two pixels, no geometry change). The input change is the pin move to upstream 74e38574b: provenance and notices manifests only, editor bundle and css byte-identical; every rehearsal was rerun at the pin (docs/cycles/evidence/C083/rehearsals-pin-74e38574b-macos.log).

Source commit: 806714a65c863224e8d42aacb68806c2001d85e5; review: docs/visual/reviews/approval-094c911d2ce581d9a2b8a195b21d2693e7b285b643de7d98161cc6df5ce22a83.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T10-43-21-937Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T10-43-21-937Z/adoption.gif)

