# C038 — Elegant Paper callouts

Active on `codex/paper-polish`, starting at `6bd8fcf`. C037 is archived.

Host-only refinement of callout tone, border, typography and spacing. Preserve all seven tones, editable title/body, native folding and revision-checked saves. No vendor or persisted-model change, merge or deployment.

Validation and screenshot review pending. Next: implement and run real-server callout gallery, status capture, deterministic visual review and root verification. No owned services running at this checkpoint.

Source `600a0c5`: build and 31 Paper host checks passed. First isolated gallery failed at fixture publication (tag rationales too short); no editor or user data touched, private runtime stopped. Corrected fixture rationales and scoped the title selector to the upstream non-editable wrapper around the editable strong element. Recapture pending.

Gallery at `5e09e25` passed real-server body edit/reload and disclosure persistence plus narrow overflow checks. Image inspection rejected the title hierarchy: nested strong elements still ran inline. Corrected the selector to the actual labelled title, added native title editing and a computed-display assertion, and widened the review pane. Prior gallery retained as pre-fix evidence.

## Reviewed milestone

Implementation `ae8024f` (preceded by `600a0c5` and `5e09e25`). Build and 31 Paper host checks passed. Isolated callout gallery passed 4/4 assertions: seven tones/narrow overflow, native title save, native body save, and disclosure/body persistence after reload. Eight stills and six decoded GIF frames reviewed in `docs/visual/callouts/runs/2026-09-23T00-40-11-290Z`; named hash-bound review included.

Fresh isolated live status at 00:42 captured a successful Codex turn, five stills and 37 GIF frames, all inspected. Claude hit its weekly limit; Codex fallback succeeded. Dedicated gallery is provider-free. Deterministic 00-42-44 run: 40 stills within tolerance, unchanged geometry; 36 stills and eight GIFs byte-identical to prior reviewed evidence; four differing stills inspected. Explicit visual approval recorded. Both private runtimes stopped; no shared service changed.

Root verification pending. Truth review: PLAN, acceptance, design decisions and architecture remain unchanged because this is host CSS, not model/runtime work. P1, migration, portability and release gates remain incomplete. No merge/deploy.

## Closeout

Root `npm run verify` passed (build, types/source/link/freshness/cycle/visual checks and concept/handoff suites). `git diff --check` passed. No app source changed after captures. C038 is done; next action is user review on `codex/paper-polish`. Commit and push this evidence checkpoint, then confirm remote HEAD. All owned capture services stopped. No main merge or deployment. Full desktop, cross-machine portability and stage acceptance were not rerun or claimed by this CSS cycle.

Publication confirmed: `git push origin codex/paper-polish` advanced remote from `6bd8fcf` to evidence commit `1621d45`. This final documentation acknowledgement does not change app or capture inputs.
