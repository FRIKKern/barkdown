# C060 — Owned Paper Archive

Active on `codex/paper-library` from accepted/pushed C059 `7e79467`, draft PR33. Minimum run end 2026-09-24 10:18:54 UTC. No real-library cutover or deployment.

Main derives catalog origin from the current managed profile/runtime connection, never a remote field, URL guess or slug. Only owner-qualified rows matching the renderer profile enter Archive. Connected/manual libraries remain Cloud archive, including loopback. Human Pages and labels survive refresh/failure/restart. Legacy unmanaged local mode remains cloud until separately proven.

Implemented trusted catalog stamping, local/cloud partition, correct unavailable-section count and retained Paper options. Focused origin/navigation/library-refresh: 16 passed; real DOM Pages checks passed; renderer build passed. New native two-profile/manual-connection fixture is written but not yet run. Full desktop/root and fresh live/standard visual approval remain pending. Source commit is next, then run `BARKDOWN_TEST_BP_SOURCE=<owned upstream> node tests/paper-archive.live.mjs` from app.

C059 exact `7e79467` Verify and Visual CI passed; Linux parity 35979091296 still running at last inspection. Historical 43 locked worktrees retained. No owned runtime is currently running. Preserve user/shared services.

Native first attempt at source `5bc0be0` stopped on an overly narrow fixture assertion: the real runtime also creates its Welcome paper. Failure still actually inspected; it correctly showed both owned papers in Archive. Retain the failure gallery. The fixture now checks target presence and local ownership of every catalog row, preserving the runtime Welcome paper. No production change required.

The second native attempt reached the correct Archive view (still actually inspected), then timed out because the fixture tried clicking a hover-only action without hovering its row. Corrected the native gesture; no production change. Both failed galleries remain append-only and are not accepted motion proof.

Third native attempt passed A classification and human placement/nesting, then its profile-switch wait dereferenced the renderer during reload. Added the same optional readiness guard used by the existing isolation fixture. This is test synchronization only; retain the original failure.

Fourth native attempt passed both managed profiles but its default 30-second firstWindow restart wait expired during normal runtime startup. The failed-close path retained an old video handle; both fixture issues corrected (180-second startup window, reset handles). Its owned Electron PID11328 was closed normally after startup; no fixture runtime remained. Raw recordings/failure retained; no accepted restart claim yet.

C059 exact-head Linux 35979091296 finished 19/20: only GFM table-paste setup timed out, with other table checks 10/11 and all 19 other suites green. The actual failure still was inspected. Replaced the OS-dependent End/Enter fixture paragraph setup with one editor transaction and explicit focus/empty-paragraph assertions; slash keystrokes, clipboard conversion and server/reload checks remain unchanged. Targeted local and Linux validation pending.
