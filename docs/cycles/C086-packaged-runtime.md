# C086 — A runtime without a checkout

**Status:** active, opened 2026-09-30. Stage P5 groundwork, started while [C085](C085-portable-profile.md) waits for the Windows machine ([D-cycle-order](../DESIGN-DECISIONS.md#d-cycle-order--p3-groundwork-starts-while-p2-waits-for-windows-2026-09-29), extended to P5 in [D-packaged-runtime](../DESIGN-DECISIONS.md#d-packaged-runtime--a-release-beside-the-checkout-2026-09-30)).

**Outcome so far:** a profile runs on a packaged Barkpark release. No checkout, no Elixir, no mix on the machine; Postgres is still needed.

**What exists (`ecf26bc1`):**
- `scripts/build-runtime-release.mjs <checkout>` builds the upstream production release with its own Erlang (90 MB) into `runtime/` and stamps it with the commit it holds. `runtime/` is not committed.
- `app/main/local-barkpark-source.js` accepts a runtime folder that is a checkout or a release. For a release it creates the database, runs the release's migration and seed, and starts the server as its own process group, with a system-only PATH and no distribution port.
- The keys the production server demands are derived from the profile's database password.
- A profile chooses the release the way it chose a checkout: `barkpark.local.source` in its settings.

**Proof:** [rehearsal](evidence/C086/live/2026-09-30T15-42-57-363Z-runtime-release/result.json), four checks in Electron with `PATH=/usr/bin:/bin:/usr/sbin:/sbin`: first boot in about 31 seconds, restart in about 5; a note written, found and read after a restart; export and import on the packaged runtime; a killed app whose runtime is reclaimed. The checkout path still passes its reclaim rehearsal.

**Limits:** one Mac, a release built on that Mac. Postgres is the machine's own. The app runs from source under Electron. No Windows: upstream assembles the release for unix hosts only. An export names the commit from the release's stamp; without git history only the same version imports.

**Decisions:** [D-packaged-runtime](../DESIGN-DECISIONS.md#d-packaged-runtime--a-release-beside-the-checkout-2026-09-30).

**Next action:** Postgres without a machine install: carry the server binaries beside the release, point the driver at them, and rehearse with Homebrew's Postgres hidden; stop when a profile boots with neither Elixir nor Postgres installed.
