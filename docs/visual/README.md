# Visual health

Approved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report](runs/2026-09-21T22-41-46-408Z/README.md).

Reviewed by Codex editor agent. E001 final harness review: inspected all 21 action frames across workspace, chat, side chat, documents and Settings after adding the Paper recovery capture tripwire. No changed pixels above tolerance, geometry change or environment drift; clean capture inputs at e19edfa. Nineteen controlled Paper races and four real-server recovery journeys separately prove behavior. Live Paper and recovery images remain distinct from these fixture tours; no crash-recovery or profile-isolation claim.

Source commit: e19edfa6dbe60475adc0f26bf5782066250478d6; platform: win32; Electron: 38.8.6. Source fingerprints, including dirty capture inputs, are recorded in the manifest.

## [workspace](workspace/README.md)

![Real desktop navigation with disposable local notes; no cloud or provider.](runs/2026-09-21T22-41-46-408Z/workspace.gif)

## [chat](chat/README.md)

![Shared main composer: draft, provider chooser and model chooser. No message is sent.](runs/2026-09-21T22-41-46-408Z/chat.gif)

## [side-chat](side-chat/README.md)

![A real saved side conversation and its independent composer, using disposable fixture state.](runs/2026-09-21T22-41-46-408Z/side-chat.gif)

## [documents](documents/README.md)

![Legacy local document editor, still retained until P2 migration. This is not the Barkpark Paper canvas.](runs/2026-09-21T22-41-46-408Z/documents.gif)

## [settings](settings/README.md)

![Real Settings navigation. No server connection or credential is configured.](runs/2026-09-21T22-41-46-408Z/settings.gif)

## Live evidence and gaps

The existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. [Paper save safety](paper-save/README.md) now covers delayed writes, retained navigation/close, server Undo/redo, refusal/Retry and cancelable discard with real Paper and explicitly injected transport faults. Separate live walkthroughs for agent takeover, files/reviews, crash recovery and profile switching remain outstanding.
