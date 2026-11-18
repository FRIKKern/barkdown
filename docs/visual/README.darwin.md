# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-3 builder (Opus). Stuck Save as a note fix (task-456e13040ed2b603) at ce of caa29a76 + status shots. All tour steps unchanged (0 changed pixels; workspace narrow 0.0000037, no geometry change). The tour has no step that reaches a kept chat-note or clip request, so the new Pages notice (Chat note not confirmed. Retry / Discard on one line, .bw-kept-notice) is not in it; it is shown and checked in tests/chat-menu.live.mjs step 6b (screenshots 03b-chat-note-not-confirmed, 03c-chat-note-refused), which passed 13/13 on the carried runtime 1482fb675: notice appears with Retry|Discard, Discard drops the request (memory and workspace.json) and the next save makes one new note, a refusal for good is dropped at once with the reason and no notice, Retry from Pages makes the kept note once and opens it beside its own chat. Limits: one Mac (darwin arm64), dark mode; the refusal and the unconfirmed reply are forced through a test-only IPC handler.

Source commit: a4fdd790d65b4f9bf9d2ba6b22683f28e9dfc50e; review: docs/visual/reviews/approval-c1b5c0ed3f4d0505b2dbac5b0a28b0520a704f621f083710580da1eae36afab8.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/workspace-4.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/chat-2.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/documents-2.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/retained-4.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/settings-4.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/goals-8.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/profiles-3.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-18T21-25-38-933Z/adoption-5.png)

![Recorded interaction](runs/2026-11-18T21-25-38-933Z/adoption.gif)

