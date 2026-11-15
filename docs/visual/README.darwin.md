# Visual health on darwin

Approved fixture captures of the real Electron UI on darwin (OS 24.5.0, Electron 44.5.1). The primary gallery in [README.md](README.md) is the Windows source machine's; this page stands beside it, never in its place. See [rules](RULES.md).

Reviewed by feat-barkdown-2 lane lead (Opus). Markdown import (PR #134) merged with origin/main 1185920d (Save to notes). Compared with the approved run 2026-11-15T17-22-25-118Z: 51 of 53 scenes 0 changed pixels; side-chat open 2e-6 (anti-aliasing); settings assistant 0.03% is only the random temp folder name in the Command line path (looked at after/diff). Motion GIFs unchanged. The Pages import button shows only in a local profile, which this fixture tour does not use, so it does not appear here; behaviour proof is tests/markdown-import.test.mjs and markdown-import.live.mjs. Status pictures retaken at baaa62d3 (paper-dark, quick-open looked at).

Source commit: 2b25d8ae9f8fff8520159648af7399d4446b9967; review: docs/visual/reviews/approval-1bccd5fc23be90dece316e725bfd768ee42ed27ed0a160f6811e364a1bc09ae6.json.

## workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/workspace-4.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/workspace.gif)

## chat

Shared main composer: draft, provider chooser and model chooser. No message is sent.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/chat-2.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/chat.gif)

## side-chat

A real saved side conversation and its independent composer, using disposable fixture state.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/side-chat-3.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/side-chat.gif)

## documents

Read-only legacy document viewer. The light frame is a theme-contrast comparison; no Paper server or editing is used.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/documents-2.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/documents.gif)

## retained

After the library switch the legacy notes are retained read-only. Dark by default; the light frame compares theme contrast. Fixture journal; no Paper server.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/retained-4.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/retained.gif)

## settings

Real Settings navigation. No server connection or credential is configured.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/settings-4.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/settings.gif)

## goals

Goal component with explicitly injected fixture snapshots and providers blocked. Saved worker chats use the ordinary composer; this is not live scheduler/provider proof.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/goals-8.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/goals.gif)

## profiles

Profile Settings controls with injected stable registry names. This tour makes no profile switch; real switching and Paper save protection have separate integration evidence.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/profiles-3.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/profiles.gif)

## adoption

Real recovery window with explicit fixture states; no migration is performed in this visual tour. Actual transaction/restart proof is separate.

![Current view on darwin](runs/2026-11-15T19-42-14-165Z/adoption-5.png)

![Recorded interaction](runs/2026-11-15T19-42-14-165Z/adoption.gif)

