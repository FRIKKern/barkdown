# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Quit conflict banner (task-b3a756337ed156bc): a save refused by a conflict at quit is named when the note is reopened, also after other writers moved it on, and Put the words back writes against the note's current revision. On origin/main 72d5f135. Inspected run 2026-11-18T23-32-36-032Z against 2026-11-18T21-35-55-369Z: settings-assistant differs only in the random temp suffix of the command-line path; workspace narrow and goals narrow differ by a few anti-aliased pixels, no geometry change. The tour does not produce a quit conflict; the banner and the put-back are shown in app/tests/paper-quit-conflict.live.mjs pictures (real Electron, carried runtime 1482fb675). Limits: Windows not captured.

Source commit: be752d9534a7f0e0363c6402b9f1626b68ef7c1c; review: docs/visual/reviews/approval-ea6ac6c96953fe8f2df8f5b7429bb3b925b582fe3f76fd05e315d748aba35b70.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T23-32-36-032Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T23-32-36-032Z/adoption.gif)

