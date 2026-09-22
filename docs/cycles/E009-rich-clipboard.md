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
