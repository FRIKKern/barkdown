# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.3.0, Electron 38.8.6). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by Claude primary agent. C085 export and import from Settings: four profile frames changed (settings, new-name, narrow, restore) because the Storage section gained Export this profile and Import a profile; inspected the standard and the narrow frame, rows align with their neighbours, buttons sit in the control column, no clipping. All other stills are pixel-identical to the previous run. Fixture capture; the live export and import are in docs/cycles/evidence/C085/live.

Source commit: 8e3a01b2a9ab40727fc9407d180ab542f65ee6da; review: docs/visual/reviews/approval-a2c195e29f3373d2650f7ec505c6011f31d1793b3a75f44a7468226dd72620df.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/workspace-4.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/chat-4.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/side-chat-3.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/side-chat.gif)

## documents

Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/documents-2.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only: a badge in Pages and a read-only editor. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/retained-4.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/settings-4.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/goals-8.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/profiles-3.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-09-29T12-58-12-379Z/adoption-5.png)

![Recorded interaction](runs/2026-09-29T12-58-12-379Z/adoption.gif)

