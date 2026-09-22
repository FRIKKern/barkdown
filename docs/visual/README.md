# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T00-00-09-406Z/README.md).

Reviewed by Codex next-cycle agent. C010 e16eaa7 storage-helper checkpoint: inspected all21 stills and all21 decoded frames across5 GIFs, including narrow layout, menus, side chat, light/dark document and settings. Comparator zero pixel/geometry differences from prior approved run. No new clipping or movement observed; GIF palette/shadow banding retained. Helper16 actual process exits plus authority loss, orphan journal, later-profile rollback and cold-adoption/file-lease regressions passed. Fixture UI only; actual Electron runtime adoption and source shots remain pending in coordinated boot lane.

Source commit: e16eaa725f2c98893cf75ec78572c4f2aab1d69d; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T00-00-09-406Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T00-00-09-406Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T00-00-09-406Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T00-00-09-406Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T00-00-09-406Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
