# C019 project buffer preservation

Isolated branch codex/project-buffer-preservation-12h starts at 1c0da0b. C016 remains active in its separate worktree; its parent snapshot here is not completion evidence. No runtime/UI launch authorized yet; root coordinates input windows.

A1 audit found index.js calls dirtyCount() before profile switch, while project.js filters every key by root + ::. Undefined root counts no ordinary buffers, so intended global refusal is ineffective. Preserve per-root semantics for badges/close warnings. Do not autosave/discard or change unrelated profile behavior.

Plan: reproduce using actual exported helper and multi-folder buffers; smallest fix; actual disposable Settings switch refuses and keeps unsaved text/profile/disk bytes, then explicit Save allows switch. Node work first. Commit source before new visual/status evidence. P1 remains open.

Dependencies: root npm ci passed (31 packages/0 advisories); app npm ci running. Implementation/tests not yet changed. Next run npm run cycle, add failing helper regression, then fix. No owned processes.

Node regression reproduced 0 versus expected3 through the actual exported renderer helper before the fix. Minimal project.js change treats omitted root as all buffers and retains exact root-prefix checks; regression now PASS, including same-file names in different roots, clean buffers, prefix-adjacent roots, nonmutation and saving only one folder. App build, fixture syntax and cycle structure PASS. App npm ci completed (536 packages/2 existing high advisories); Chromium installed. Root verify stops at inherited stale status provenance c375466 versus5a3a502; new visual/status evidence not yet captured. Actual project-buffer-profile.live.mjs prepared but deliberately NOT launched while other agents own input windows. No runtime/UI processes owned. Source checkpoint next, then wait for UI grant; C016 remains unchanged.

Actual Electron fixture at clean e68a72e PASS, exit0: Settings switch refused with dirty CodeMirror buffer; A owner, unsaved text and disk bytes remained intact; explicit Save then B switch succeeded. Disposable QYYjif fixture stopped normally. All three full-size frames personally inspected (unsaved marker/footer, refusal toast, saved B view), and derived GIF retained in docs/visual/project-buffers/runs/C019-e68a72e. Deterministic visual/status workflow and final root verify remain pending; C019 stays active. No C019 process remains. C016 separately holds a544/input for its granted retry.
