# C036 — Isolated capture lifecycle

Starting from d58a38b on isolated codex/capture-cleanup-12h. Root observed interrupted startup leaving a stale PID file in private wWdpO2; this lane neither touches that directory nor assumes a PID file proves a live process. No UI/database/provider runtime launched.

Audit: wrapper has no SIGINT/SIGTERM handling, dirty runtime source is merely recorded, and finally cleanup can mask the original failure. Existing LocalBarkpark.stop aborts startup and awaits its operation before owned driver cleanup. Scope is wrapper orchestration and controlled offline tests, not a claim that uncatchable process termination/power loss is recoverable or stale PID files should be deleted.

## Tested implementation

Failed-firstd461e5b retains five failures out of seven actual-wrapper child-process tests: dirty host/runtime allowed, ignored startup/capture cancellation, and original childexit7 hidden by cleanup failure. The replacement helper registers SIGINT/SIGTERM around startup, capture and cleanup, aborts through the existing LocalBarkpark.stop lifecycle, and terminates only the directly spawned still-live capture child/tree (Windows taskkill /PID /T; a dedicated process group on POSIX). It then awaits child closure and invokes scoped runtime stop/release. Repeated signals share one cancellation. No unowned process lookup or stale PID removal occurs.

Both Git sources are checked before data allocation/driver start. Runtime source is rechecked after startup and capture, including commit identity. Host preflight rejects tracked changes and untracked source, while allowing untracked append-only evidence under docs visual/status/cycle-evidence and test-results. This is a checkpoint guard, not a guarantee that external writers cannot change host code after preflight. Built ignored runtime artifacts are not represented by Git cleanliness.

Primary failures and cleanup failures are aggregated in stderr and a private capture-result.json. A diagnostic-write failure also retains the primary error in the thrown aggregate. A retained postmaster.pid fails conservatively with wording that it does not prove a live process. Existing LocalBarkpark internal retry/release error behavior is unchanged; this wrapper can preserve only the error returned to it.

Final11/11 actual-wrapper cases pass using the real LocalBarkpark lifecycle, controlled SourceDriver and plain Node capture child in disposable Git repositories: normal, append-only evidence, dirty runtime/host, startup/capture/cleanup signals, child+cleanup failure, stale PID, report-write failure, and runtime source mutation during startup. No Electron, PostgreSQL or actual provider is launched. Tests emit the Node signal event to exercise installed handlers portably; they do not claim Windows terminal Ctrl+C delivery, taskkill interruption or SIGKILL/power-loss recovery. Private fixture directories are retained.

Cancellation relies on the existing driver's bounded/abort-aware operations; this change does not invent recovery from an indefinitely stuck driver or forcibly delete uncertain data. Real interrupted-runtime verification and combined visual/root gates remain pending named coordinator grants.
