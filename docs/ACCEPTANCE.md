# Acceptance: complete user journeys

These are scenario gates for [the active plan](PLAN.md), not passing test claims. Keep the [historical requirement map](archive/2026-09-21-acceptance.md) for traceability and the [editor matrix](EDITOR-PARITY.md) for regressions. Record actual results in [VALIDATION.md](VALIDATION.md).

## A1 — Profile ownership and isolation

Accepted for the Windows source prototype at `27ea120`; see [completion audit](cycles/C039-completion-audit.md) for evidence, reuse boundaries and limitations. Formal acceptance on macOS and Linux remains pending. Later Mac cycles do contain desktop/native evidence; the earlier claim that no suite ran there is superseded. The current skip ratchet records seven Windows-only atomic-write cases and no whole live files skipped off Windows. C097 first exercised the Windows queue in resumed segments; a full hosted chain passed at f190e831 with five existing skips ([scope](cycles/evidence/C097/hosted-desktop-26-review.json)). A later same-app-source run hit an input acknowledgement timeout; current validation is in the handoff. A cycle that touches `app/` records the hosts it passed on and the skips per host. A2–A5 remain pending.

- Adopt an existing workspace into a default profile twice; backup remains intact and no content, navigation, receipt or chat duplicates.
- Create profiles A/B with identical paper slugs. Documents, media, profile-owned credentials, caches, search results, chats, side-chat parents, drafts, favorites and Undo cannot cross owners.
- Device provider logins and supported environment keys are shared defaults without a per-profile prompt. A configured profile API key takes precedence; an empty profile must never borrow another profile's owned key. Shared login does not authorize cross-profile content access.
- Start a run in A, switch to B, and complete it. Its folder, document edits and events remain in A. Preserve B’s draft and reading position.
- Restart with B selected; restore only B’s workspace. Missing folders and inaccessible references remain explicit, with no fallback to A.
- Corrupt or interrupt registry/adoption writes: recover to a valid prior state without dropping the old workspace.

## A2 — One engine without lost notes

- Create an ordinary empty local note and continue through human and agent editing, save, search, delete/recovery and restart on the same Paper engine. Verify a complete owned library beyond the normal60-item page, with no fallback to legacy creation.
- Preserve the distinction between owned local Archive and Cloud archive, including unavailable/partial listings and identical slugs in separate sources. Human Pages order and placement never change because of discovery.

- Migrate fixtures covering supported blocks, marks, media, internal links, backlinks, titles, human page organization, agent edit receipts and pending proposals. Specify any history/receipt conversion limits before cutover; retain readable originals where semantics cannot transfer.
- Compare structured content and references against the source, open/edit/save/reopen through real Paper, and verify server state, including Undo.
- Interrupt each migration phase, resume, and repeat. No duplicate notes, broken references, dangling media or changed organization.
- Fence all foreground and captured provider/MCP/goal writers before selecting the new authority; interrupted selection must recover one complete engine and retain human drafts.
- Roll back a failed migration from the retained source/backup. Switch authority and retire the separate editor only after the whole corpus passes.

## A3 — Recovery and portability

- Exercise shutdown during save, abrupt desktop death, database death, lost response after commit, repeated events, stale revision and a concurrent human edit. Demonstrate no lost acknowledged change, overwritten draft or duplicate mutation.
- Save draft text, images, side-chat relationships and work-tab destinations; restart and recover them. In-flight runs resume or end with an accurate state, never invented completion.
- Export a consistent profile with notes, media, conversations, links and organization. Import into another clean user-data root; validate counts/content/references and continue editing with an agent.
- Verify real cross-machine transfer before claiming portability: OS-encrypted credentials, Postgres version, absolute paths and missing agent folders need explicit handling. Same-machine tests alone are insufficient.
- Reject truncated/unsupported archives before changing the destination. Retain a recoverable destination backup.

## A4 — Optional sync, two real devices

- Local-only profiles issue no cloud sync requests.
- Two devices edit offline, reconnect in either order, and repeat delivery. Changes converge without duplicate objects or feedback loops.
- Edit the same block on both devices: show a resolvable conflict and retain both versions. Test delete/edit overlap, media recovery and credential expiry.
- Permission loss neither deletes local content nor leaks restricted results. Reconnection and cloud discovery do not place/reorder Pages without the person’s choice.

## A5 — Install and daily use

- A clean Windows machine installs and starts without a source checkout, developer shell or manually installed runtime. Verify dependency licenses and artifact integrity.
- Upgrade and failed-upgrade rollback preserve profiles. Normal quit cleans up owned processes; forced quit has a documented recovery path. Uninstall preserves user data unless explicitly requested otherwise.
- Complete A1–A3 as the local-only pilot; add A4 for the cloud pilot. G1/G2 must clear before claiming an integrated release.
- Exercise keyboard-only navigation, 200% zoom, narrow layouts, long documents, accessible controls, reduced motion, background runs and realistic daily sessions. Record observed failures, not a proposed latency target as a measurement.

## A6 — The agent's browser

The browser inside Barkdown is the one Claude and Codex perceive as theirs, and the one a person can live in for a working day. Measured, not asserted:

- **The bench.** Twelve real tasks (named in [C089](cycles/C089-agent-browser.md)) run by Claude Code and by Codex inside Barkdown, through the user's own CLIs, with the user's sessions. Score each run on finished / steps / minutes / asked-for-help. The same twelve run once in Claude Desktop (Claude in Chrome) and once in ChatGPT desktop by the owner; Barkdown's two columns finish as many tasks as those two, within one step per task on average, and record every difference.
- **No other browser.** Across the bench no run opens, launches or mentions another browser (no `open -a`, no Playwright, no Claude in Chrome); the only browser tools offered are Barkdown's, and the run log proves it.
- **Signed in, with your places.** Google, GitHub and Microsoft sign-in work in a Barkdown tab, popups included; a session survives a Barkdown restart; one import from Chrome brings bookmarks and history, on demand, never silently.
- **Sensitive actions pause.** Purchases, sending messages, password entry, deletions and account changes stop for approval in every mode; a site allow-list and a logged-out mode exist and are honoured; a dialog never strands the run.
- **Daily basics.** Downloads land in the Downloads folder with a progress line; find in page, zoom, a context menu, address bar and tab restore work; content blocking is on with a per-site switch.
- **A day without Chrome.** One person browses in Barkdown for a working day and records what sent them back to Chrome; the list is empty or every item has a cycle slice.

## Evidence required for each gate

Record source commits (both repos when applicable), command/test name, platform and dataset scope, result, artifacts and remaining limits. Mocks validate orchestration only. Cloud sync requires real endpoint tests; profile portability requires another machine; concept tests never prove desktop persistence. No stage is complete solely because a tracker issue is closed.
