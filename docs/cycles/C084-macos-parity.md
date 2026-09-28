# C084 — macOS parity

**Outcome / scope:** development moves to a Mac for at least a week. Make the Windows-accepted desktop prototype run and test on macOS without letting Windows or Linux go untested, per [D-hosts](../DESIGN-DECISIONS.md#d-hosts--windows-macos-and-linux-are-all-first-class-2026-09-28). Measure first, fix with twins, add the per-platform CI lane, key visual approvals by platform. No product scope changes.

**Source / ownership:** Barkdown lane `codex/host-parity`. C083 is paused at its recorded policy decision and resumes after this cycle.

**Budget / stop:** one complete per-segment measurement of the desktop chain on this Mac, then the smallest fixes that turn it green with their Windows and Linux twins. Stop and record any failure that needs an app change rather than a test change; those are product decisions.

**Tripwires:** every skip named and owned; no Windows-only test loses its twin; the CI lane stays gated to `app/`; the visual baseline is not re-approved on a Mac until approvals are keyed by platform. Root `npm run verify` at closeout.

**Preflight:** Node 22.22.2, npm 11 lockfiles, Electron installs after the user chowned the root-owned cache. `TMPDIR` must be a real path on this host (see CYCLES hosts notes).

**Measured so far:** [evidence](evidence/C084/README.md). Unit files 105 of 110 with five Windows-only skips; the first live test fails on a hardcoded `Control+a`. Full per-segment measurement in progress.

**Next action:** read the per-segment results, add a platform-aware modifier helper to the tests and rerun the failing segments.
