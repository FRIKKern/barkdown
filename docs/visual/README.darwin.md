# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Daily notes review fixes at d7e8daf2. While Show Barkpark papers is off, the Pages calendar button and the quick open rows hide and a press says why. A kept request is checked against the library before replay. A refused request is dropped with a toast. Run 2026-11-18T09-56-34-521Z vs 09-16-09-010Z on darwin: every changed frame inspected. Only settings assistant differs, in the random temp folder name in the Command line path. Every other still has 0 changed pixels and the same geometry. The fixture tour has no profile or local library, so it never shows the daily-note controls. Those are in the live test pictures (docs/cycles/evidence/daily-note/live/2026-11-18-daily-live, 01-05). Behavior: app/tests/daily-note.test.mjs 11/11 (cases 8-11 fail on 159e8250); app/tests/daily-note.live.mjs passed 6/6 at d3b7df5a, with main's create answer held across a profile switch to force the kept request.

Source commit: d7e8daf2bfec1d14f1ac62441c3b19a267015f7d; review: docs/visual/reviews/approval-07b831d1a1a23881a86608d98ee1da2f2cb1b819299a1a12842df8658a7135ca.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T09-56-34-521Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T09-56-34-521Z/adoption.gif)

