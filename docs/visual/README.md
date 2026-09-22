# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T01-03-52-492Z/README.md).

Reviewed by Codex next-cycle agent. Final C014 e3a6554: compared37 frames; no threshold pixel, geometry or environment changes.33 of45 PNG/GIF artifacts byte-identical to reviewed913 run; inspected all11 changed PNGs and workspace GIF underlying frames. Actual final23139/tp1w78 passed:4 stills byte-identical to prior reviewed capture, new-turn timing still inspected; reviewed32 one-fps video samples and all88 raw8fps frames (83 GIF frames after duplicate coalescing). Preserved draft, legible recovery review and narrow side controls. Actual local HTTP API SDK, no external-model claim; all3 jobs verified stopped. Live Paper separate.

Source commit: e3a65542c094f154236952d2e8d75de2c597af78; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T01-03-52-492Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T01-03-52-492Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T01-03-52-492Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T01-03-52-492Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T01-03-52-492Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T01-03-52-492Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T01-03-52-492Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-09-22T01-03-52-492Z/adoption.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
