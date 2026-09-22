# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T01-38-38-706Z/README.md).

Reviewed by Codex goal-orchestration agent. Inspected all34 candidate action frames, prior goal frames and generated differences, including390px goal form and recovery layouts. Seven GIFs retain the34 reviewed action frames. Three objective-only creation frames extend the goal tour and shift index-based comparisons; changed goal geometry is expected, with readable controls and no overlap. Other25 frames remain within tolerance with unchanged geometry/environment. Full desktop50783 passed57 goal checks and76 desktop checks plus actual normal/crash coordinator journeys; authenticated Codex61ee passed separately. Fixture providers are blocked and do not establish live Paper behavior.

Source commit: 61eea4dc87de0f9548ff33d7fafc455f9f265866; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T01-38-38-706Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T01-38-38-706Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T01-38-38-706Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T01-38-38-706Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T01-38-38-706Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T01-38-38-706Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T01-38-38-706Z/profiles.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
