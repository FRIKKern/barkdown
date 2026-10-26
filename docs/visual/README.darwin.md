# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude (agent). Reviewed 2026-10-26T17-17-50-775Z against 05-48-36 (darwin, dark). Only change: settings-1 command-line path shows the random temp folder name (expected per run). goals-6, quick-open, side-chat: sub-0.04% anti-alias noise, no visible change. The change under test (control.js note lookup, import/migration directTab) has no visual effect.

Source commit: 849fc7a9e432cf1dd168736d84988cc5242fe3ed; review: docs/visual/reviews/approval-ad1e135ec9fc01594a7a2f844990ebafae6a5f1e45fd08a65286600499d37c26.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/workspace-4.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/chat-2.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/documents-2.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/retained-4.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/settings-4.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/goals-8.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/profiles-3.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-26T17-17-50-775Z/adoption-5.png)

![Recorded interaction](runs/2026-10-26T17-17-50-775Z/adoption.gif)

