# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude (agent). Inspected every changed frame. settings-1: only the random /private/tmp/barkdown-visual-* folder name. goals-6: a few anti-aliased pixels, nothing visible. retained-0 (References section) matches the baseline again: an earlier candidate that mounted the pane before the library lost References, so the pane now waits for the library. A second earlier candidate showed quick open scrolled four rows down once; it did not reproduce on recapture.

Source commit: 2958c68e3cea6ca837127e338a32ae5d55b8e19c; review: docs/visual/reviews/approval-0f2f82ef524c3d435800b505e2a7b3bd0214fb37b0f3d0659bb9d5217a0fdeff.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/workspace-4.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/chat-2.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/documents-2.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/retained-4.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/settings-4.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/goals-8.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/profiles-3.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-27T00-21-13-789Z/adoption-5.png)

![Recorded interaction](runs/2026-10-27T00-21-13-789Z/adoption.gif)

