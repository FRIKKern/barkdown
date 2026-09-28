# C084 — macOS parity

**Outcome / scope:** development moves to a Mac for at least a week. Make the Windows-accepted desktop prototype run and test on macOS without letting Windows or Linux go untested, per [D-hosts](../DESIGN-DECISIONS.md#d-hosts--windows-macos-and-linux-are-all-first-class-2026-09-28). Measure first, fix with twins, add the per-platform CI lane, key visual approvals by platform. No product scope changes.

**Source / ownership:** Barkdown lane `codex/host-parity`. C083 is paused at its recorded policy decision and resumes after this cycle.

**Budget / stop:** one complete per-segment measurement of the desktop chain on this Mac, then the smallest fixes that turn it green with their Windows and Linux twins. Stop and record any failure that needs an app change rather than a test change; those are product decisions.

**Tripwires:** every skip named and owned; no Windows-only test loses its twin; the CI lane stays gated to `app/`; the visual baseline is not re-approved on a Mac until approvals are keyed by platform. Root `npm run verify` at closeout.

**Preflight:** Node 22.22.2, npm 11 lockfiles, Electron installs after the user chowned the root-owned cache. `TMPDIR` must be a real path on this host (see CYCLES hosts notes).

**Measured so far:** [evidence](evidence/C084/README.md). Unit files 105 of 110 with five Windows-only skips; the first live test fails on a hardcoded `Control+a`. Full per-segment measurement in progress.

**Next action:** read the per-segment results, add a platform-aware modifier helper to the tests and rerun the failing segments.

**Measured and fixed (2026-09-28):** [evidence](evidence/C084/README.md). Before: 68 of 80 segments; after: 80 of 80, with 649 unit tests (607 pass, 42 Windows-only skips) and eight recorded live skips. Two of the twelve failures were app defects on every platform (the staging copy under Node 22.23, confirmed by the Windows CI lane; an asset-fallback race). The rest were test chords hardcoded to Control, and flows that depend on Windows-only owned process trees or DPAPI, now recorded gaps rather than silent skips, pinned by `tests/host-skips.test.mjs`. The substantive macOS gap is product: owned agent and terminal process trees exist only on Windows.

**CI budget (2026-09-28, later):** after the Linux lane went green and one real Windows defect surfaced (the writer identity hashed the non-native real path, so 8.3 short names on the runner made one store hash two ways; fixed with `fs.realpathSync.native`), GitHub stopped starting jobs: "an Actions budget is preventing further use." Repeated three-platform runs, with macOS at ten times the Linux rate, exhausted the account's Actions spending budget; Barkpark's CI is queued behind the same limit. The lane now runs macOS only on pushes to `main`, nightly and on dispatch; pull requests run Linux and Windows. PR60 stays open until the budget is raised and the required Windows lane can run on the fixed head. Local evidence for the fixed head: the full chain green on this Mac and both fixed tests passing here.

**Visual approval on macOS (2026-09-28):** approvals are now keyed by platform; a Mac capture was inspected and approved beside the Windows baseline ([evidence](evidence/C084/README.md#visual-approval-on-macos-2026-09-28)). One product finding: Shortcuts labels say Ctrl on macOS. Also cleared today: 15.6 GB of CI artifacts; artifact uploads keep 7 days and cannot fail a green run; main-process-only changes carry a dated screenshot exemption; `npm run check` needs no temp-dir override on macOS.

**Local authority (2026-09-28):** the user chose not to raise the Actions budget; local runs are the delivery authority and hosted CI is reduced to Windows-on-PR for `app/` changes, with Linux, macOS, parity and visual bundles weekly or on demand ([CYCLES: local authority](../CYCLES.md#local-authority)). Receipt for this head: [checks-01](evidence/C084/checks-01/result.json), root `npm run verify` and the skip ratchet on this Mac (Darwin 24.3.0, arm64). PR60 merges on it.

**Owned process trees on POSIX (2026-09-28):** `main/goal-process.js` now contains the worker in a process group (detached leader, group id = pid) with the same receipts and identity as the Windows job object; verification sweeps an orphaned group when the recorded host is gone and answers only at zero; the owned agent is on for every platform. On this Mac: the five owned-process unit cases and the live goal, coordinator and recovery tours pass; still gated with a reason: the PowerShell terminal tour, the recovery review tour and DPAPI durability (ratchet: 3 unit, 3 live, 3 inline). Receipt: [checks-02](evidence/C084/checks-02/result.json).
