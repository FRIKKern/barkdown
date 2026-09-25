# Notebook demo

Reviewed by Codex on 25 September 2026. Documentation/media refresh only; no product-stage completion or new standard visual baseline.

The [README GIF](readme-notebook.gif) gives Paper more room and uses an actual notebook with a quote, checklist, table, callout and code. It shows the agent selecting and replacing an opening paragraph, guarded Undo, human checklist/table edits and note search. The model responses are scripted through the real SDK. Documents and edits use an isolated real Paper server with disposable content.

Inspected all four native stills and all 230 decoded GIF frames, including selection/deletion/typing, Undo, table controls, the search overlay and the splice. Checked the result at 1200 pixels and an 830-pixel README width. Content stays within the document pane; the table and callout remain visible. Tool details briefly expand during execution and are folded through the UI. This is a wide desktop showcase, not new narrow-layout evidence.

## Evidence

- [Capture manifest](manifest.json): Barkdown `a772217`, clean app source, dark mode, 1600 × 1000, conversation width 35%. Exported Barkpark `f2528db` source and preserved working compiled artifacts were used in a temporary directory while the sibling checkout was undergoing integration. This does not verify those concurrent upstream changes.
- Native assertions passed: three Paper notes created; targeted edit preserves title and table; Undo restores exact pre-edit blocks; checkbox save settles; edited table text is read back from the server; search opens without typing into the document. Seven scripted model responses; no renderer or fixture errors. The capture closed its own app/runtime.
- [Full video](full-session.webm) retains startup and the save wait. [Lossless screenshot sequence encoding](encoding.json) and [uncut sampled loop](notebook.gif) retain the 55-second interaction sequence; raw PNG paths and timestamps are in the manifest.
- [Excerpt encoding](readme-encoding.json): 238 video samples at 8 fps, 29.75 seconds, 1200 × 750, 6.06 MB. The longer, detailed showcase exceeds the usual 5 MB target. Two continuous excerpts omit setup and a settled save wait; no playback speedup. The shared palette uses exact nearest-color lookup and preserves 135,628,535 sampled background pixels without error. Video compression and GIF text-edge approximation remain; no new brown palette cast was found.

The [capture recipe](capture.cjs) is a one-off native recording, not a new product test runner. Run from the repository root with a built private source in `BARKDOWN_DEMO_SOURCE`. To reproduce this excerpt, extract the last 65 seconds of the retained video with FFmpeg `-sseof -65 -i full-session.webm -r 8 -vf scale=1200:750 <frames>/%04d.png`, then run `python encode-excerpt.py <run-directory> <frames-directory>`. [Encoder](encode-excerpt.py) requires Pillow and NumPy. Frame hashes and exact source times are retained in the encoding record.

Three earlier candidates were rejected: `23-18-27` failed against the changing upstream build; `23-23-47` failed because the temporary source export lacked required source/dependency files; `23-29-35` had the wrong pane width, slow folding and a search shortcut typed into the focused editor. They are retained locally under `barkdown-notebook-rejected-captures-20260925`, outside the tracked gallery. None is presented as accepted proof. No old approved evidence was replaced or deleted.

Validation results are recorded in [validation.txt](validation.txt). Existing app source and registered capture harnesses are unchanged; standard visual approval remains separate.
