# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T00-18-43-302Z/README.md).

Reviewed by Codex next-cycle agent. C012 final coverage-bound run: all37 stills and37 decoded frames in8 GIFs reviewed through prior00-14-30 actual media inspection plus SHA256 comparison of45 final PNG/GIF artifacts.41 byte-identical;4 changed stills (goals worker and sidechat states) viewed directly. Reviewed baseline changes: inherited60percent width changes sidechat/settings/reset label; inherited goal controls and new adoption states readable; no new clipping or overlaps. Existing scrollable goal content/GIF palette banding remain. Actual workspace-loss Electron3 images reviewed separately; full desktop passed, isolated87ca Paper5stills+37GIFframes reviewed, runtime stopped. Fixture tours remain distinct from actual migration/provider proof.

Source commit: ba0aa59b3589ece9eee4ea2e7c3e1041afc58667; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T00-18-43-302Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T00-18-43-302Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T00-18-43-302Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T00-18-43-302Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T00-18-43-302Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T00-18-43-302Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T00-18-43-302Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-09-22T00-18-43-302Z/adoption.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
