# C097 Windows return evidence

Windows 11 (`win32 10.0.26200 x64`), Node 22.13.1, Electron 44.5.1. Source starts at C096 `bb3c8ad7`; the [toolchain receipt](toolchain.json) names the isolated Barkpark build at `944a57a1e`. These are disposable profiles on one machine. No owner library or Mac export was used.

## Behavior and failures

| Receipt | Result and interpretation |
|---|---|
| [desktop-01](desktop-01/result.json) | Initial full desktop command stopped on Windows browser socket and macOS-only updater expectations. Preparation/writer, migration, authentication and native provider discovery had passed. |
| [desktop-02](desktop-02/result.json) | Browser import exposed a macOS-only implementation. |
| [desktop-03](desktop-03/result.json) | Resumed steps 1–14 passed; run ownership stopped on a Unix executable fixture. |
| [desktop-04](desktop-04/result.json) | All remaining steps 15–77 passed. Includes the 76-check interaction tour, DPAPI durability, abrupt chat/coordinator recovery, project buffers and terminal descendant cleanup. |
| [live-01](live-01/result.json) | Browser and terminal passed; migration launch stalled because a quoted Windows app path ended in a separator. Agent tool assertions passed, but image inspection rejected the transparent screenshot. |
| [live-02](live-02/result.json) | Final readable agent-browser images and six-part real Paper switch journey passed. Switch, rollback/reconciliation, interruption/Resume, editing, deletion recovery and scripted API-agent exact Undo: 487.571 seconds. Reclaim stopped before a kill on a launcher/main PID mismatch. |
| [live-03](live-03/result.json) | Correct main-process kill exposed the Windows launcher's different lifetime; the POSIX survival assertion failed. |
| [live-04](live-04/result.json) | Restart then exposed a real orphaned BEAM server occupying the port. Windows runtime containment was fixed with a kill-on-close Job Object before spawning descendants. |
| [live-05](live-05/result.json) | All three native scenarios passed: forced-exit reclaim (134.236 s), interrupted switch recovery (202.837 s), and two-installation export/import (430.168 s, including the portable harness’s remaining deadline timer). |
| [runtime hold](runtime-hold-01.log), [database death](runtime-crash-01.log) | Real private runtime hold/refusal/reopen/restart and database crash/restart passed. |
| [runtime boundaries](runtime-boundaries.log) | Seven passed; one POSIX process-group case skipped on Windows. |

The package desktop queue passed in resumed segments, not one uninterrupted final `npm test`. Receipts retain the source and dirty-state inventory used by each segment. Later changes have their affected native/focused checks. The seven Windows-only atomic-write cases were exercised; existing POSIX/provider-runtime skips retain their meanings. No additional skips were introduced.

## Native image inspection

- Browser: [final run](../C089/live/2026-10-06T21-57-34-496Z-browser/result.json), 13 checks plus narrow checkbox geometry and keyboard access. All 11 stills inspected, with full-size Settings and context-menu review. The context-menu intermediate frame includes its entrance animation.
- Agent browser: [final run](../C089/live/2026-10-06T22-05-22-799Z-agent-browser/result.json), 14 checks and 34 MCP calls. All six images inspected in [final contact sheet](agent-browser-final-review.jpg); the returned image was also inspected at full size. It matches guest dimensions and an opaque white website backdrop. This is a local fixture website and direct tools, not a real provider benchmark or account sign-in.
- Terminal: [run](../C090/live/2026-10-06T21-58-30-529Z-terminal/result.json), 13 checks. All four stills inspected in [contact sheet](terminal-review.jpg). The light frame specifically demonstrates live theme switching.
- Switch: [run](../C083/live/2026-10-06T22-05-35-899Z-switch-ui/result.json). All 19 stills were inspected in both contact sheets ([one](switch-review-1.jpg), [two](switch-review-2.jpg)), with full-size original-history and agent edit/Undo review. Test instrumentation emitted MutationObserver initialization warnings; product assertions passed. These are not an error-free console claim.

The earlier [agent contact sheet](agent-browser-review.jpg) is rejected diagnostic evidence, not current approval. Earlier browser and screenshot probes remain beside the final runs. Native captures precede the runtime containment fix; it changes process lifetime, not those rendered browser/terminal views. Final standard and isolated Paper capture pass in [capture-02](capture-02/result.json); [one named review](review.json) binds the inspected source and explicit approval.

- Recovery: [run](../C085/live/2026-10-06T22-25-02-679Z-runtime-recovery/result.json), both dark stills inspected at full size: interruption notice and completed restart.
- Portable profile: [run](../C085/live/2026-10-06T22-28-25-540Z-two-installs/result.json), both dark stills inspected at full size: import receipt and the imported conversation/Paper. The image fixture is deliberately one pixel; its loaded dimensions and server content are asserted, not inferred from its appearance.

## Scope and retained clutter

The original Barkpark checkout was not changed. The detached `barkpark-windows-return` checkout supplies the pinned build and isolated `bp.exe`; neither is a global installation. Failed crash rehearsals left two server descendants, stopped only after matching their recorded fixture ports, boot command and creation times. Disposable data and failed evidence are retained.

[Repository inventory](repository-inventory.json) records existing locked/detached recovery worktrees. They have not been deleted. Their next review belongs to the cycle owner after this Windows checkpoint; preserve unique work and evidence before any retirement. No real Mac-to-Windows transfer, clean Windows installation, signed updater, full live-writer corpus or daily provider benchmark is established here.

## Rejected broad capture

Capture-01 completed technically, but image inspection rejected its live Paper fallback: an obsolete fixture used name instead of tool, omitted done, invented usage and showed a proposal that never happened. It remains diagnostic evidence. The fixture now cancels unfinished turns, uses the actual completed-tool schema, visibly says sample transcript and asserts there is no running/undefined/proposal row before capture. Final approval requires a new capture; no previous approval was changed.

## Final capture review

[Capture-02](capture-02/result.json) passed: Paper 277.890 s, standard 25.968 s, comparison 5.575 s. Inspected all 44 fixture stills, 36 difference images and 44 decoded frames across nine GIFs, plus five live Paper stills and all 37 decoded GIF frames. Eight new fixture steps and four removed steps reflect the intentional retained-note/legacy-retirement coverage. Existing fixture GIF palette bands/padding remain. Light frames retain theme/contrast regression coverage; the root hero is dark. The live Paper transcript is explicitly a sample; displayed historical parity scores do not mean the complete matrix was rerun. See [review](review.json) and the [approved comparison](../../../visual/runs/2026-10-06T22-45-08-629Z/README.md).

[Closeout inventory](repository-closeout.json) retains worktree ownership and the retired merged branch. [Issue 4 snapshot](release-gate-4.json) confirms the current private-repository-read gate. [Final root verification](verify-02/result.json) passes in 43.443 s. [Verify-01](verify-01/result.json) stopped at picture retention before tests; the prescribed obsolete media was moved intact to `.git/recovery/C097-visual-retention` and remains in Git history at `928f1933` ([inventory](retention.json)). Current approval and Mac media are retained.
