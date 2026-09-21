# C001 — Map profile ownership before implementation

Status: complete (documentation/design only). Parent: P1 / A1. No profile implementation or isolation proof is claimed.

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

The [ownership inventory and contract](../PROFILE-OWNERSHIP.md) audits actual modules and keys at merged baseline `b8e7bfb`. It covers outside-store canvas assets and browser partitions, shared provider credentials, profile-bound caches and background events, immutable run capture, backed-up adoption and interruption/rollback fixtures. Registry/adoption foundation is assigned separately to the next-cycle agent; no app files changed in C001.

## Next exact action

Run root verification, review the documentation-only diff and applicable visual evidence, then close C001 and archive its record. The next implementation slice captures provider run ownership before awaited SDK launch and removes mutable connection/token lookup. Preserve P1 pending until complete A1 proof.

## Resume after C002

C002 is merged through PR #29 at `b8e7bfb` (implementation `3e2ed6f`); [its handoff](C002-folder-context.md) records earlier validation and limits. The prior unmerged statement described the earlier push checkpoint and is superseded. No deployment was performed.

## 2026-09-22 checkpoint

Working in isolated `codex/cycle-current-12h`; no user data, shared service, CLI selection or sibling source changed. Root `npm ci` and Playwright Chromium installation passed; isolated app dependency installation is underway. Pending: root verify and C001 truth/screenshot review. Ownership decisions were coordinated with the registry and editor agents: UUID profile identity, app-only appearance/window bounds, captured connection and resource tuples; no switching UI before isolation proof.

## Closeout — 2026-09-22

Root npm ci, app npm ci and Playwright Chromium installation passed. Root npm run verify passed all source/type/link/roadmap/cycle/visual and historical concept checks. npm app install reported two existing high advisories; no dependency versions changed. Reviewed repository README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION and architecture: runtime claims remain accurate; corrected C002 merged status. Existing C002 visual approval is current; inspected its narrow workspace image and reviewed coverage limits. No app source changes, so no new capture required. No runtime/service started. P1/A1 remain pending.

Next: C004 immutable provider/run ownership. C003 additive registry/adoption fixtures proceed in the parallel next-cycle branch. This design milestone can be reviewed independently; no merge/deployment performed.
