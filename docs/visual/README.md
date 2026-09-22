# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T04-51-49-914Z/README.md).

Reviewed by Codex editor agent. Inspected all 21 stills, 21 difference images and 21 decoded deterministic GIF frames: within tolerance without unexpected geometry changes. Separately reviewed real E009 Paper nine stills, 112 video samples at 2fps and 46 decoded GIF frames; selected-text recovery, two uploads and reload preserved. Final status five stills and all 37 GIF frames reviewed, real Codex provider. Mixed independent image/text remains explicit refusal; arbitrary media fidelity is not claimed.

Source commit: 25cb11498cc5dda7682a9665b99cc6c31db7f8cb; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T04-51-49-914Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T04-51-49-914Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T04-51-49-914Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T04-51-49-914Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T04-51-49-914Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
