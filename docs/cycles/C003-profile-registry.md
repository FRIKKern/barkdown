# C003 — Recoverable profile storage foundation

Status: bounded staging foundation completed and validated; no desktop authority cutover. P1/A1 remain pending. Branch `codex/cycle-next-12h`, implementation `1505340`, capture source `5b0917c` (includes C001 ownership contract). The current-cycle agent owns the central queue and C004 captured-run work.

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

## Validation checkpoint — 2026-09-22

Implementation 1505340; imported C001 contract checkpoint as 5b0917c. Full desktop suite passed (76 checks plus direct edit, composer history and side-chat parity); final registry suite has 24 passing checks. Root verify passed. Deterministic capture 2026-09-21T22-23-18-613Z was inspected across all 21 action frames and five GIF sequences and explicitly approved; zero pixel/geometry differences, same environment.

First private live capture completed five stills and 37 GIF frames with a real Codex turn (Claude weekly limit), but its watchdog entered recovery during GIF encoding and the final server field is null. This attempt is retained at docs/images/status/history/C003-attempt1-null-server.json and is not sufficient final live provenance. Private runtime stopped; source log mentioned a build-directory lock. Coordinate exclusive built-source capture window with other agents before recapturing. No source/user data or shared service changed. Root verification passing does not erase this evidence gap.

## Completed evidence and truth review

Second capture ran after the editor agent released the built-source runtime window. It completed normally with no recovery event; private runtime stopped and the slot was explicitly released. [Final live manifest](../images/status/history/C003-5b0917c.json): clean Barkdown `5b0917c`, clean Barkpark `a5440345c`, private server `http://127.0.0.1:53009`, version `0.2.26.3877`, real Codex turn. Five stills and all 37 GIF frames were inspected: Paper content, slash menu, table/caret movement, quick open, Settings and light/dark presentation remain intact. Expected transcript/endpoint differences are not registry UI proof. Both attempts and prior media are retained.

[Deterministic review](../visual/runs/2026-09-21T22-23-18-613Z/README.md) and named approval cover 21 frames/five recorded action sequences with no pixel, geometry or environment difference. `npm run verify` passed; `npm run test:desktop` passed existing units, all 76 Electron checks, direct-edit, composer-history and side-chat restart suites. The final standalone registry suite passed 24 checks and the coordinator independently repeated it successfully. Final documentation/link/visual checks run before evidence commit.

Reviewed README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, architecture, ownership contract and visual-area changelogs. The [storage API guide](../PROFILE-STORAGE.md) explains staging, recovery and remaining authority boundaries. Existing product/sync/portability claims remain pending. The app source map names the additive module; no profile switcher or complete A1 journey is claimed. C001 contract was imported; central active queue remains owned by the parallel current-cycle lane. [C003 record](C003-profile-registry.json) closes only this bounded foundation.

No owned runtime remains. No real data migrated, no shared services stopped, no source branch changed, no deployment or merge. Disposable test and runtime roots are retained under OS temp. The first capture's build-lock/watchdog issue remains an integration finding: upcoming simultaneous-profile runtime proof must address concurrent use of one built source, not assume serial captures prove two active runtimes.

## Next exact action

Implement profile-owned runtime descriptors and independent HTTP/Postgres ports, plus reference-counted foreground/run leases. Selecting B must retain A while a captured run owns A's lease; release on provider cleanup, not merely a done event. Coordinate the exactly-once awaited finalizer with C004. Then prove two disposable live runtimes with the same slug and media, explicitly investigating shared Mix build locks. Keep boot/authority cutover separate until attachment remapping, external sessions/caches and existing cold-runtime adoption are proven. Do not migrate the user's data as setup.
