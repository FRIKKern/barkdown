# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Account badge shows a person icon, merged with main 8329561f. Every step differs only in the badge at the bottom of the sidebar (about 1e-4 of the frame; 3e-5 under a dimmed dialog); a contact sheet of all 44 captures' badge corner shows the icon in dark, light and dimmed views and no letters. settings: assistant also differs in the random temp-folder name. No geometry change.

Source commit: 30e2f7297a556ec4ff3741b11dee7d70ca9ebbf1; review: docs/visual/reviews/approval-619016226ca2ae145b5252ffb0fb1aefefd29f7d9b8ba4ad8541fa00f3eddad3.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T09-32-55-260Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T09-32-55-260Z/adoption.gif)

