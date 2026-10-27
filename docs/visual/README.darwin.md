# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 27.0.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude (agent, Opus 5.5), for #95. Run 2026-10-27T16-56-56-138Z after 8ab9bea5, which changes the launcher, app/package.json scripts and docs, not renderer code. comparison.json: 44 frames, none with geometry changes; 36 small-difference, 8 review-required with at most 0.43% changed pixels. Inspected goals-6 (narrow, the largest) and settings-1 before/after/diff: the changes are the deadline/timestamp line and the temp-path text in Settings > Command line (this capture ran with TMPDIR resolved to /private/var/...), plus antialiasing on the Settings heading. Inspected workspace-0 after: layout, sidebar and composer unchanged. The other review-required goals frames share the same deadline line; I did not open each GIF frame.

Source commit: 8ab9bea5661dd6475daa5bd6c5314a263ed0ab96; review: docs/visual/reviews/approval-a00f19a048b02c94ef7160822571937b3eaaf65d26d01ad87ed2bc60b4b11feb.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/workspace-4.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/chat-2.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/documents-2.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/retained-4.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/settings-4.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/goals-8.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/profiles-3.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-27T16-56-56-138Z/adoption-5.png)

![Recorded interaction](runs/2026-10-27T16-56-56-138Z/adoption.gif)

