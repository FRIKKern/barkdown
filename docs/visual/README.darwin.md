# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Export closes a list-item code block at the opener's indent (app/shared/chat-menu.js Markdown only; nothing drawn changes). Compared with approved run 2026-11-18T07-09-59-606Z: every frame within tolerance except settings assistant, whose diff is only the temporary CLI path.

Source commit: 6b7868b0e759d3f7e9a6ba39d0aad4e9492ac86f; review: docs/visual/reviews/approval-dc92f3ae82731122c0c8ec90f85418fcf0fae326eab6e8b9b79f181995c8fdfc.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T07-39-22-052Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T07-39-22-052Z/adoption.gif)

