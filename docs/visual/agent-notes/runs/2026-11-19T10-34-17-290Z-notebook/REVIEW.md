# Notebook demo, 19 November retake

Retaken so the root README loop shows the current account badge: a person icon, no letters. This is a documentation and media refresh only. It does not complete a product stage or set a new standard visual baseline. The [25 September run](../2026-09-24T23-33-22-364Z-notebook/REVIEW.md) stays as history.

The [README GIF](readme-notebook.gif) follows the same journey as before. The agent replaces the opening paragraph, guarded Undo restores it, then a person checks a task, replaces a table cell and finds a note. Model responses are scripted through the real SDK. Documents and edits use an isolated private Paper server with disposable content.

I inspected every one of the 149 encoded frames. The badge corner shows the person icon and "Barkdown" in every frame. In the table cell, typing replaces "Make it real" with "Try it today" and leaves nothing behind. The contact sheets cover the whole journey. I also checked the first and last full frames; no frame comes back at the wrong scale. The GIF is 1200 × 750, dark mode.

## Evidence

- [Capture manifest](manifest.json): Barkdown `254ea88`, clean app source, dark mode, 1600 × 1000 window, conversation width 35%. `upstream` names the private Paper runtime this run used: the local `barkpark-1482fb675` build given in `BARKDOWN_DEMO_SOURCE`. `measuredFps` is computed from the frame times.
- Native assertions passed: three Paper notes created; the targeted edit preserves title and table; Undo restores the exact pre-edit blocks; the checkbox and table cell saves settle; the cell reads back from the server as exactly "Try it today". Seven scripted model responses; no renderer or fixture errors.
- [Excerpt encoding](readme-encoding.json): every frame the capture recorded after setup, at its measured time. The encoder computes `measuredFps` from those times and refuses a run under the [README demo rule](../../../RULES.md#readme-demo)'s floor. Nothing is cut and there is no speedup; startup is left out. The shared palette uses exact nearest-color lookup, and reserved backgrounds have zero error. `atMs` and `capturedMs` are both milliseconds after frame capture began.
- [Full video](full-session.webm) keeps startup and setup.

## Recipe

The [capture recipe](capture.cjs) is the 25 September one with these changes:

- **Table cell keys:** on macOS, Home and Shift+End do not move within a line in a table cell, so the recipe uses Meta+Left and Shift+Meta+Right there and checks the exact cell text.
- **Frames:** frames come from the browser's own screenshot call (CDP `Page.captureScreenshot`) at the GIF's size. A full-size Playwright screenshot of the window could not keep the README demo rule's rate on this Mac.
- **Pixel scale:** the clip scale is set from a measured probe of the capture's own pixel scale.
- **One capture at a time:** captures are taken one at a time, so a still cannot come back at the wrong scale.
- **Clock:** frames start on a fixed clock that does not accumulate delays.
- **Rate check:** the recorder fails a run whose measured rate is under the floor. `node capture.cjs --check-rate <manifest.json>` checks a finished run.
- **Provenance:** `upstream` records the runtime the recipe was given.

The [encoder](encode-excerpt.py) takes every captured frame with its measured time instead of fixed cuts, writes the measured rate and refuses a run under the floor.

Run from the repository root: `TMPDIR=/private/tmp/ BARKDOWN_DEMO_SOURCE=<private runtime> node docs/visual/agent-notes/runs/2026-11-19T10-34-17-290Z-notebook/capture.cjs`. Then run `python3 encode-excerpt.py <new run> <frames directory printed by the capture>`.

An earlier take today, `2026-11-19T09-55-07-235Z`, was captured with full-size Playwright screenshots and measured under the floor. It is not used here and is left out of the tree; it remains in the branch history at `254ea88`.
