# Runtime build helpers

The Windows reader builder in [runtime-wasm-assets.mjs](runtime-wasm-assets.mjs) archives the pinned Barkpark source, requires its Go version, builds into a new owned directory, checks gzip/loader identity and runs the upstream reader smoke tests. It retains source and compiler hashes in its report. Existing output refuses rather than being overwritten.

Go VCS stamping is disabled because the archive has no repository metadata: otherwise Go can record the surrounding Barkdown checkout. [Two-parent build proof](../docs/cycles/evidence/C098/reader-vcs-repair-review.md) compares complete WASM/gzip/loader hashes and reproduces the old defect with a control build. This repairs future reader builds; the previously tested carried runtime remains unchanged.

[build-runtime-release-windows.mjs](build-runtime-release-windows.mjs) consumes these assets when assembling a fresh Windows release. Full notices, prerequisites and ordinary installation remain separate gates in [C098](../docs/cycles/C098-windows-packaging.md).
