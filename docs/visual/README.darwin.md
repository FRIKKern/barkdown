# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Mention a note with @ in the chat composer, merged with main after the note outline (PR 139). Inspected run 2026-11-18T08-15-29-853Z against 2026-11-18T07-32-39-523Z: every frame within tolerance except settings-assistant (only the temp folder of the command-line path differs: another worktree) and goals-narrow (a few pixels, no geometry change). The fixture tour never types @, so the picker and chips are not in it; they are proven by app/tests/note-mention.live.mjs (real Electron, carried runtime, scripted API SDK; 9/9 passed: picker, Enter/Tab pick, Escape, Backspace, dispatched fence, dedupe, cut, deleted note, history Up, side chat, chip opens note, reload), whose screenshots were inspected (picker left-aligned above the composer, chips legible in dark mode). Limits: no narrow-width picture of the picker; Windows not captured.

Source commit: 0ad1ea17aff8e691dc543afa3a9dcbc3c913a545; review: docs/visual/reviews/approval-b657ebcd096d7c31d847c5f919e31b3e4beb7446962300b5a357aff4035e84de.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T08-15-29-853Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T08-15-29-853Z/adoption.gif)

