# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T05-12-00-086Z/README.md).

Reviewed by Codex editor agent. Inspected all21 deterministic stills/diffs and21 decodedGIFframes, within tolerance/no geometry changes. Dedicated actual Paper E010 inspected6stills,99video samples at2fps and30decodedGIFframes: native Undo removes pending image, Redo restores actual uploaded URL, repeated history issues no duplicate upload, human edit survives server reload. Narrow layout readable. This is in-process history proof, not restart recovery of unfinished uploads; document Saved and Uploading can coexist.

Source commit: 0c73c7f7327c4e94d1f4341404846eb6a3a881ba; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T05-12-00-086Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T05-12-00-086Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T05-12-00-086Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T05-12-00-086Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T05-12-00-086Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
