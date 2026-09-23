# C044 — Safe Paper creation

Active on `codex/p2-migration`, starting from verified C043 tip `dfee78b`. User authorized autonomous work through at least 2026-09-23 21:43:38 UTC. The task goal and `barkdown-p2-two-hour-run` heartbeat own that continuation; do not duplicate them. C043's completed record is archived beside its handoff.

First establish actual collision, published/draft and idempotency semantics in a disposable Barkpark runtime at consumed `bf23f773`. Generic mutation creation does a draft lookup before a create-or-update writer; ingest is unfenced upsert. Neither is assumed safe. Probe these boundaries, then implement a narrowly scoped creation contract or record concrete refusal evidence. Source-library mutation and navigation cutover are excluded.

No services started yet. No upstream checkout modified. Only this Barkdown branch is active alongside main. If upstream changes are required, use a separate `codex/` worktree and preserve existing contributor lanes. Dependencies remain installed from C043. Next: create the contract probe and run it against an owned private runtime; retain exact observations before choosing a write adapter.
