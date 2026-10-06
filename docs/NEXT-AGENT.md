# Current handoff

[C097 Windows return](cycles/C097-windows-return.md) is active on `codex/windows-return`, starting from `bb3c8ad7`. The Windows checkout now has all Mac delivery through C096 and Electron 44.5.1. Build and root verification passed at entry; current native desktop acceptance has not.

The isolated pinned runtime now passes hold/recovery and database crash/restart. Windows provider, browser bridge and Chromium import fixes pass focused checks; the full desktop queue is in progress. Next: finish `desktop-03`, commit implementation, then prove migration/recovery on disposable profiles and review current Windows captures. No Mac export is available here. The sibling Barkpark checkout and real libraries remain untouched. See the cycle for boundaries, checks, evidence and exact resume action.

The [Mac handoff](archive/2026-10-06-mac-handoff.md) retains the completed delivery history and outstanding cross-machine, signing and browser-owner checks. Migration remains provisionally about 75% by effort, range 30–90%, low confidence; recalibrate after Windows runtime proof. P2 is not accepted, and same-machine export/import does not establish cross-machine portability.
