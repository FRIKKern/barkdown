# Runtime build helpers

The Windows reader builder in [runtime-wasm-assets.mjs](runtime-wasm-assets.mjs) archives the pinned Barkpark source, requires its Go version, builds into a new owned directory, checks gzip/loader identity and runs the upstream reader smoke tests. It retains source and compiler hashes in its report. Existing output refuses rather than being overwritten.

Go VCS stamping is disabled because the archive has no repository metadata: otherwise Go can record the surrounding Barkdown checkout. [Two-parent build proof](../docs/cycles/evidence/C098/reader-vcs-repair-review.md) compares complete WASM/gzip/loader hashes and reproduces the old defect with a control build. This repairs future reader builds; the previously tested carried runtime remains unchanged.

[build-runtime-release-windows.mjs](build-runtime-release-windows.mjs) consumes these assets when assembling a fresh Windows release. Full notices, prerequisites and ordinary installation remain separate gates in [C098](../docs/cycles/C098-windows-packaging.md).

[audit-runtime-notices-windows.mjs](audit-runtime-notices-windows.mjs) can bind the reviewed reader originals through the optional `reader` field in retained provenance. [reader-notices.mjs](reader-notices.mjs) checks the pinned source/compiler/module/text declaration and actual complete asset variant; unknown or altered inputs refuse before output. [Real audit and refusals](../docs/cycles/evidence/C098/reader-binding-review.md) retain all previous notices and nineteen reader originals. Missing reader provenance keeps the frontend gap explicit; this audit remains incomplete distribution preparation.

The P5 roadmap detail links the reviewed complete LiveView client/source correspondence; the active cycle retains the original compiler/configuration mismatches and notice limits. No runtime or renderer bytes changed in that evidence checkpoint.

The Windows notice audit accepts optional reviewed LiveView inputs through `liveview-notices.mjs` and its whole-client/source/compiler/20-input/two-original pin. It binds both complete notices to actual client bytes, refuses changed or unknown metadata before output and preserves old inputs with explicit gaps. Full embedded/frontend/native/source and installation closure remains separate.

The Windows auditor uses `client-notices.mjs` to bind optional reviewed Phoenix/xterm whole bundles and three package originals. Phoenix source reproduction stays distinct from published xterm dist-byte concatenation; unknown metadata, assets and original bytes refuse before output. Reader and LiveView associations remain separate. Broader editor/font/player/embedded/native/source and installation obligations remain open.

The offline runtime auditor binds all three measured Paper assets, six fonts and both player assets through `frontend-notices.mjs`. Its fixed graph preserves 45 named package roots, including both nested/root highlight.js versions, and 51 whole original texts. Published dist, font reproduction and selected Paper compilation have separate limits; this adds no installer or complete distribution approval.

Resolve each compiled input through its nearest package.json with a package name; ESM format-only package scopes are not dependency roots. Preserve the full installed root path as well as name/version: nested and root packages can share original text while remaining distinct compiled inputs.

Before source-bound checks, ensure generated code uses LF and compare staged owner bytes to the tested bytes. A trailing newline normalized only by Git can invalidate a raw source receipt even when JavaScript behavior is unchanged.

The retained fixed VC candidate graph separates measured package-import roots from optional candidate modules and unresolved external/API-set names. Native/parser table equality supports static correspondence; it does not establish a loader search path, runtime minimum, ABI or installation subset. No production arbitrary-PE graph API was introduced.

[vc-runtime-registration.mjs](vc-runtime-registration.mjs) interprets explicitly captured x64HKLM registry views offline. It requires typed values and coherent numeric tuples, preserves missing/incomplete/unreadable/conflicting states and leaves minimum/loader/installation unknown. It performs no registry or application/installer operation. Native developer-host observation and captured-input refusal proof are in the [VC preparation review](../docs/cycles/evidence/C098/crt-detection-review.md). When adding a root check, prove that intentional package.json command delta separately from unchanged prior source owners.

For new raw evidence folders, set -text before first staging. If attributes change after staging, Git may keep an unchanged-stat cached blob: refresh that owned entry explicitly under text:unset and compare its bytes. Retain original diagnostics and normalized index controls; style checks apply to authored source/prose while raw evidence is verified by exact bytes. Use saved scripts and stop dependent commands on every failure.
