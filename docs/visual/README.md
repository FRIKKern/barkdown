# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-22T04-19-49-564Z/README.md).

Reviewed by Codex C016 agent. C016: inspected all37 original stills and37 GIF frames at04-14; final04-19 recapture has33 pixel-identical stills, four max-channel1 shadow/one-pixel differences inspected again, seven byte-identical GIFs and all four side-chat GIF frames reinspected. No geometry changes or above-threshold pixels. Full desktop51548 passed; separate actual34ef068/a544 two-runtime journey64864 passed exact scroll360 and anchor112.453125 through A completion and B restart, normal cleanup. Known long Paper heading clipping remains scoped in dedicated evidence. P1 and combined-source gates remain open.

Source commit: 6f3c5db53eb4564d1e07d7910c13ef29d718e13b; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-22T04-19-49-564Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-22T04-19-49-564Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-22T04-19-49-564Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-22T04-19-49-564Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-22T04-19-49-564Z/settings.gif)

## [goals](goals/README.md)

![Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.](runs/2026-09-22T04-19-49-564Z/goals.gif)

## [profiles](profiles/README.md)

![Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.](runs/2026-09-22T04-19-49-564Z/profiles.gif)

## [adoption](adoption/README.md)

![Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.](runs/2026-09-22T04-19-49-564Z/adoption.gif)

## Dedicated journeys and remaining limits

The [Paper editor gallery](../images/status/manifest.json) records its own live server provenance. Dedicated journeys below retain their original source and review; this fixture approval does not restamp them or prove their remaining acceptance criteria. See each page for failures and coverage limits.

- [agent-takeover](agent-takeover/README.md): live-paper-agent-adapter-with-human-takeover.
- [rich-takeover](rich-takeover/README.md): live-paper-rich-content-takeover.
- [chat-recovery](chat-recovery/README.md): actual-electron-owned-job-crash-and-recovery.
- [profile-isolation](profiles/isolation-runs/README.md): actual-Electron-two-runtime-late-edit-Undo-restart.
