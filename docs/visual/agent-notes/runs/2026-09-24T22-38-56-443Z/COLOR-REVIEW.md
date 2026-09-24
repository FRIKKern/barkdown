# README GIF color correction

Reviewed by Codex on 25 September 2026. The initial review missed a color cast from approximate palette lookup. This review supersedes its color-fidelity conclusion; [capture provenance and behavior results](REVIEW.md) remain unchanged.

The original palette already contained the exact dominant background colors, but conversion mapped RGB `(23,26,23)` to `(20,24,20)` and `(31,34,28)` to `(28,32,28)`, with further local color shifts. The corrected encoder selects the nearest palette entry using exact squared RGB distance. It preserves the source theme, cuts, size, frame timings and shared palette. Nothing is painted over or recolored in the source.

Inspected all 108 decoded output frames and compared a full-size edit frame with the source. [Measured comparison and output hash](derived/readme-color-correction.json) cover all 113 source samples. The two dominant background colors match exactly throughout. GIF remains a 256-color format, so text-edge colors are approximate. The corrected loop is 3 MB and 14.12 seconds.

[Corrected GIF](derived/readme-color-corrected.gif). The original asset and review remain as historical evidence. No app or capture-harness change, new runtime, or changed standard approval.

Validation: source-to-decoded-GIF color and timing checks, documentation/link checks, visual freshness checks and git diff --check passed.
