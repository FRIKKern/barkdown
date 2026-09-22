# C033 — trusted context at reservation

Base a107075, isolated codex/context-reservation-12h. Original reproduction inspected and retained: disposable registry/mock runtime acquisition proves stale A session accepted into changed B. Failed-first9tests:7fail,2draft-only pass. Both ordinary followup on goal-created side chat and actual createGoalProvider adapter covered. No UI/runtime launches.

Plan: trusted snapshot of dispatch-relevant chat context checked after runtime acquisition and again before durable reservation. Reject with BARKDOWN_SEND_NOT_STARTED, release lease, preserve newer folder/draft. Goal scheduler sees prelaunch rejection, not an accepted attempt. Draft/navigation-only changes allowed; existing captured runs stay owned.

## Source checkpoint

Shared chat-context captures a fingerprint of raw saved provider, folder, context version, model/effort, parent/goal, sessions/seen and prior message/API history. Draft/navigation excluded; effective default provider stays in immutable settings and does not spuriously mismatch raw null. Profile resolver rechecks after runtime acquire and releases lease on refusal. Repository begin repeats guard before mutation, requires snapshot (no missing-snapshot compatibility bypass), and writes captured version to attempt. Duplicate existing reservations still return fresh:false; no replay. Goal adapter uses the same trusted resolver/repository, rejects before acceptance and releases exactly once.

15context cases PASS: both ordinary follow-up on goal-created side chat and actual goal provider adapter; folder, away/back, model, provider, session changes refuse; draft-only and default-provider cases dispatch; late mutation between resolve and begin also refuses. All refused paths retain newer draft/folder and create no attempt or stale session. Related goal-provider/service15cases PASS; workspace repository, profile service, chat recovery, deterministic three-worker integration, shared send-preservation/boundary suites PASS. Early chat-recovery invocation before app install failed missing lucide; rerun after npm ci passed. No UI/runtime launches or native transport claims.

## Validation handoff

Source100e539 pushed. Root/app npm ci and Chromium install passed (two inherited high app audit findings, no force upgrade); desktop build passed. Root verify failed source freshness100e539 vs global e380385 after build/TypeScript, before remaining root tests. Raw verification retained. No screenshot capture/restamp; final combined desktop/visual/live/root gates remain pending. No owned UI/runtime processes; integration stays root-owned.

Import source chat-context.js, narrow profile-service/workspace-repository changes, repository/recovery fixture snapshot updates and context-reservation test. Preserve independently imported C032 preflight at ordinary start and union package commands. Tests must provide a real captured chatContext for new repository reservations; no compatibility bypass for missing snapshot. Existing duplicate attempt replay remains idempotent but fresh:false never authorizes redispatch.

Truth review: no product layout/authentication/roadmap change. A1 remains open. Main README and goal contract now describe snapshot authority; NEXT/VALIDATION link this bounded result. No native context-race proof claimed from controlled acquisition/transport.
