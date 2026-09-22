# C036 — Isolated capture lifecycle

Starting from d58a38b on isolated codex/capture-cleanup-12h. Root observed interrupted startup leaving a stale PID file in private wWdpO2; this lane neither touches that directory nor assumes a PID file proves a live process. No UI/database/provider runtime launched.

Audit: wrapper has no SIGINT/SIGTERM handling, dirty runtime source is merely recorded, and finally cleanup can mask the original failure. Existing LocalBarkpark.stop aborts startup and awaits its operation before owned driver cleanup. Scope is wrapper orchestration and controlled offline tests, not a claim that uncatchable process termination/power loss is recoverable or stale PID files should be deleted.
