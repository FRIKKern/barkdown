# C061 — Ordinary note API contract

C060 is accepted and pushed as `ada4cbb`. This bounded audit examines upstream `30c007e43` using a disposable real runtime. It does not create a product feature or activate migration. Legacy data and editor remain intact.

Preliminary source findings: generic creation writes drafts; createIfNotExists does not reserve the whole namespace; Paper content revisions and generic document revisions differ; published foreground catalogs omit draft-only notes; delete is not a demonstrated user-facing recovery contract. Verify these against actual HTTP responses before designing the adapter.

Next: run the committed probe through `app/tests/status-shots-isolated.mjs`, inspect all responses, record blockers and prepare the next implementation slice. No private runtime is running yet. C060 exact-head Linux35983714483 is running; earlier19/20 failure remains retained.

Visual scope: documentation and API audit only. C060 reviewed native/live/standard galleries remain unchanged; no ordinary blank-note UI or deletion-recovery proof is claimed. Run root verification at closeout. Continue through10:18:54 UTC minimum.

First private HTTP probe completed and stopped its runtime. Empty draft creation200 seeds an empty locked title plus body paragraph. Published catalog/read exclude it; drafts catalog/raw read include it. Bare Paper ops404; generic guarded title patch200 changes metadata but leaves the title block empty; stale title412 preserves state. One concurrent create won and one422 refused; this single race is not a global create-only guarantee. Delete200 removes the draft while history remains readable. Next probe checks exact draft addressing and the existing restore route before finalizing the contract.
