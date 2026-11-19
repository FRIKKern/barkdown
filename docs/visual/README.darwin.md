# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Only diff: the per-run temp folder name in Settings > Command line; other frames at 1e-6 noise. Kept-words marker cleared by Load the server version / Discard (no visual change).

Source commit: c7b00b95b5b4d218c20a591c1135fc22bf8e750b; review: docs/visual/reviews/approval-126957bef47ec09e91e2da9f22199c441ab8b671fdcbc18b2ce033fb74d5f2f8.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T07-50-52-076Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T07-50-52-076Z/adoption.gif)

