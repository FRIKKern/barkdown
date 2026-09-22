# Structured table editing

Revision-checked edits target an existing table block and cell, preserve untouched metadata and rich content, and reuse visible editing/Undo. Exact structured export supports headerless, multiline and heterogeneous alignment; faithful uniform GFM remains available.

![Agent cell edit and human takeover](runs/2026-09-22T00-51-49-741Z/structured-edit.gif)

[Real Paper proof and narrow view](runs/2026-09-22T00-51-49-741Z/README.md) · [Handoff](../../cycles/E004-structured-tables.md).

## Changelog

- 2026-09-22: E004 source cd4b5c1/upstream01dfdd663; three real MCP edit/Undo/human-save/reload/export cases passed. Seven stills, full-video1fps samples and all GIF frames inspected. Earlier failed diagnostics retained under before-fix. API provider parity remains separate E005 work; no upstream merge or default bundle pin update.
