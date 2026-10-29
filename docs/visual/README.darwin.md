# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by claude-barkdown-mac. Inspected run 2026-10-29T23-42-01-375Z on darwin. The flagged frames differ only in relative times and dates ("just now", the legacy and retained notes' "updated" line, the recent chat's time), which moved because the capture ran after midnight UTC, and in the temporary path of the command-line row; geometry flags come from those lines' widths. The change under review is quit settlement (renderer/src/quit-settlement.js), which no tour frame shows; it is covered by tests/quit-settlement.test.mjs and workspace-quit.live.mjs.

Source commit: 74508df46fbc2b57b1865f0de42e047440e3e1d4; review: docs/visual/reviews/approval-b26a25cfe1811cdcb353c5d3126e7345b11480ce603d2f014447fac402f89d75.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/workspace-4.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/chat-2.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/documents-2.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/retained-4.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/settings-4.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/goals-8.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/profiles-3.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-29T23-42-01-375Z/adoption-5.png)

![Recorded interaction](runs/2026-10-29T23-42-01-375Z/adoption.gif)

