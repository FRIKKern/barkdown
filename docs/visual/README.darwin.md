# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Chat menu in Recent chats (rename, pin, save as a note, export as Markdown, delete). Checked every frame: the only app change in the tour is the chat row's subline truncating ~26px earlier (room for the hover … button), seen in side-chat, documents, retained and goals worker-chat; the settings-assistant diff is the temporary CLI path. The tour has no step that opens the chat menu; its look (menu open, disabled reasons, pinned row with pin icon, saved note beside the chat) was inspected in tests/chat-menu.live.mjs screenshots on the carried runtime, which passed 10/10 (rename, empty-name refusal, named chat kept after first message, pin order, restart persistence, one note for two presses, disabled reasons, export file, keyboard, delete pinned). Narrow layout unchanged (sidebar hidden).

Source commit: d7ffe417cda7c84b311a5f2ec847a278b68efec1; review: docs/visual/reviews/approval-81833e1f32a0ab678b6ce0f6f4c8da027b78fda2fc2648d8360686ba2c5b515f.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T06-18-06-358Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T06-18-06-358Z/adoption.gif)

