# E011 — Explicit Paper fallback consumption

Prepared isolated codex/editor-fallback-consumption from integration94aa3d7. E009/E010 native proof is a prerequisite; no pin or vendored asset has changed. Current source preference remains server, verified profile-owned cache, then vendor. A fallback update does not upgrade a reachable older server or valid old cache.

## Planned bounded proof

Create a loopback-only disposable proxy that refuses exactly /assets/bp-paper-editor.bundle.js and /assets/bp-paper-editor.css while streaming all other requests unchanged to an owned private runtime. The actual renderer must report vendored, load the committed JS/CSS bytes, then perform real Paper upload, save, native Undo/Redo, later human edit and reload. Exercise private a544 and later54579 separately; preserve actual origin/source labels. Reuse E010's genuine upload-response delivery boundary, never synthetic save acknowledgements. Unit checks must prove only those two asset paths are refused and request/response bytes, status and auth are forwarded correctly without logging credentials.

When source consumption is approved after native evidence, update only the two editor assets and exact parity pin. Preserve popup CSS, flags, Mermaid helper and Barkpark license. Ship the reviewed dependency notices alongside app assets; docs-only retention is not distribution completion. Keep upstream G1/G2 and old-server compatibility evidence independent.

## Paused preparation checkpoint

Root granted E009 the exclusive actual UI window, so E011 preparation is paused. No harness/proxy implementation yet, no private runtime or Electron started. Root locked dependencies installed; app locked install was initiated and is finishing. Read current handoff/A1 and integration source selection. Next: after E009 closes, implement the proxy with headless transport tests and the real fallback fixture before requesting a later named UI grant. Do not overwrite central C008 queue from this editor lane.

## Proxy and native fixture preparation

E009 native proof closed in1a9faf3; E010 remains queued, so assets/pin are still untouched. Both locked installs completed (app audit retains2high). Added a loopback-only disposable asset proxy and three Node transport/resolver checks: only the two exact editor endpoints fail503; API/media request bytes, authorization, query, response status/bytes pass unchanged; real resolver selects existing vendor from empty cache. An initial test omitted enabled:true and correctly exercised the disconnected fallback without network; corrected to the real connected configuration and all3passed. No production resolver behavior changed.

Prepared `app/tests/paper-fallback-consumption.live.mjs` from E010fixture88358f9, preserving actual host upload response delivery, repeated native Undo/Redo, later human save and server/canvas/reload assertions. It uses a fresh disposable user-data directory, explicit direct proxy connection, and asserts loaded script/style file paths and exact reviewed54579 hashes (JS c73a0f46c5402178721a9fe334a25a8a6f530d70, CSS38197e09d17efc468a3dc875dbd59571e3aeb7c8). Therefore the unchanged a544vendor cannot accidentally satisfy this future proof. Proxy counters retain no credentials/content. Shutdown closes only its own sockets; wrapper owns server cleanup.

Node syntax and three transport checks passed. No Electron or real runtime started; native fixture is unexecuted, full/visual gates pending until approved consumption. After E010native completion, vendor/pin/notices update gets its own source commit. Then run from app with BARKDOWN_EDITOR_CAPTURE=1 and BARKDOWN_TEST_BP_SOURCE pointing to the named built private a544 checkout, `node tests/status-shots-isolated.mjs tests/paper-fallback-consumption.live.mjs`; repeat separately on54579. Required named UI grants, still/video inspection, deterministic comparison/approval and final status remain. Current source precedence server→verified cache→vendor stays unchanged.

Root independently reran all three proxy checks and reviewed the fixture. Cleanup now closes the owned proxy in finally even if Electron close rejects. Native capture remains unexecuted and pin/assets unchanged.

## Authorized consumption source checkpoint

Root accepted E010 actual proof (Barkdown0d5ffa1/upstream54579) and authorized exact assets/pin consumption. JS/CSS now match reviewed54579 byte-for-byte; pin uses its full commit. Popup/flags/Mermaid/Apache license hashes remain unchanged.49 exact package notices plus source provenance now live under renderer/vendor/paper-editor-notices, covered by actual renderer/** packaging. A shipped provenance manifest and vendor README state branch source and unchanged source precedence. No new dependency or Electron version.

Twelve Node checks passed:7 existing cache integrity tests,3 proxy/resolver checks,2 distribution provenance/notices checks. App build passed. Native fallback fixture and its proxy are now visual inputs; new coverage page explicitly remains pending. Source commit must precede olda544 then54579 actual compatibility, deterministic review and final status. Root granted the next exclusive UI window after this source checkpoint; rootC030 follows explicit cleanup/release.

Offline notice verification passed49packages; root build passed. scripts/check.cjs correctly stops at stale inherited status screenshots, an expected pre-capture gate rather than a waived pass. Actual visual/live freshness will be refreshed after source commit.
