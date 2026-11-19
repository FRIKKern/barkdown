# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Chat note review fixes merged with main 466b6c29 (#149). 44 steps: settings: assistant differs only in the random temp-folder name in the command-line path; side-chat open/ready under 3e-6 changed pixels; all others within tolerance with no geometry change.

Source commit: f264153bb4ea38624b7761d9819ccfbb23800171; review: docs/visual/reviews/approval-188d79975308b2235dd43837e67b5a31c3f36fe33bf782735a008c48eb3e4cc2.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T08-41-03-265Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T08-41-03-265Z/adoption.gif)

