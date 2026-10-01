# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C088 S3: the Tool line gains a version warning (shown only for a tool older than tested or a different major; the host's own Claude Code 2.1.286 is newer than tested, so settings: assistant is within tolerance) and install links when a tool is absent. retained: interrupted and goals: worker-chat differ only in relative-time text; goals planned/running/paused/restore are a one-pixel dot.

Source commit: 89f7412abe6238c95af180efb014736f0751321a; review: docs/visual/reviews/approval-79c18d00554411459c55b44101c39169c721edff44f2fbe841d9c0b23cafbdbe.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/workspace-4.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/chat-4.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/documents-2.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/retained-4.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/settings-4.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/goals-8.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/profiles-3.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-01T10-27-22-157Z/adoption-5.png)

![Recorded interaction](runs/2026-10-01T10-27-22-157Z/adoption.gif)

