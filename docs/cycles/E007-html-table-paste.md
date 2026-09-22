# E007 - Preserve HTML table paste

Editor lane on codex/editor-html-paste and isolated upstream codex/canvas-html-paste. Root owns the central P1 queue; E006 evidence stays unchanged.

## Reproduction and contract

Actual Chromium ClipboardEvent on production9803 reproduces: a headerless one-cell table containing First<br>Second is rejected by the existing visible unsupported-hardBreak notice; a cell containing paragraph elements spills those paragraphs outside an empty table; ordinary HTML alignment drops. Mounted JSDOM matches, but Chromium establishes this is not merely a fixture issue. Before-fix images and exact PortableDoc/PM JSON are retained in docs/visual/html-table-paste/before-fix.

Root approved basic HTML table preservation: header/headerless, paragraphs/newlines, marks/links and supported alignment. Audit existing spans; never trust arbitrary HTML source metadata. Unrepresentable nested structures must preserve the clipboard and offer a visible safe plain-text fallback instead of silently losing content. Test selection replacement, surrounding content, paste/Undo/redo, real acknowledged saves, continued human editing and reload.

## Checkpoint

Read handoff, parity/backlog, decisions, acceptance, cycle/plan and visual rules; historical feature list does not supersede P1. New isolated worktrees created from E006; locked installs begun. No production changes yet. UI window remains with other lanes; headless reproduction has stopped. Next: implement mounted failing regressions and narrow clipboard normalization using the real PM schema. Source commit precedes live images/video, actual review and evidence commit. No merge, deployment, shared task database or personal-library mutation.

Mounted eight-case regression passes, including exact paste/Undo/redo, paragraph/empty-line boundaries, marks/links, headerless, alignment/row headers, existing body spans, and no-op unsupported structure with a working explicit Shift-paste fallback. Existing table spans/header alignment, GFM paste/history and Figure guard tests pass. New source normalizes literal newlines because PortableDoc does not support PM hardBreak nodes; it does not weaken the global unsupported-content guard. Live server evidence pending.

Source checkpoint: 13 mounted cases pass, including selected text and Undo selection restoration. Added span preflight to prevent the existing forgiving grid conversion from dropping overflow; rowspan=0 and unsupported header spans retain the clipboard with visible fallback. Actual Chromium showed body text newlines collapsing despite stored fidelity; extended the existing canvas header pre-wrap rule to body cells and visually confirmed separate lines. Own server compile succeeded. Generated and served JS SHA1 a6be0468e1141463eb73ed0991f71979b98e2302 and CSS 5bbd021c61d93dc167b98af4972149dd806e506c match. Full upstream chain is running; existing baseline save-ack failure remains separate. Real Paper/visual capture is waiting for the coordinated UI window. No running owned runtime or Electron.
