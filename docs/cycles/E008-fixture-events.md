# E008 — Make editor timing regressions deterministic

Independent editor lane on `codex/editor-fixture-events`; root owns the central delivery queue. This bounded cycle changes upstream test fixtures and documentation only. E007 production source and generated assets remain frozen for their separate final visual review.

## Evidence and contract

Actual Chromium clicking Keep mine blurs the native editor before acknowledgement. The JSDOM fixture's synthetic button click does not reproduce that focus change; Tiptap's programmatic blur runs in requestAnimationFrame. Its fixed 30 ms sleep can therefore acknowledge while the editor remains focused. The corrected fixture awaits the native blur and subsequent production flush task, asserting both native and Tiptap focus before and after. Original sibling, metadata, durable next edit, unload and identity assertions remain intact.

The press-answer watchdog fixture also assumed wall-clock scheduling: its 16 ms probe ran after 29 ms under load, placing the following 200 ms witness deadline beyond a 230 ms test sleep. The fixture now advances Node mock timers through the same production timers, retaining successful rerender and explicitly asserting no warning immediately before the deadline and a warning at the exact boundary. No production delay or assertion was weakened.

## Checkpoint

Upstream isolated checkout: `C:/Users/Frikk/.codex/worktrees/barkpark-fixture-events`, branch `codex/editor-fixture-events`, source `d24c7a094412e2d205ccdbe3107ac564646aa22a`, based on E007 `d8fda9690`. Locked editor dependencies installed. Save-ack and watchdog standalone tests passed. Full upstream `npm test` is running; do not claim that gate green until it completes. Existing failure evidence remains under the E007 handoff.

Read current handoff, plan, design decisions, acceptance and cycle rules; ran `npm run cycle` and `npm run plan`. No app behavior, bundle, CSS, runtime data or central queue changed. No owned Electron window/server is running. Root approved this fixture-only scope. E007's pending exact-source screenshots will remain the visual evidence for unchanged production assets; no screenshot restamping.

Next: inspect the complete upstream test result, preserve any newly exposed failure, push the bounded upstream checkpoint and finish documentation validation. Do not merge, deploy or mutate the shared upstream task database.

## Validated checkpoint

Full upstream `npm test` completed with exit 0 at `d24c7a094`: pretest, the complete main chain and posttest all passed, including save acknowledgement, contextual tables, press watchdog and the published-fixture lock. [Complete output](../evidence/E008/upstream-full.txt) is retained. Upstream checkpoint is pushed. Node prints its normal experimental MockTimers warning; it was not suppressed.

Only the two test files and `api/CLAUDE.md` differ from E007. Generated JS SHA1 `efec1f11583045c5bc023f8414363eed01725127` and CSS SHA1 `38197e09d17efc468a3dc875dbd59571e3aeb7c8` are unchanged. This does not establish upstream PR merge readiness or close G1.

Barkdown root `npm ci` and Playwright Chromium installation passed; [root concept tests](../evidence/E008/root-tests.txt) passed independently. [Root verification](../evidence/E008/root-verify-pending-visual.txt) passed build, source/links/status freshness, plan and cycle validation, then correctly failed the inherited E007 visual fingerprint. It is not a complete pass. No baseline was approved or restamped. The new HTML paste harness awaits its corrected E007 live/deterministic/status evidence in the coordinated UI queue.

Truth review: the app guide, plan and NEXT-AGENT product claims do not change for test-only synchronization. The current editor source remains E007; its handoff records the pending visual review. Root owns integration and central plan updates. No owned processes remain. Next action: close E007 with reviewed exact-source evidence, carry that evidence into this documentation-only branch without relabeling it, rerun root verification, then close E008.

## Closed checkpoint

E007 source/evidence `fdf6b9e`/`e989157` is now carried unchanged into this branch as `34eb68b`/`a195d1d`. Its original manifests and review hashes retain the actual source attribution. The dedicated live Paper test passed server revisions 1-6, native history/reload and actual Electron 200% zoom recovery; deterministic review and genuine Codex status also passed. Those production assets remain byte-identical in E008.

Final `npm run verify` passed in this isolated Barkdown checkout after the exact evidence import; [complete final output](../evidence/E008/root-verify-final.txt). Earlier failed verification remains preserved. Upstream `d24c7a094` passes its full npm chain, changes no runtime code and is pushed. No source or test changes remain uncommitted; no owned processes or pending capture windows. Root has the results for selective integration. Next action: root review/import, then a separately bounded editor task. Default upstream pin, G1/G2 and deployment state remain unchanged.
