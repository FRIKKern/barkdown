# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-21T23-39-00-392Z/README.md).

Reviewed by Codex integration coordinator. Inspected all31 actual frames in seven area contact sheets, including profile Settings and goal planned/running/paused/narrow/worker navigation. Existing21 reference frames have zero above-tolerance pixel or geometry differences; new10 frames readable with menus and footer/scroll regions intact. No new clipping or overlap observed. Deterministic providers remain blocked; this does not prove native worker execution or live Paper behavior. Inherited40percent default mismatch is tracked separately. Full pre-native desktop passed;46 native goal tests and23 Paper host tests pass, current native Electron fixture adaptation pending.

Source commit: ae49f97b92290ac2efbfa508e032b57b3ceeb3f1; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-21T23-39-00-392Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-21T23-39-00-392Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-21T23-39-00-392Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-21T23-39-00-392Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-21T23-39-00-392Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-21T23-39-00-392Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-21T23-39-00-392Z/profiles.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
