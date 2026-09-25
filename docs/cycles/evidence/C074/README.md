# C074 evidence — merged Paper baseline and original history

Source implementation3fb18db; capture serialization1573a6a; final capture inputs a126c71. Upstream b70214090 is merged and tree-identical to validated677992c51. No deployment in this cycle.

| Check | Result and evidence |
|---|---|
| Exact consumed source | [Byte reproduction and49 retained package/license hashes](consumption.json) |
| Focused behavior | [42/42](targeted.log): backup inventory, retained reader, history registry and vendor checks |
| Full desktop | [Exit0](desktop.log), implementation3fb18db with capture-only1573 follow-up; final harness separately revalidated |
| Real editor/server parity | [Initial19/20](initial-parity.json), [report](initial-parity.md), [IME failure](initial-parity-ime.log); overlapping native suites interfered with CJK composition. [Isolated IME4/4](isolated-ime.json) after desktop completion. This is not one full20/20 local run. |
| Real asset-refusal fallback | [Manifest](../../../visual/fallback-consumption/runs/2026-09-25T10-24-51-699Z/manifest.json), [review](../../../visual/fallback-consumption/runs/2026-09-25T10-24-51-699Z/review.json): exact bundled JS/CSS, real server save/reload, upload and history |
| Native original history | [Manifest](../../../visual/original-history/runs/2026-09-25T10-25-30-744Z/manifest.json), [review](../../../visual/original-history/runs/2026-09-25T10-25-30-744Z/review.json): ownership, unsupported originals, revision/proposal/receipt views, tamper refusal, restart and620px |
| Standard and live Paper | [Named combined review](review.json), [standard comparison](../../../visual/runs/2026-09-25T10-28-54-722Z/README.md), [live provenance](../../../images/status/history/2026-09-25T10-28-17-838Z.json) |
| Repository verification | [Exit0](verify.log) |
| Next boundary preparation | [Captured-writer audit](writer-boundary-audit.json), not implemented fencing |

All40 standard stills/40 differences/40 decoded GIF frames, five live stills/37 GIF frames,11 native stills/49 motion captures/140 video samples/44 decoded excerpt frames, and six fallback stills/77 video samples were inspected. Named reviews retain scope, exact sources and limits. Native raw recordings retain the startup pre-theme flash and viewport letterboxing.

The first native capture passed behavior but showed compositor clipping during concurrent screenshot/resize. It is [explicitly rejected](../../../visual/original-history/runs/2026-09-25T10-12-08-925Z/REJECTED.md), retained and superseded after harness serialization. The first fallback capture used correct bytes but a stale literal provenance label; final evidence reads the pin dynamically. Native keyboard/IME suites now run serially on one desktop. Failures remain evidence.

P2/A2 remains open: no real library moved, no authority selection, writer fence, rollback or retirement. Hosted integration proof is required before merging. Existing root overview remains applicable; Original history has its own [native gallery](../../../visual/original-history/README.md). No owned test service remains running.
