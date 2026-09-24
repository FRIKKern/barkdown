# Ordinary local notes on Paper

Managed local profiles create empty Paper notes through New Page. The note's exact draft identity stays attached to title/body edits, Pages, search and saved tabs. An unconfirmed creation retains its request identity; Retry checks the same note. Connected cloud libraries and the legacy note store keep their existing creation paths.

**Acceptance in progress (C067):** the private native IPC journey passed title/body typing, two-profile same-ID isolation and restart. The public New Page/quick-open journey and final clean-source capture are still being validated. This page does not yet claim accepted new UI evidence.

## Proof and remaining limits

- [Real API contract](../../cycles/evidence/C067/draft-contract-1790274226109.json): empty creation, nonce readback, guarded title/body changes, stale refusal, discovery/search and lost-response reconciliation.
- [Private native development run](runs/2026-09-24T18-32-53-051Z/manifest.json): actual Paper typing and profile/restart assertions. Recorded from uncommitted development source; not final screenshot approval.
- [C067 handoff](../../cycles/C067-ordinary-paper-notes.md): current commands, acceptance and final capture state.

Agent ordinary-note creation/Undo, deletion/recovery, migration activation and legacy retirement are not established by this human editing journey. Missing readback after an uncertain create never authorizes another POST. P2/A2 remain open.

## Changelog

- 24 September, C067: ordinary draft integration and durable creation intent under validation. Native testing found a hidden empty body and a locked-title Enter no-op; the host preserves a visible body and moves the native selection into it. Failed attempts remain in their original run folders.
