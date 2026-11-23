# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Codex. Reviewed all 45 macOS frames, including wide and 390 px settings, plus both pixel diffs and unchanged geometry. A focused Electron regression verified that background runs keep their own profile approval mode after a profile switch.

Source commit: 1e9a291da67538a67876c608e47ac566640ad1ba; review: docs/visual/reviews/approval-bbbd40553e5c1e2c8ec33f4fd53769bbd6d12d01f4ed3690b09f4070307dd333.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/workspace-4.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/chat-2.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/documents-2.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/retained-4.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/retained.gif)

## settings

Real Settings navigation and the approval choice at a narrow width. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/settings-5.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/goals-8.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/profiles-3.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-22T22-07-45-351Z/adoption-5.png)

![Recorded interaction](runs/2026-11-22T22-07-45-351Z/adoption.gif)

