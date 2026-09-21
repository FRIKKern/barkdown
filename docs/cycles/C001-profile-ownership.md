# C001 — Map profile ownership before implementation

Status: planned. Parent: P1 / A1. No profile implementation or isolation proof is claimed.

## Goal and boundary

Inventory every persisted/cached object and define stable profile-qualified ownership plus backed-up adoption of today's workspace. Deliver a reviewed design and executable-test plan before adding switching UI. Excludes schema migration execution, real-user data changes, sync and removal of the legacy editor.

## Acceptance

- Inventory documents, media, conversations/parents, tabs, drafts, favorites, credentials, caches, edit receipts and in-flight runs; name actual modules, keys and current owners.
- Specify stable profile IDs, same-slug separation, app-wide appearance, per-chat folders and captured run ownership.
- Specify idempotent default-profile adoption, backup, interruption recovery and rollback; identify audited APIs versus open questions.
- Define the first isolated fixture/test cases for A1 and the next implementation slice. Do not mark P1 done from this design cycle.

## Checkpoint

Prepared from repository refresh `7b6445e`. Current desktop/runtime evidence is in [VALIDATION.md](../VALIDATION.md). No app files were changed to prepare this cycle. No service was started by cycle setup. Inspect current Git status before resuming; another session may have changed it.

## Evidence and open questions

No acceptance evidence yet. Locate current ownership in `app/main/store.js`, `documents.js`, `conversations.js`, `canvas-bundle.js`, `local-barkpark*.js`, and renderer `state.js`. Audit remaining storage/credential/media paths rather than treating this list as exhaustive.

## Next exact action

Read those modules and map each persistence key/file/cache to its current owner and proposed profile owner. Write the inventory and adoption design, then link it here. Keep this checkpoint current after each meaningful slice and before yielding.
