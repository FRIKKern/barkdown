# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Markdown import fence rule: the importer reads fenced code with the converter's own rule (shared/markdown.js#codeLines, built on isFenceLine). On origin/main 72d5f135. Inspected run 2026-11-19T00-53-16-268Z against 2026-11-18T23-29-53-712Z: settings-assistant differs only in the random temp suffix of the command-line path; side-chat open by a few pixels, no geometry change. No visible surface changed: import is covered by app/tests/markdown-import.test.mjs. Limits: Windows not captured.

Source commit: 99b7cae11c47a5cdf067b6f85bd6aa127a69b501; review: docs/visual/reviews/approval-0e91c5337859ea21d7be715307abf44fe35a9e5d389438f21b96cb236a32ee13.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T00-53-16-268Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T00-53-16-268Z/adoption.gif)

