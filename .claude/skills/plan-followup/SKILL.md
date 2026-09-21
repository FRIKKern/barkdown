---
name: plan-followup
description: Continue Barkdown’s active dependable-workspace plan: profile isolation, one Paper note engine, recovery/portability, optional sync and ordinary installation. Use for continue, next task, work the plan, or an explicit stage/issue.
---

# Plan follow-up

## Choose the next bounded slice

Read `docs/PLAN.md`, `docs/NEXT-AGENT.md`, `docs/DESIGN-DECISIONS.md`, and the relevant stage of `docs/ACCEPTANCE.md`. Run `npm run plan` (or `node .claude/skills/plan-followup/scripts/next.mjs`). The queue is `docs/plan.json`. It validates local stage/dependency/evidence records and reports the next ready stage separately from release gates.

The old editor-first sequence and lowest-open-GitHub-issue rule are retired. Do not automatically work #4 before P1. Existing issue links preserve continuity; their state does not replace acceptance evidence. Historical files under `docs/archive/`, the PRD and the sizing review are references, not instructions. The editor matrix remains a regression gate.

User instructions take precedence. For an explicit issue, inspect its current description and map it to the active stage. For a general continuation, deliver a concrete slice of the next ready stage and update the handoff with the next slice.

## Implement against the real owner

- P1 starts with a persistence inventory, versioned stable profile identity, backed-up adoption of the current workspace, and a two-profile isolation test. Reuse the existing local runtime.
- Preserve source data and receipts. P2 retires the separate editor only after comparison, restart and interruption/rollback proof. P3 export requires a consistent supported database export and media inventory, not a zip of a running cluster.
- Profile ownership never changes a chat’s working folder. Capture both at run launch and route results to their original owner.
- Audit actual Barkpark APIs before promising export, sync or schema behavior. A content-format/schema/reader/editor change belongs upstream first, with its own tests and PR gates; desktop-only ownership work belongs here.
- Do not rewrite the provider runtime or replace functioning code with the concepts. Preserve full side chats, composer history, human-organized Pages and direct agent edits with human takeover and guarded Undo.

## Environment and verification

Use isolated user-data roots and private test clusters. See `docs/LOCAL-BARKPARK.md` for the Windows source launcher and `docs/VALIDATION.md` for command scope. Source startup needs a built checkout and the correct toolchain; it does not install/compile dependencies during desktop boot.

Inspect target paths and process ownership before operations. Never kill every PostgreSQL process, delete a live pidfile, silently change the CLI server, or stop the shared development server. If owned recovery cannot finish, preserve data, retain the error and report the exact prerequisite. Do not modify another checkout’s branch or unrelated files.

Run locked dependency setup and Playwright installation when needed, root `npm run verify`, and app/live tests relevant to the changed boundary. Real storage/recovery/sync assertions require real adapters. Mock tests prove orchestration only. For editor changes compare canvas and authoritative server data and preserve the existing repeated-live-run standard.

## Finish and report

Commit/push on a `codex/` branch. After app source changes, commit implementation, run `cd app; npm run shots`, then commit evidence so the screenshot freshness gate stays valid. No production deployment or public hosting is authorized.

Record exact source commits, commands, results and limitations in `docs/VALIDATION.md`; link evidence from `docs/plan.json` before marking a stage done. Update PLAN/NEXT-AGENT when the next slice or gate changes. Keep G1/G2 explicit and recheck external state before landing/releasing. Do not automatically mutate GitHub issues based on this helper’s output; obtain scope from the user’s task or the existing issue workflow. Close an issue only when its actual acceptance is met, preserving its history.

Tell the user what shipped, what was verified, what remains and the next slice. Do not report issue-count percentages as release readiness.

## Cycle checkpoints

Follow `docs/CYCLES.md`; run `npm run cycle`. Use the current cycle's bounded goal and acceptance before coding. Update its handoff during work and before yielding, including failed checks and untested changes. Close only with evidence, a repository truth review and screenshot review; archive the completed record before preparing the next cycle. A finished cycle does not automatically finish P1–P5.
