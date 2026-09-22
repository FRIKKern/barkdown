# Rich clipboard health

E009 is in progress. [Baseline failures](before-fix/d8-audit.json) reproduce selected-text deletion on unsupported HTML image paste, missing image siblings, and image-file precedence over rich/plain formats. The baseline script is retained as the executed historical source, not a command to overwrite this evidence.

[Trusted headless Chromium proof](native-headless/2026-09-22T03-30-10-747Z/result.json) verifies clean upstream3495f545c. One file plus image-only HTML uses the host uploader and retains alt text; explicit plain paste wins; ambiguous table/text plus images preserves the draft. No original external image URL is fetched. This is not every OS clipboard producer or arbitrary HTML media fidelity.

Actual Paper server uploads, history/reload, motion and narrow recovery evidence remain queued. [Cycle handoff](../../cycles/E009-rich-clipboard.md).
