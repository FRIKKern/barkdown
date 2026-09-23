# C038 — Elegant Paper callouts

Active on `codex/paper-polish`, starting at `6bd8fcf`. C037 is archived.

Host-only refinement of callout tone, border, typography and spacing. Preserve all seven tones, editable title/body, native folding and revision-checked saves. No vendor or persisted-model change, merge or deployment.

Validation and screenshot review pending. Next: implement and run real-server callout gallery, status capture, deterministic visual review and root verification. No owned services running at this checkpoint.

Source `600a0c5`: build and 31 Paper host checks passed. First isolated gallery failed at fixture publication (tag rationales too short); no editor or user data touched, private runtime stopped. Corrected fixture rationales and scoped the title selector to the upstream non-editable wrapper around the editable strong element. Recapture pending.

Gallery at `5e09e25` passed real-server body edit/reload and disclosure persistence plus narrow overflow checks. Image inspection rejected the title hierarchy: nested strong elements still ran inline. Corrected the selector to the actual labelled title, added native title editing and a computed-display assertion, and widened the review pane. Prior gallery retained as pre-fix evidence.
