# C033 — trusted context at reservation

Base a107075, isolated codex/context-reservation-12h. Original reproduction inspected and retained: disposable registry/mock runtime acquisition proves stale A session accepted into changed B. Failed-first9tests:7fail,2draft-only pass. Both ordinary followup on goal-created side chat and actual createGoalProvider adapter covered. No UI/runtime launches.

Plan: trusted snapshot of dispatch-relevant chat context checked after runtime acquisition and again before durable reservation. Reject with BARKDOWN_SEND_NOT_STARTED, release lease, preserve newer folder/draft. Goal scheduler sees prelaunch rejection, not an accepted attempt. Draft/navigation-only changes allowed; existing captured runs stay owned.
