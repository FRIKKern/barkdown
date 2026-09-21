# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-21T22-23-18-613Z/README.md).

Reviewed by Codex C003 registry agent. Reviewed all 21 action frames and five recorded sequences, including narrow layout, menus, themes and side-chat drafts. No pixel or geometry differences from approved baseline. Registry staging is additive and not wired to startup; 24 real-filesystem recovery/isolation checks plus full desktop, direct-edit, history and side-chat suites passed. Captures prove existing UI regression only, not profile switching or migration.

Source commit: 5b0917c2c428e382a44f90f6dae6fa581e889ea2; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-21T22-23-18-613Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-21T22-23-18-613Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-21T22-23-18-613Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-21T22-23-18-613Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-21T22-23-18-613Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
