# C037 — Paper visual polish

User-requested follow-up to pushed C008 checkpoint `fd91c8b`. Work on `codex/paper-polish`; no merge or deployment. C008's completed record is preserved in `C008-completed.json`.

The supplied screenshot shows oversized section gaps/rules, inconsistent typography, faint completed tasks, an empty trailing table band and doubled code text. Audit found inherited root-level `--bp-*` aliases resolve against upstream reading defaults rather than the host's typography tokens. The host also overrides the transparent code input, exposing both editable and highlighted text.

Scope: repair the real Paper host's visual skin and refine its reading rhythm. Preserve upstream bundle, data model, operations, human takeover and save acknowledgement. Validate actual editor light/dark/narrow layouts, code input and table keyboard navigation; capture live status separately from deterministic fixture tours. Existing captures are historical until refreshed.

## Results

Source `0b25014` repairs the locally resolved typography aliases and transparent code input/highlight alignment. It reduces title/section scale, removes the oversized section divider, improves task contrast, fits tables to content and introduces muted green callouts. Vendor code and persistence behavior are unchanged.

- `npm --prefix app run test:paper-host`: 31 host cases pass.
- Isolated live status at clean `0b25014` / Barkpark `bf23f773`: real Codex read/edit, five stills and 37 GIF frames reviewed. Light/dark typography, menus, table editing and code rendering pass. [Hash-bound review](../images/status/review-2026-09-23T00-18-06.json).
- Deterministic run [00-18-21](../visual/runs/2026-09-23T00-18-21-531Z/README.md): all 40 stills and decoded tours inspected and explicitly approved. No changed geometry or above-tolerance pixels; this fixture tour does not contain live Paper.
- `npm --prefix app run test:paper-host:isolated` at `ff0a163`: four real-server scenarios pass (delayed save/navigation, native Undo/Redo, offline retry, explicit discard). Nine checkpoint stills reviewed, including narrow 760px layout. [Source-bound manifest](../visual/paper-save/runs/2026-09-23T00-21-10-250Z/manifest.json). This narrow fixture covers heading, body and error controls, not every rich block at every pane width.
- `npm run verify`: passes build, repository/cycle/visual checks and concept suites. Both private runtimes stopped normally; user CLI unchanged.

The look is ready for user feedback. This is a host-skin refinement, not a new editor engine or P1 completion. Existing fixture GIF quantization remains outside this scope. Next: publish this reviewable branch for hands-on testing; no merge or deployment.

Final documentation recertification: renderer README changes correctly triggered both freshness checks. Deterministic00-22-54 is explicitly approved; live status was recaptured at e57b019 with five stills/all37 frames reviewed in docs/images/status/review-C037-final.json. Product CSS remains0b25014.
