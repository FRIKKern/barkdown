# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-21T23-23-17-409Z/README.md).

Reviewed by Codex editor agent. E002 afc9c79: inspected all21 actual PNG frames and all21 decoded GIF frames, including menus, narrow layout, modal controls, themes and side-chat geometry. Comparison reports no above-tolerance pixel, geometry or environment changes. Paper host23/23 and full desktop76/direct-edit/history/sidechat checks passed. Real Paper takeover motion and server preservation have separate dedicated evidence; this fixture approval does not claim them.

Source commit: afc9c79a33c49dd5fd3e303933207994e7b5b4c8; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-21T23-23-17-409Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-21T23-23-17-409Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-21T23-23-17-409Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-21T23-23-17-409Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-21T23-23-17-409Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
