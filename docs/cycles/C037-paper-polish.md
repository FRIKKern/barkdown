# C037 — Paper visual polish

User-requested follow-up to pushed C008 checkpoint `fd91c8b`. Work on `codex/paper-polish`; no merge or deployment. C008's completed record is preserved in `C008-completed.json`.

The supplied screenshot shows oversized section gaps/rules, inconsistent typography, faint completed tasks, an empty trailing table band and doubled code text. Audit found inherited root-level `--bp-*` aliases resolve against upstream reading defaults rather than the host's typography tokens. The host also overrides the transparent code input, exposing both editable and highlighted text.

Scope: repair the real Paper host's visual skin and refine its reading rhythm. Preserve upstream bundle, data model, operations, human takeover and save acknowledgement. Validate actual editor light/dark/narrow layouts, code input and table keyboard navigation; capture live status separately from deterministic fixture tours. Existing captures are historical until refreshed.

Next: implement and inspect the skin, run focused behavior checks, commit source, capture/compare/inspect/approve evidence, run root verification and push. No completion claim yet.
