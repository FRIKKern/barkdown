# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-21T23-34-15-390Z/README.md).

Reviewed by Codex editor agent. Reviewed all 21 PNGs and 21 decoded fixture GIF frames; comparison has zero pixel, geometry or environment changes. Separately inspected final live Paper 8-case evidence, 70-frame normal-motion excerpt, 107 full-video one-second samples, eight stills including narrow layout; first receipt no longer shifts document. Real status five stills and all 37 GIF frames inspected. Host 23/23 and direct-edit UI passed; upstream baseline save-ack/watchdog failures remain.

Source commit: 663a12a6e67b629194b670fa34684d1d8124761e; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-21T23-34-15-390Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-21T23-34-15-390Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-21T23-34-15-390Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-21T23-34-15-390Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-21T23-34-15-390Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
