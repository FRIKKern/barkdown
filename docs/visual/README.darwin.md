# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Mention edges: picked-only mentions, Enter on no match sends nothing, one-line titles, wider fence neutralising, settle by mounted note. On origin/main 72d5f135. Inspected run 2026-11-19T00-42-37-402Z against 2026-11-18T21-35-55-369Z: settings-assistant differs only in the random temp suffix of the command-line path; goals narrow and side-chat draft/ready differ by a few anti-aliased pixels, no geometry change. The tour has no mention picker with no match; that step is in app/tests/note-mention.live.mjs (real Electron, carried runtime 1482fb675). Limits: Windows not captured.

Source commit: f33708da7d1b087cbf8565be07a926d9e2875860; review: docs/visual/reviews/approval-569f82f3d0aac64a95820d5eddcd66ba584575351cf703dd11a8500f19d0309c.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/workspace-4.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/chat-2.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/documents-2.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/retained-4.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/settings-4.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/goals-8.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/profiles-3.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-19T00-42-37-402Z/adoption-5.png)

![Recorded interaction](runs/2026-11-19T00-42-37-402Z/adoption.gif)

