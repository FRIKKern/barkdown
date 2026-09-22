# C033 — trusted context at reservation

Base a107075, isolated codex/context-reservation-12h. Original reproduction inspected and retained: disposable registry/mock runtime acquisition proves stale A session accepted into changed B. Failed-first9tests:7fail,2draft-only pass. Both ordinary followup on goal-created side chat and actual createGoalProvider adapter covered. No UI/runtime launches.

Plan: trusted snapshot of dispatch-relevant chat context checked after runtime acquisition and again before durable reservation. Reject with BARKDOWN_SEND_NOT_STARTED, release lease, preserve newer folder/draft. Goal scheduler sees prelaunch rejection, not an accepted attempt. Draft/navigation-only changes allowed; existing captured runs stay owned.

## Source checkpoint

Shared chat-context captures a fingerprint of raw saved provider, folder, context version, model/effort, parent/goal, sessions/seen and prior message/API history. Draft/navigation excluded; effective default provider stays in immutable settings and does not spuriously mismatch raw null. Profile resolver rechecks after runtime acquire and releases lease on refusal. Repository begin repeats guard before mutation, requires snapshot (no missing-snapshot compatibility bypass), and writes captured version to attempt. Duplicate existing reservations still return fresh:false; no replay. Goal adapter uses the same trusted resolver/repository, rejects before acceptance and releases exactly once.

15context cases PASS: both ordinary follow-up on goal-created side chat and actual goal provider adapter; folder, away/back, model, provider, session changes refuse; draft-only and default-provider cases dispatch; late mutation between resolve and begin also refuses. All refused paths retain newer draft/folder and create no attempt or stale session. Related goal-provider/service15cases PASS; workspace repository, profile service, chat recovery, deterministic three-worker integration, shared send-preservation/boundary suites PASS. Early chat-recovery invocation before app install failed missing lucide; rerun after npm ci passed. No UI/runtime launches or native transport claims.
