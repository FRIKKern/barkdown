# C058 — Remote evidence ownership

Starting at pushed1f58c0a on codex/paper-library, draftPR33. C057 is accepted and archived. Continue the authorized six-hour run through at least2026-09-24 10:18:54UTC.

Source audit: agent receipts are persisted by bp:slug only; proposal lists use slug only. The new in-session binding protects an old open buffer, but a freshly opened foreign Paper obtains its own valid binding and can still target old same-slug evidence. Reproduce privately before claiming an observed failure.

Use a durable per-store opaque owner derived from captured connection/routing, not the revision or renderer input. Keep credentials out of persisted evidence, never assign unknown legacy records to the current connection, and retain originals readably with execution refused. Separate destination receipt storage so one library does not overwrite another library's Undo. Audit the provider/MCP read-to-write route, especially legacy CLI.

No implementation yet. Next: isolated reproduction, ownership contract and tests, then source commit/native/live/fixture capture/actual review/evidence commit. User libraries, shared services and upstream checkout stay untouched. No production deployment or migration authority flip.
