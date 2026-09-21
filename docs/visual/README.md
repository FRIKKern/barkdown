# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-21T23-10-09-960Z/README.md).

Reviewed by Codex goal integration agent. Inspected all 27 raw action frames via contact sheets and full-size390px goal view; six step-recorded GIFs map to those same27 frames. Existing21 frames have zero changed pixels or geometry changes; environment unchanged. Six new explicitly labelled fixture goal frames cover plan, three observed fixture workers, pause, narrow, restore and ordinary worker navigation. No clipping or unintended tracks; main content remains scrollable behind fixed footer. Goals/provider/service36 tests pass including real provider loops with deterministic transport, profile switch, stale saves and recovered termination guard. Full desktop suite and isolated live Paper capture are still running; these fixtures do not prove production IPC or authenticated goal execution.

Source commit: cde979434d00f56f2a43fe7bd72938b89655bd12; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-21T23-10-09-960Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-21T23-10-09-960Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-21T23-10-09-960Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-21T23-10-09-960Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-21T23-10-09-960Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-21T23-10-09-960Z/goals.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
