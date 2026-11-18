# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Note outline (task-c07e746760cbedc1): a Paper note's path bar gains an Outline button after Export; open, a 232px panel sits beside the note (overlay under 720px of work area). Inspected every changed frame: the fixture tour only opens legacy notes and Settings, so it never reaches a Paper path bar or the panel (no tour step added). settings: assistant differs only in the worktree-specific command-line path text; quick-open, side-chat ready and goals narrow are sub-pixel noise; the new Settings > Shortcuts row (Ctrl+Shift+O) is below the captured fold. The outline itself is shown in the live Paper evidence docs/cycles/evidence/note-outline/live/2026-11-18-note-outline-live (wide, after a jump with highlight, typed heading, narrow overlay, no headings, 300 headings) and the status picture paper-dark shows the new button. Behavior: tests/note-outline.test.mjs 8/8; tests/note-outline.live.mjs 11 checks passed in real Electron on the carried runtime.

Source commit: a454f915fc132ba028f0d23c0b6b042ce3d0ccc3; review: docs/visual/reviews/approval-c5e8c8a60c6d3f9a0dd578129e4b2c1d7e01b36a5d8c35e4bf9781053b42fac9.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T06-06-39-781Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T06-06-39-781Z/adoption.gif)

