# C057 — Paper connection ownership

Starting checkpoint6303ddf on codex/paper-library, pushed in draftPR33. C056 is accepted and archived. The six-hour run remains active until10:18:54UTC (12:18Paris).

Source review found open Paper buffers retaining their document/revision while foreground mutation handlers resolve current connection settings. Equal IDs/revisions across destinations can defeat revision-only protection. First reproduce with a disposable runtime and controlled foreign request recorder, then bind the foreground adapter to an opaque captured connection identity. Validate before any request, hold routing across awaits, preserve unsaved blocks/title on refusal and retry only against the original connection. Include body/title/media/conversion/proposals/Undo and related refresh paths. Audit CLI routing explicitly; do not claim ambient CLI is bound.

Scope is the in-session editor boundary. Durable connection-qualified tabs/favorites, provider receipt migration, local Archive origin classification and authority activation remain separate contracts. No real user library, shared service, upstream source or deployment changes. Do not claim the source-review risk is reproduced until an actual test demonstrates it.

Next: audit and private reproduction. No C057 implementation or tests yet. No owned test service running. Continue source commit → native/live/fixture capture → actual review/approval → evidence commit. Update durable code-area health text before final capture to avoid stale fingerprints.
