# C025 — Editor cache integrity

Base6796a50; branch codex/cache-integrity-12h. Central C008 remains coordinator-owned; this bounded lane record is C025-cache-integrity.json.

## Reproduced failure and consumer audit

The production main resolver returned modified JavaScript under its old SHA and an invalid CSS digest, because readCache only checked file presence. Original report retained in evidence/C025-cache/before.json (temporary kaht24). Clean B with no cache used vendored assets, so no ordinary A-to-B fallback is claimed. Profile main IPC supplies each bound store canvas-bundle directory; switching reloads the renderer, resetting its shared bundle promise. Search HTTP has no shared result cache.

Renderer injects the returned file paths and displays source/server/SHA and error. It cannot redefine the custom element within one renderer. Changes must preserve this API and honestly describe fallback; vendored fallback is not upstream equivalence.

## Bounded implementation plan

Validate metadata schema, full JS/CSS digests and regular non-link ancestors/files. A bad cache is preserved but never returned for execution. Cache selection must match the requested server when connected. Publish pairs under both full hashes so a CSS-only update cannot overwrite the previous pair; stage into an owned unique directory and rename, then atomically publish current.json. Retain old pairs and abandoned staging rather than deleting evidence. Reading existing valid eight-character cache directories remains supported after full verification.

Tests use local synthetic HTTP servers and temporary A/B stores: corrupt JS/CSS, malformed/truncated metadata, traversal/junctions, same-slug ownership, CSS-only updates, interrupted publication and offline fallback. Actual UI consumer proof follows source commit and exclusive grant; no main/UI changes planned unless needed to expose error already supplied by resolver. No real content or shared source mutations.

## Checkpoint

Plan/cycle commands read; original failing fixture preserved. Dependencies, implementation, tests and evidence pending.

## Source checkpoint

Root/app npm ci passed (root0 vulnerabilities; app2 existing high), Chromium installed, app build passed. Seven focused Node groups pass, including actual child exits at pair/pointer rename. The resolver preserves valid old eight-character caches after full verification; new pairs use both full digests. A healthy server refetch of a corrupted existing pair now quarantines its verified-owned regular directory before rebuilding; unknown/linked entries refuse without mutation. Added regression covers repair and linked-pair refusal. All abandoned staging and old pairs remain intact. SHA checks establish accidental corruption detection, not source authenticity or adversarial same-user filesystem isolation.

Actual Electron fixture prepared/syntax checked: corrupt A must not execute; Settings must display fallback reason; B loads its separately verified cache on profile switch; restarting selected B with its cache renamed away uses vendor without A fallback. No Electron launched; awaiting coordinator grant after source commit. Current product changes confined to main/canvas-bundle.js; renderer consumer API unchanged. Full visual/live/root verification remain pending.

Source e95fcb6 pushed. Coordinator independently reran all7groups and accepted source review. Additional24 Paper-host JSDOM cases, media-upload captured-server checks and profile IPC guards passed (81313); no Electron launched. UI remains queued behind C020. While waiting, read-only C024 peer review identified missing/binary initial tree request invalidation and pending-save/Revert/profile-switch admission risk; sent to coordinator. Also reproduced pre-existing nested-junction file confinement gap only in disposable5zoY7d; no edits to C024. Cache source remains frozen.

Read-only C024 follow-up: independently reviewed16a2f33 and ran project-file-authority.test.mjs once, passed with temporaryrgiuXs. Independent tree generation and pending-save dirty/revert/refresh guards cover reported issues. No Electron/Barkpark launched. Separate junction audit retained in evidence/C025-cache/deferred-junction-audit.json, explicitly outside C025 source scope.

Read-only integration ece4626 missing-reference audit recorded in DRAFT-missing-reference-audit.md. Concrete missing-attachment pre-dispatch loss reproduced with actual persistence adapters (r3kG4y), sent to coordinator; separate from frozen cache source. No workers/UI/shared services launched.

Named C025 UI grant received. First npm test:canvas-cache stopped before Electron: actual-exit child fixture resolved app/main relative to root cwd, so standard app cwd failed module lookup (exit1 rather than17). Corrected fixture to require.resolve relative to its module; product unchanged. An initial correction command used wrong cwd and made no edits, repeating the fixture failure; corrected explicitly from repo root.

Actual consumer fixture b5c5fac/TrBILZ passed and stopped. Image inspection found narrow A and B provenance below the fold, so these original frames remain unapproved. Fixture-only correction scrolls the actual diagnostic into view before capture; product unchanged. Full desktop suite 90165 remains in progress before rerun.

## Evidence closeout checkpoint

Full desktop suite 90165 passed at b5c5fac (same product source e95fcb6). Fixture-only b93f832 corrected narrow framing; actual Electron UnDaEH passed, normal close/stopped. [Consumer evidence](../visual/cache-integrity/README.md): four full stills and all 19 samples at 4fps from two retained WebM files reviewed. Corrupt A never executed, B loaded only its cache, selected B restart without cache used vendor. Earlier TrBILZ framing remains unapproved/preserved.

Deterministic 71099 capture 2026-09-22T04-00-49-160Z passed; all40 stills and40 GIF frames reviewed. Comparison has only Settings not-connected provenance text, no geometry change; explicit approval recorded. Live status80551 against clean a544 private B3FvWn exited0, stopped and postmaster absence confirmed. Five full stills and37 GIF frames inspected. Claude hit weekly limit; fallback to real Codex succeeded (manifest chat.real=true/provider=codex), not a fabricated transcript. App source b93f832 and server provenance retained in status manifest. No unintended clipping or overlap in reviewed views. Root verify66376 passed; no P1/upstream-parity/portability completion claim.

Root verify66376 exited0: generated outputs, local links, status freshness, cycle checks, visual review hashes and all concept/handoff checks passed. C025 bounded outcome complete; C026 still awaits its own actual bridge/UI proof. No merge or deploy.

## Integration import

Selective import onto ea71199 preserves the combined queue, current status and approval pointers, C023/C024 code and C027 visual tooling. Original C025 live status is archived at [C025-b93f832.json](../images/status/history/C025-b93f832.json). Seven focused cache groups passed in the combined checkout; all28 consumer artifact hashes and the complete11-run comparison chain were independently verified. Original lane evidence is not approval of this new combined source; combined capture/verification remains coordinator-owned.
