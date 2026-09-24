# C057 — Paper connection ownership

Starting checkpoint6303ddf on codex/paper-library, pushed in draftPR33. C056 is accepted and archived. The six-hour run remains active until10:18:54UTC (12:18Paris).

Source review found open Paper buffers retaining their document/revision while foreground mutation handlers resolve current connection settings. Equal IDs/revisions across destinations can defeat revision-only protection. First reproduce with a disposable runtime and controlled foreign request recorder, then bind the foreground adapter to an opaque captured connection identity. Validate before any request, hold routing across awaits, preserve unsaved blocks/title on refusal and retry only against the original connection. Include body/title/media/conversion/proposals/Undo and related refresh paths. Audit CLI routing explicitly; do not claim ambient CLI is bound.

Scope is the in-session editor boundary. Durable connection-qualified tabs/favorites, provider receipt migration, local Archive origin classification and authority activation remain separate contracts. No real user library, shared service, upstream source or deployment changes. Do not claim the source-review risk is reproduced until an actual test demonstrates it.

Private reproduction at6d3dce1 confirmed one old-buffer POST reaching a foreign recorder after settings change; recorder refused storage and original Paper stayed exact. Reproduction JSON is retained in evidence/C057. Runtime stopped. Uncommitted implementation now adds an opaque main-process binding, captured CLI routing and foreground host propagation; first host run found only its old two-argument title assertion needs the new binding argument. New boundary tests and native protected rerun are next. No owned test service running. Continue source commit → native/live/fixture capture → actual review/approval → evidence commit. Update durable code-area health text before final capture to avoid stale fingerprints.


Implementation checkpoint:16 binding tests and37 host tests pass after adapting title argument assertions. Full desktop regression is running in Temp/c057-desktop.log (session68156). Native harness covers13 refused operations with zero foreign requests, unchanged proposal/receipt, A-to-B-to-A Retry, exact original-library Undo, actual CLI save and restart; not run yet. App-source and capture changes are uncommitted. Finish desktop, review source, commit, then run the native harness without parallel Electron suites.


Review added refusal when writes are revoked during capture and when a disabled connection finishes a read. Missing bindings also refuse retained-proposal discard before removal. Reads/import/links/Ask keep the original context; no foreign content is substituted into the open buffer.55 combined catalog/refresh/binding tests and37 host tests pass. Full desktop remains in progress; final targeted host tests include the later action-copy guards. Native proof and global visual approval remain pending.
