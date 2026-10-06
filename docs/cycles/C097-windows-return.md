# C097 — Windows return

**Outcome / status:** active, 2026-10-06. Bring the Mac-delivered application back to a verified Windows source runtime, then rehearse migration and recovery on disposable profiles. Start: `bb3c8ad7`, branch `codex/windows-return`. C096 is delivered; its record is archived beside its handoff.

**Boundaries:** provider executable discovery, owned processes, profile runtime and migration/recovery. Preserve the sibling Barkpark checkout and all real libraries. Use an isolated checkout at `app/BARKPARK_REF`; no deployment, signing, sync implementation or real-library cutover in this checkpoint.

**During work:** toolchain/build probe; shell/provider unit checks; native terminal and profile checks; real runtime readiness, switch/restart, export/import and crash recovery. Fix failures at their owner rather than weaken assertions. Native tours run sequentially.

**Ready checkpoint:** app build, relevant complete desktop suites, root `npm run verify`, current Windows visual capture/compare/inspection/approval and live runtime evidence. Commit implementation before capture, evidence afterward. A changed runtime, harness or dependency invalidates its affected proof. Stop at a reviewable passing Windows checkpoint, or checkpoint a concrete external prerequisite that cannot be resolved locally. Initial investigation ceiling: two hours (planning estimate, not measured usage).

**Entry evidence:** dependencies restored from the lockfile; Electron 44.5.1; build and root verify passed. Selected checks: 60 passed, one POSIX skip, one shell test failure (Unix executable fixtures on Windows). Logs from that exploratory run are local, not delivered evidence. No current Windows desktop acceptance is claimed.

**Estimate:** retain the provisional migration estimate of about 75%, range 30–90%, low confidence until the Windows runtime journeys calibrate it. Mac implementation outpaced plan prose; reconcile current claims at the ready checkpoint without inventing a whole-project percentage.

**Repository / services:** current lane plus the merged `codex/effort-progress` branch; preserved detached/locked recovery worktrees in both repositories. Sibling Barkpark has untracked work and stays untouched. Next hygiene action: check remote ancestry/open PRs before retiring the merged local branch; inventory remaining recovery worktrees without deleting unique evidence. Owned hold/crash rehearsals have stopped their disposable runtimes.

**Next action:** finish the resumed Windows desktop suite (`desktop-03`), then commit implementation and run disposable migration/recovery and current visual gates. The owner confirms no Mac export is available here; actual cross-machine transfer remains unverified.

**First slice:** pinned source `944a57a1e` built with Scoop Elixir 1.20.1 / OTP 28 and Visual Studio 2026 x64 tools in `../barkpark-windows-return`. Real hold/reopen/restart/recovery passed (`evidence/C097/runtime-hold-01.log`). Provider discovery now respects installed executables, resolves standard Windows Codex wrappers to native binaries, and caches by provider/provenance. Shell/provider subprocess fixtures work cross-platform. Actual tools report Claude 2.1.274 and Codex 0.30.0 (both older than tested; no provider upgrade or real turn performed).

**Failed desktop checkpoint:** `desktop-01/result.json` retains the failed full run: the first 112 native preparation/writer cases and provider discovery passed; browser bridge failed on a Unix socket path and the updater test assumed macOS. Named-pipe bridge and explicit updater platform cases now pass focused checks. Continue with `desktop-remaining-plan.json`; no full-desktop pass yet. Tests are running on uncommitted changes; recapture only after the implementation commit.

**Second slice:** private Postgres death/restart passes (`evidence/C097/runtime-crash-01.log`). The browser tour found a macOS-only import implementation as well as host-specific fixtures. Native Windows/Linux Chromium profile roots now import from a private copy. The resumed Windows browser tour passes all 13 checks, including imported Favorites/history, downloads, find/zoom, blocking, cookies and permissions after restart. Its pre-commit run is diagnostic behavior evidence, not an approved capture. `desktop-02` retains the import failure; `desktop-03` resumes the full remaining queue.
