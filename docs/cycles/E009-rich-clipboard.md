# E009 — Preserve intent and content across clipboard formats

Editor lane on isolated `codex/editor-rich-clipboard` and upstream `codex/canvas-rich-clipboard`, based on E008 `d24c7a094` whose production bytes match E007 `d8fda9690`. Root owns the central queue and UI grants. No private server or foreground Electron is running.

## Reproduced baseline

Actual headless Chromium 151 loads the production Paper bundle and dispatches real ClipboardEvent/DataTransfer values. [Exact clipboard and PortableDoc results](../visual/rich-clipboard/before-fix/d8-audit.json) and stills preserve six cases:

- HTML-only image over selected text deletes the selected word and inserts nothing, with no notice. Mounted JSDOM reproduces the same assertion failure. ProseMirror consumes an empty parsed slice; this is not an uncontrolled browser-default claim.
- HTML table plus sibling image pastes the text/table but silently drops the image.
- Image file plus HTML table picks the image and omits the table. Explicit plain-text paste also picks the image, ignoring the requested plain text.
- Image inside a table correctly produces E007's no-op guidance. Nested details outside a table preserve their text, although disclosure semantics are not claimed.

## Bounded contract

Root approved a clipboard fidelity fix after this durable baseline. Explicit plain paste must win. Unsupported or empty rich parse must preserve selected human content with visible recovery. Audit the current image schema, uploader and URL/reference policy before supporting HTML images; do not fetch arbitrary external images as an incidental paste. Multiformat file/HTML can be alternate representations or distinct items: do not silently discard a file or the rich text merely by choosing one first. Prefer an exactly representable richer form where ownership is clear; otherwise give explicit no-op recovery.

Retain image-only upload, ordinary table paste, selection/Undo, IME, marks/links and acknowledged saves. Tests must cover mixed formats and unsupported nested images, along with native plain-paste intent. No production patch yet. Mounted failing regression is in the isolated upstream branch; no shared checkout or task database was altered.

Read editor matrix, source routing/API guidance and writing contract; ran plan/cycle. Locked root/upstream installs and Playwright Chromium passed. Upstream dependency audit retains 3 moderate and 1 high vulnerabilities; no dependency change. Next: commit baseline, audit image policy, implement the narrow clipboard decision contract with mounted/headless proof, then request a later actual UI evidence slot. No merge or deployment.


## Source checkpoint

Baseline is pushed as Barkdown ee21872 and upstream7488be2b8. Initial policy3c43a92e3 was too conservative for ordinary image copies; root review required supporting equivalent image renditions. Current upstream3495f545c adds plain-first selection, no-op preservation for unsupported images/empty rich slices, and an explicit ambiguity guard for distinct formats. One image file plus image-only wrappers, with no meaningful independent text/link/caption, uploads once and carries HTML alt. Matching source URL/alt in text/plain is treated as the same rendition. Files plus tables, extra images or semantic captions/links retain the clipboard and explain plain-text/drag-file recovery. No external image URL fetch/conversion was added. This scoped repair does not prove arbitrary HTML media fidelity.

Twenty mounted clipboard cases plus existing fourteen HTML cases, GFM/history/Figure guards and census passed. Actual headless Chromium ClipboardItem write and trusted Ctrl+V/Ctrl+Shift+V prove the normal browser format shapes; final clean3495 capture03-30-10 records source and bundle hash. Full upstream chain88553 passed; an additional frozen-source run is being retained to remove ambiguity from the line-ending-only3495 cleanup during the preceding run. Generated/served JS c19e9f0d8a4d9f75db653ad59b05b21eaa66e916 and CSS38197e09d17efc468a3dc875dbd59571e3aeb7c8 match in this isolated built checkout. Own server forced compile passed; no server was started. Root/app locked installs and app build passed; app dependency audit remains2high.

Actual Paper live harness is prepared for selected-text no-op, mixed-format notice at900px, plain save/native Undo+redo, equivalent and file-only real uploads, subsequent human typing and reload. It waits both host and canvas clean state. No live proof yet. Source commit precedes actual screenshots; named UI grant required after queued root/other lanes. No owned UI or private runtime. Next: finish frozen-source full test, commit harness, then wait for the named live window.

## Frozen-source validation

Exact upstream3495 full npm test session89587 completed exit0; [complete log](../visual/rich-clipboard/upstream-3495-full.txt). Earlier88553 started before the LF-only3495 cleanup and is retained only as prior semantic-source validation. The six-case tolerant pixel comparison binds before/after/difference SHA256 and received actual agent image review. All intended changes are explicit no-op/plain-text behavior; nested-details text is visually unchanged. This isolated headless gallery does not establish real server upload durability or app visual approval.

Live fixture additionally requires exactly two decoded image elements after reload, preventing an empty DOM list from satisfying the decode wait. No production source changed. No Electron/runtime is active; await root named UI grant, then actual Paper uploads/history/reload, deterministic review and live status.

## Native closeout — 2026-09-22

Frozen Barkdown25cb114/upstream3495 actual Paper run38052 passed using private lGwZMr. Initial revision1 advanced through plain2, native Undo3, redo4, equivalent-image upload6, file-only upload8 and human edit9; reload matches actual server blocks with exactly two decoded images. No external source-image requests. Unsupported/ambiguous paste preserved selected content and server revision; narrow900px recovery remained readable. [Native evidence and review](../visual/rich-clipboard/runs/2026-09-22T04-50-27-798Z/review.json).

Deterministic capture04-51-49 compared all21 states within tolerance and received explicit approval after all stills, differences and21 GIF frames were inspected. Native review covered9 full stills,112 continuous-video samples at2fps and46 decoded GIF frames. Final status66890/bPugOv passed with real Codex read/edit after Claude weekly limit; all5 stills and37 GIF frames inspected. Both private runtimes stopped normally and postmaster.pid absence was checked; UI slot released to root. [Original status manifest](../images/status/history/E009-25cb114.json).

This establishes the scoped clipboard repair on the connected3495 server bundle, not general mixed rich image/text support, old-server compatibility, fallback consumption or upstream merge readiness. E010 upload history and E011 consumption remain separate. Final npm run verify session45596 passed exit0: build, links, plan/cycle, current visual hashes and all concept/handoff checks. Ready for selective integration; combined-branch gates remain separate.
