# C110 — Real-library switch rehearsal on Windows

Planned 22 October 2026; not started. Record: [cycle.json](../cycle.json).

Why this cycle: the migration estimate's largest remaining working weights are "Prove the way back" (70) and "Switch and recover" (30), and both name the same gap: no library of realistic size has been switched, rolled back and resumed. C108 spent 84 root runs narrowing media custody; its open follow-up (task-0571ac0327eced87, owner Codex) is coverage work that does not move those rows. [A2](../ACCEPTANCE.md#a2--one-engine-without-lost-notes) asks for a complete owned library beyond the normal 60-item page, interruption of every phase and rollback from the retained source.

Affected boundaries: the preparation, switch and rollback owners that Settings › Barkpark drives ([migration evidence](../migration/README.md), [C083](C083-writer-admission.md)), the comparison view, and the isolated profile runtime on the pinned Barkpark. Nothing in Barkpark source, the admission controller, the runtime pin, the installer or media cleanup policy changes. No person's own profile or notes are used.

Stopping condition for slice one: a generator under `scripts/` creates a disposable library in a fresh isolated profile (target: at least 300 notes with internal links and backlinks, PNG media, human Pages organization and prior agent edit receipts), a scoped assertion proves its counts, and a read-only comparison of the generated corpus passes. Slice two drives the switch, interruption at each phase, Resume and rollback from the app's own screen and records measured durations and the reconciliation view. Budget: one bounded slice per session; stop and record on the first real failure.

Preflight for the next agent: `npm run cycle`; confirm `node_modules` and Playwright Chromium are healthy; confirm the pinned runtime boots in an isolated profile before generating anything.

Outcome / status, source / delivery, proof / limits, cost, repository and next action are recorded here as slices complete.
