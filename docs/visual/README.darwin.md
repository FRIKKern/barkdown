# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude Fable 5.1 (agent). C089 slice B: no frame changed beyond tolerance (the agent-tab underline shows only on agent-opened tabs, which the fixtures do not open); 44 within tolerance, 2 small anti-alias differences.

Source commit: aba9e5ff8cc4e18849ca4318eca7916d2e080576; review: docs/visual/reviews/approval-cbf1c388a548b52a0a77c6ef0031cad3e0d62990ed1dcbc4443fbae4a516ec46.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/workspace-4.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/chat-4.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/side-chat-3.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/documents-2.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/retained-4.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/settings-4.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/goals-8.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/profiles-3.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-10-02T13-47-24-187Z/adoption-5.png)

![Recorded interaction](runs/2026-10-02T13-47-24-187Z/adoption.gif)

