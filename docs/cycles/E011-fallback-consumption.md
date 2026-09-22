# E011 — Explicit Paper fallback consumption

Prepared isolated codex/editor-fallback-consumption from integration94aa3d7. E009/E010 native proof is a prerequisite; no pin or vendored asset has changed. Current source preference remains server, verified profile-owned cache, then vendor. A fallback update does not upgrade a reachable older server or valid old cache.

## Planned bounded proof

Create a loopback-only disposable proxy that refuses exactly /assets/bp-paper-editor.bundle.js and /assets/bp-paper-editor.css while streaming all other requests unchanged to an owned private runtime. The actual renderer must report vendored, load the committed JS/CSS bytes, then perform real Paper upload, save, native Undo/Redo, later human edit and reload. Exercise private a544 and later54579 separately; preserve actual origin/source labels. Reuse E010's genuine upload-response delivery boundary, never synthetic save acknowledgements. Unit checks must prove only those two asset paths are refused and request/response bytes, status and auth are forwarded correctly without logging credentials.

When source consumption is approved after native evidence, update only the two editor assets and exact parity pin. Preserve popup CSS, flags, Mermaid helper and Barkpark license. Ship the reviewed dependency notices alongside app assets; docs-only retention is not distribution completion. Keep upstream G1/G2 and old-server compatibility evidence independent.

## Paused preparation checkpoint

Root granted E009 the exclusive actual UI window, so E011 preparation is paused. No harness/proxy implementation yet, no private runtime or Electron started. Root locked dependencies installed; app locked install was initiated and is finishing. Read current handoff/A1 and integration source selection. Next: after E009 closes, implement the proxy with headless transport tests and the real fallback fixture before requesting a later named UI grant. Do not overwrite central C008 queue from this editor lane.
