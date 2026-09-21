# C003 candidate — Recoverable profile storage foundation

Status: preparatory implementation alongside C001, not the central active cycle. P1/A1 remain pending. Branch `codex/cycle-next-12h`, baseline `b8e7bfb`. The current-cycle agent owns the ownership design and active queue.

## Bounded outcome

An additive, opt-in registry module and real temporary-filesystem fixtures prove versioned UUID profile identities, isolated bound stores, shell-workspace adoption with a byte-exact backup, interruption/retry, corrupt-pointer recovery and explicit rollback. No boot integration, switching UI, real-user migration, database copying, legacy deletion, deployment or merge.

C001 coordination settled UUID profile IDs and roots `profiles/<id>`; appearance keys `theme`, `sidebarWidth`, `chatWidth`, `windowBounds` remain app-wide. Unknown settings survive in the profile and the immutable backup. Per-chat folders remain in workspace data. The registry is not the mutable server URL.

## Prerequisites and limits

This slice adopts shell metadata/documents/attachments/receipts only. It refuses any legacy `local-barkpark` directory: a live database is not an export, and cold database/media ownership is a later proof. External Electron browser partitions and canvas bundles remain outside this migration. No production caller invokes the new module. It cannot establish full A1 or portability.

## Checkpoint

Read AGENTS, NEXT-AGENT, PLAN, DESIGN-DECISIONS, ACCEPTANCE/A1, CYCLES, C001 and visual rules. Ran `npm run plan` and `npm run cycle`; C001 remains planned in this isolated checkout until its parallel documentation checkpoint is imported. Root/app `npm ci` and Chromium installation passed. App audit reports two existing high-severity findings; no forced dependency upgrades were attempted.

Implemented additive `app/main/profile-registry.js` and integrated `app/tests/profile-registry.test.mjs` in the app test command. Twenty-four real filesystem checks pass, including eleven actual subprocess exits: seven adoption checkpoints, interrupted rollback, and three profile creation publication checkpoints. Creation retries supply a stable `requestId`; retry without it is intentionally a new creation. Unpublished orphan directories/generations remain for diagnosis. Unsupported/corrupt legacy JSON fails before publication; compatible unknown fields and document nodes remain intact. Windows case aliases and junction ancestors cannot bypass disjoint-root checks. Missing/corrupt registry pointers or missing profile directories cannot silently seed replacement workspaces.

Source originals never change. Absolute attachment references deliberately still reference the retained source; staging is **not cutover or portability**. Legacy writers must be quiescent; repeated hashes detect changes but do not lock an old app that ignores this registry. File writes fsync before rename; this is process-interruption proof, not a universal hardware power-loss guarantee. Recovery from a corrupt latest pointer explicitly restores the previous committed pointer and retains corrupt bytes. Rollback unpublishes the adopted profile while retaining source, backup and subsequent profile edits.

Full desktop suite is running. No managed database or capture service has started. Next: finish desktop checks, import the C001 contract checkpoint, commit implementation, capture and inspect deterministic/live evidence, run root verification, then evidence commit and push. No production caller invokes the module; P1 remains pending.
