# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T05-02-07-170Z/README.md).

Reviewed by Codex goal-orchestration agent. C023: inspected all34 action frames including intermediate menus, dark editor, narrow goal forms/recovery and profile settings. All comparisons within tolerance; zero geometry or environment changes. Full desktop44980 passes44 atomic storage checks,68 goal/native checks,76 desktop checks and all existing actual UI journeys. All17 actual coordinator normal/planning-crash stills inspected. Bounded Windows retry and complete-owner/cleanup proofs are separate behavior evidence; no power-loss, rogue-writer CAS or combined-source approval claim.

Source commit: 82f13d49f818f7cf275e2db547a44c2bb54f202c; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T05-02-07-170Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T05-02-07-170Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T05-02-07-170Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T05-02-07-170Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T05-02-07-170Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T05-02-07-170Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T05-02-07-170Z/profiles.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.
