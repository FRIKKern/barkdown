# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 27.2.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Code (darwin). #96: the sidebar header no longer shows the b mark or the Barkdown name, so nothing sits under the macOS window buttons; the new-document button stays on the right. Inspected the stills and diffs for workspace, chat, settings and goals. Every wide frame differs only in the removed mark and name, plus the times, dates and temp path that change on each run. Narrow frames hide the header and differ only in those runtime values. Geometry and environment unchanged.

Source commit: 7596123f8333212fd79b6c03a7d759c4b3ea90db; review: docs/visual/reviews/approval-f7c02c72a52c36c97f8d6adf2e8570a8400a0c7d726cea64de9ae897a4b78105.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/workspace-4.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/chat-2.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/documents-2.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/retained-4.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/settings-4.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/goals-8.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/profiles-3.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-02T09-59-57-108Z/adoption-5.png)

![Recorded interaction](runs/2026-11-02T09-59-57-108Z/adoption.gif)

