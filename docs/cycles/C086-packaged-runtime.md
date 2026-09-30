# C086 — A runtime without a checkout

**Status:** active, opened 2026-09-30. Stage P5 groundwork, started while [C085](C085-portable-profile.md) waits for the Windows machine ([D-cycle-order](../DESIGN-DECISIONS.md#d-cycle-order--p3-groundwork-starts-while-p2-waits-for-windows-2026-09-29), extended to P5 in [D-packaged-runtime](../DESIGN-DECISIONS.md#d-packaged-runtime--a-release-beside-the-checkout-2026-09-30)).

**Outcome so far:** a profile runs on one 143 MB runtime folder that carries the server, its Erlang and its Postgres. Nothing else is needed on the machine.

**What exists (`ecf26bc1`):**
- `scripts/build-runtime-release.mjs <checkout>` builds the upstream production release with its own Erlang (90 MB) into `runtime/` and stamps it with the commit it holds. `runtime/` is not committed.
- `app/main/local-barkpark-source.js` accepts a runtime folder that is a checkout or a release. For a release it creates the database, runs the release's migration and seed, and starts the server as its own process group, with a system-only PATH and no distribution port.
- The keys the production server demands are derived from the profile's database password.
- A profile chooses the release the way it chose a checkout: `barkpark.local.source` in its settings.

**Postgres (`74e060a8`):** `scripts/build-runtime-postgres.mjs` builds Postgres 15.18 from the official source (checksum verified), with citext, pg_trgm and pgcrypto, OpenSSL linked statically, and every library addressed relative to the binaries; the build fails if anything links outside the system. `build-runtime-release.mjs --add-postgres` puts it in the release as `postgres/`, and the driver prefers it over the machine's. One exception is patched into the Postgres build and said in the script: libpq's check against exiting calls is relaxed for the two that static OpenSSL brings.

**Proof:** [rehearsal](evidence/C086/live/2026-09-30T16-13-52-486Z-runtime-release/result.json), four checks in Electron with `PATH=/usr/bin:/bin:/usr/sbin:/sbin` and the database server running from the runtime folder: first boot in about 30 seconds, restart in about 5; a note written, found and read after a restart; export and import; a killed app whose runtime is reclaimed. The checkout path still passes its reclaim rehearsal.

**Limits:** one Mac. Release and Postgres were built on it, for macOS 15 on Apple silicon; a Mac without developer tools has not run them. The app runs from source under Electron. No Windows: upstream assembles the release for unix hosts only. An export names the commit from the release's stamp; without git history only the same version imports. The licences of what is carried are not yet in the third-party notices.

**Decisions:** [D-packaged-runtime](../DESIGN-DECISIONS.md#d-packaged-runtime--a-release-beside-the-checkout-2026-09-30).

**Next action:** build the macOS application with the runtime folder inside; stop when the built application starts a profile and writes a note with nothing else installed.
