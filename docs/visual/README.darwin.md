# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-2 builder (Opus). Note Export menu (Paper path bar: Export as Markdown/HTML/PDF, Copy as Markdown), merged with Markdown import. Inspected run 2026-11-15T21-36-19-140Z: 53 frames, all within tolerance except settings: assistant (only the random temp folder name in the Command line path differs, unrelated) and side-chat: open (2e-6, noise). The fixture tour opens legacy documents, not a Paper tab, so the new Export button is not in the tour; it is shown in the live evidence docs/cycles/evidence/note-export/live/2026-11-15-note-export-live (01-export-menu.png) and the status pictures (paper-dark). Behavior: tests/note-export.test.mjs 6/6; tests/note-export.live.mjs 7/7 checks on the carried runtime (files, pictures, clipboard, note unchanged); exported PDF inspected with both pictures.

Source commit: b646f3297aad115485b0db551145907a735c2887; review: docs/visual/reviews/approval-0ba3316398bb13436bd174ab9edca250a8e7431d05b7be537b701f81b4f1360b.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/workspace-4.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/chat-2.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/documents-2.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/retained-4.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/settings-4.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/goals-8.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/profiles-3.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-15T21-36-19-140Z/adoption-5.png)

![Recorded interaction](runs/2026-11-15T21-36-19-140Z/adoption.gif)

