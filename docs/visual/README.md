# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T00-00-37-127Z/README.md).

Reviewed by Codex goal recovery agent. Inspected all31 candidate action frames including narrow goals/settings. All pixels and geometry unchanged from reviewed baseline; seven GIFs use these same step frames. Separate actual Electron crash/reopen/reconcile/retry test passes with local deterministic SDK transport and synthetic environment credentials; its dedicated recovery views cover changed wording. No authenticated recovery or encrypted-key restart claim.

Source commit: e9be0194d970511449961b7335228c976a9a54ec; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T00-00-37-127Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T00-00-37-127Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T00-00-37-127Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T00-00-37-127Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T00-00-37-127Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T00-00-37-127Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T00-00-37-127Z/profiles.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.

Actual Electron [goal recovery stills](../goals/evidence/e9be019/README.md) cover interrupted, shutdown verified, reviewed retry and saved results including390px. Local deterministic HTTP through actual SDK/owned workers; no continuous-motion or authenticated recovery claim.
