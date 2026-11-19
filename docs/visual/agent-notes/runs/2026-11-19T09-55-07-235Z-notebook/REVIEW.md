# Notebook demo, 19 November retake

Retaken so the root README loop shows the current account badge: a person icon, no letters. Documentation/media refresh only; no product-stage completion or new standard visual baseline. The [25 September run](../2026-09-24T23-33-22-364Z-notebook/REVIEW.md) stays as history.

The [README GIF](readme-notebook.gif) follows the same journey as before: the agent replaces the opening paragraph, guarded Undo restores it, a person checks a task, replaces a table cell and finds a note. Model responses are scripted through the real SDK; documents and edits use an isolated private Paper server with disposable content.

Inspected every one of the 150 encoded frames: the badge corner of each frame (person icon and "Barkdown" in all of them), the table cell in each frame (typing replaces "Make it real" with "Try it today", no leftover text), the contact sheets for the whole journey and four full frames. 1200 × 750 dark mode, 24.6 seconds, 0.95 MB.

## Evidence

- [Capture manifest](manifest.json): Barkdown `b0a424b`, clean app source, dark mode, 1600 × 1000, conversation width 35%. The private Paper server was the local `barkpark-1482fb675` runtime given in `BARKDOWN_DEMO_SOURCE`. The manifest's `upstream` and `upstreamArtifacts` fields are constants carried over from the 25 September recipe and do not describe this run.
- Native assertions passed: three Paper notes created; targeted edit preserves title and table; Undo restores the exact pre-edit blocks; checkbox and table cell saves settle; the cell reads back from the server as exactly "Try it today". Seven scripted model responses; no renderer or fixture errors.
- [Excerpt encoding](readme-encoding.json): all 161 frames the capture recorded after setup, at their measured times, about 8 fps. Nothing cut, no speedup; startup is left out. Shared palette with exact nearest-color lookup; reserved backgrounds have zero error.
- [Full video](full-session.webm) keeps startup and setup.

## Recipe changes

The [capture recipe](capture.cjs) is the 25 September one with one fix. On macOS, Home and Shift+End do not move within a line in a table cell, so the first macOS take typed into the middle of the cell ("Make it Try it todayreal") while its loose check still passed. That take was discarded. The recipe now uses Meta+Left and Shift+Meta+Right on macOS (Home and Shift+End elsewhere) and checks the exact cell text. The [encoder](encode-excerpt.py) now takes every captured frame with its measured time instead of fixed cuts, and also runs on older Pillow.

Run from the repository root: `TMPDIR=/private/tmp/ BARKDOWN_DEMO_SOURCE=<private runtime> node docs/visual/agent-notes/runs/2026-11-19T09-55-07-235Z-notebook/capture.cjs`, then `python3 encode-excerpt.py <new run> <frames directory printed by the capture>`.
