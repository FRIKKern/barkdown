# C046 — Real migrated Paper checkpoint

Active on `codex/p2-migration`; draft PR #32. No merge, deployment or real-library writes. Consume private upstream `barkpark-paper-create` at `844ecd321` (stacked draft PR #20020). Preserve shared services and the user's app. The automatic run continues through at least 2026-09-23 21:43:38 UTC.

## Verified implementation

- `4b7a25d`: real Paper projection exposed the incorrect code `language` carrier. Production conversion now emits native `lang`; Markdown export retains legacy read compatibility. Full desktop regression passed, with the existing POSIX-only skip.
- `2b64534`: native input/filter trace proved inline newlines become rejected PM hardBreak nodes. Preflight now refuses hardBreak and literal inline CR/LF, retaining exact readable source/backup; code newlines remain supported. Seven preflight plus 22 staging tests passed. The original ten-case acceptance is still incomplete.
- `fe8696c`: native title field wraps with content sizing and responsive typography, preserving single-line stored titles, IME Enter, dirty/save ownership and retry/discard. Paper-host tests pass.
- Live nine-case rehearsal passes at `fe8696c`: real keyboard edits, exact saved Undo, server equality, reload and Electron restart; source, backup and workspace unchanged. [Gallery and failure trail](../visual/migration/README.md). No direct editor commands replace typing or native Undo.

## Remaining gate and exact next action

Finish fresh live status/deterministic captures, actual image/video inspection, root verification, evidence commit and push. Then keep C046 open for the tenth case: upstream must preserve hard breaks across native DOM parsing, PortableDoc serialization and Undo before preflight can permit them. Register/claim an upstream work item before implementation; never simply remove its serializer guard. Keep media, references, navigation activation and rollback as separate unproved P2 gates.

The Linux full parity run at pushed `962a28e` was 19/20 due to tablehead alignment-click timeout. Targeted rerun [35920198439](https://github.com/FRIKKern/barkdown/actions/runs/35920198439) passed; retain the intermittent failure, not a blanket clean full-matrix claim. Root verification before new captures correctly failed freshness at the code-language change; rerun after review.

Repository truth review and final process/commit state will be recorded before yielding. The most recent private rehearsal runtime stopped. No source changes are left outside the implementation commits; capture artifacts remain to be reviewed and committed.

Visual checkpoint at 25a61d5 reviewed five live Paper stills and 37 GIF frames after a real Claude edit, plus all 40 deterministic frames/eight GIF sequences (zero differences). Migration review inspected 14 stills, 51 editing GIF frames and eight restart video samples. The repository truth pass corrected historical anchors and added the current code-area changelog; conservative tripwires require one fresh capture after this documentation commit. Full final desktop regression remains running; no shared runtime was stopped.
