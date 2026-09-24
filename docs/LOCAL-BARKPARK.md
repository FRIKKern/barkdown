# Local Barkpark runtime

Barkdown can own a real Barkpark process and a private PostgreSQL cluster for each local profile on Windows. This is the source-checkout path before a packaged Barkpark release is available. Profile isolation is accepted; managed-local ordinary Paper notes have human/agent editing and deletion/recovery evidence. Migration activation, portability and cloud sync remain unfinished; see [current acceptance](VALIDATION.md).

## Start it

1. Prepare a Barkpark checkout with its Windows toolchain and build `api` in the required Visual Studio compiler environment. The launcher uses the Scoop Erlang, Elixir and PostgreSQL installations, avoiding stale system versions. It does not install tools or compile dependencies during desktop startup.
2. In Settings → Barkpark, choose **Local Barkpark**, select that checkout, enable the library and save. Enable fenced writes to edit its papers.
3. Settings reports starting, ready, recovering or failed. **Open data and logs** opens the owned directory; **Retry startup** retries after a failure.

The HTTP port defaults to 4540, PostgreSQL to 5540. Both bind to IPv4 loopback. The persisted `barkpark.local` settings also accept `port`, `pgPort` and an optional PostgreSQL `pgBin` directory. Busy ports are refused; existing services are never adopted or stopped. The development instance on 4000/5432 and the CLI's active server remain unchanged.

Before running checks from a separate shell, verify the actual executable paths and versions rather than assuming the desktop launcher's selection applies there. Use the selected Scoop Elixir/Erlang pair; upstream Bash/Python checks need a working Python invocation inside that shell. Follow the [preflight protocol](CYCLES.md#preflight-and-integration-first) and retain the successful invocation in the cycle evidence.

## Ownership and data

The profile runtime owns PostgreSQL, media, search state, bundle spill files and logs under its store's `local-barkpark/runtime` directory. The older app-wide `local-barkpark/default` directory is an adoption source, not a shared destination for new profiles. Credentials remain in protected settings storage. First boot initializes a password-authenticated cluster, runs Barkpark's own migrations, then its clean seed with a generated admin token that is never printed. Later boots migrate without reseeding. The checkout's development database is never selected.

The source bootstrap overrides the repository and endpoint configuration before starting Barkpark. It uses `mix run --no-start --no-compile --no-halt`; all content operations remain Barkpark's. A per-directory lease prevents concurrent Barkdown owners. A stale lease is retained as evidence, and an already-running orphan database is refused rather than taken over. Recovery after the entire desktop process is forcibly killed is not yet automatic.

Readiness requires completion of migrations/seed, a new PostgreSQL connection executing `SELECT 1`, and operational database, migrations and plugins in `/status.json`. Mail delivery is not required for the local editor. Paper IPC waits for readiness. New agent runs refuse while the local service is unavailable.

Health checks run every five seconds. Failure restarts the owned Phoenix process and private cluster, with at most three automatic recovery attempts per explicit start. Startup checks inspect new PostgreSQL log output for Windows error 487/shared-memory worker failures. Shutdown uses a scoped `pg_ctl` fast stop, then immediate stop if necessary; it never kills every PostgreSQL process or removes a live pidfile. If shutdown cannot establish that the cluster stopped, ownership is retained and the failure is reported. An explicit retry resets the recovery budget.

Paper recovery preserves the existing canvas. Clean views refresh; failed initial opens retry on readiness. A queued edit waits for restart. An uncertain write retains the existing revision-checked Retry/conflict flow rather than blindly replaying a mutation. Normal app quit waits for its runtime shutdown.

## Verification and remaining scope

`cd app; npm run test:local` boots isolated temporary clusters and the real checkout. It checks authenticated reads, database termination and recovery, restart, Electron paper editing across recovery, Settings status, and quit cleanup. It leaves the temporary data for diagnosis. Set `BARKDOWN_TEST_BP_SOURCE` to use another built checkout. No cloud documents or development database are modified.

`npm test` includes lifecycle tests for single-flight startup, retry limits, cancellation and ownership refusal. Windows worker-failure detection can be injected in the unit suite; actually provoking OS error 487 is not a reliable test precondition.

Follow the [current handoff](NEXT-AGENT.md) for integration and migration work; the [plan](PLAN.md) owns the remaining recovery, portability, sync and installation sequence. A bundled release/toolchain and non-Windows launcher remain future work. Use disposable profiles and an isolated user-data root for tests; never use a person's library as a runtime fixture.
