# HTML table paste health

HTML table paste preserves ordinary cell paragraphs, newlines, marks, links, alignment and supported body spans. Unsupported nested content retains the clipboard and offers keyboard-accessible plain-text recovery.

![Real paste, Undo and redo](runs/2026-09-22T02-51-36-738Z/html-paste-undo-redo.gif)

[Real Paper proof and review](runs/2026-09-22T02-51-36-738Z/README.md) · [Before-fix Chromium data](before-fix/9803-result.json) · [Matching Chromium comparison](comparison/comparison.json) · [Handoff](../../cycles/E007-html-table-paste.md).

## Changelog

- 2026-09-22: Source `fdf6b9e` / upstream `d8fda9690` passes actual paste, native history, human edit, acknowledged reload and recovery at actual Electron 200% zoom. Eleven stills, continuous video samples and all GIF frames reviewed. Earlier clipped-notice and premature-reload attempts remain preserved and unapproved. Full upstream gate repair is a separate E008 fixture-only checkpoint; merge gates and default upstream pin remain unchanged.
