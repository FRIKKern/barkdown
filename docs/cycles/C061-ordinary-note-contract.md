# C061 — Ordinary note API contract

Three disposable runtimes at upstream `30c007e43` completed the committed probes and stopped normally. [Assessment](evidence/C061/assessment.json) verifies18 observations against retained HTTP responses. [Audited contract and next adapter slice](../migration/ordinary-notes.md) is the current implementation brief.

A blank draft is supported without fake publication metadata. Exact draft ID is required for Paper ops; integer revision checks work. Title-block ops keep title and body consistent, while generic metadata title writes do not update the title block. Draft-aware catalog/search are required. Published and draft twins remain distinct. Existing delete/history/restore recovers a draft, but unconditional repeated restore overwrites later content, so it cannot be exposed as guarded Undo.

This accepts API knowledge only. No app source or capture input changed. C060 galleries remain applicable; no draft-note UI, lost-response, broad race, namespace-reservation or migration claim is made. Legacy store/editor and real libraries remain intact. Root verification passed. One final private probe will drop the create response after commit and reconcile through exact draft readback without replay; final evidence push follows.

C060 Verify CI failed on ignored log evidence, now explicitly staged and committed. The original failure log is retained. Visual CI passed; exact-head parity35983714483 is still pending at this checkpoint. One delivery branch/draftPR33 and43 locked historical worktrees remain. No shared service or upstream source changed.

Next: verify repository, commit/push this audit and inspect exact-head CI. Prepare the private draft-note adapter as the next cycle; do not retire legacy storage or start unsafe cutover. The run continues through10:18:54 UTC minimum.
