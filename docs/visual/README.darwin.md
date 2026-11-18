# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). A mention waits (at most 4 s) for an open note to finish saving before the send reads it; a save that fails, or Markdown source text (the note keeps its source view), sends the last saved text with a toast. Merged with main at bace0bcc. Inspected run 2026-11-18T21-35-55-369Z against 2026-11-18T21-20-31-201Z: every frame within tolerance except settings-assistant (only the random temp suffix of the command-line path differs) and a few pixels in quick-open with no geometry change. The fixture tour never mentions a note, so the wait and the toast are not in it; they are proven by app/tests/note-mention.live.mjs (real Electron, carried runtime 1482fb675, scripted API SDK; 12/12 passed at e2e8ce3a: typing in the open note and sending in the same tick sends the just-typed words; a conflicting save and source mode send the last saved version with the toast, screenshot inspected). The just-typed step fails on 713e5ee5. Limits: no narrow-width picture of the toast; Windows not captured.

Source commit: bb6ff8fa3cbce4f02ebc3e904409add56e5182b9; review: docs/visual/reviews/approval-42a8a46ad49d99a0770499c58fafce90d365f1eff5a373345100f1dc23cdf313.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T21-35-55-369Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T21-35-55-369Z/adoption.gif)

