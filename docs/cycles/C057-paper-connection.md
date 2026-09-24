# C057 — Paper connection ownership

Starting checkpoint6303ddf on codex/paper-library, pushed in draftPR33. C056 is accepted and archived. The six-hour run remains active until10:18:54UTC (12:18Paris).

Source review found open Paper buffers retaining their document/revision while foreground mutation handlers resolve current connection settings. Equal IDs/revisions across destinations can defeat revision-only protection. First reproduce with a disposable runtime and controlled foreign request recorder, then bind the foreground adapter to an opaque captured connection identity. Validate before any request, hold routing across awaits, preserve unsaved blocks/title on refusal and retry only against the original connection. Include body/title/media/conversion/proposals/Undo and related refresh paths. Audit CLI routing explicitly; do not claim ambient CLI is bound.

Scope is the in-session editor boundary. Durable connection-qualified tabs/favorites, provider receipt migration, local Archive origin classification and authority activation remain separate contracts. No real user library, shared service, upstream source or deployment changes. Do not claim the source-review risk is reproduced until an actual test demonstrates it.

Private reproduction at6d3dce1 confirmed one old-buffer POST reaching a foreign recorder after settings change; recorder refused storage and original Paper stayed exact. Reproduction JSON is retained in evidence/C057. Runtime stopped. Uncommitted implementation now adds an opaque main-process binding, captured CLI routing and foreground host propagation; first host run found only its old two-argument title assertion needs the new binding argument. New boundary tests and native protected rerun are next. No owned test service running. Continue source commit → native/live/fixture capture → actual review/approval → evidence commit. Update durable code-area health text before final capture to avoid stale fingerprints.


Implementation checkpoint:16 binding tests and37 host tests pass after adapting title argument assertions. Full desktop regression is running in Temp/c057-desktop.log (session68156). Native harness covers13 refused operations with zero foreign requests, unchanged proposal/receipt, A-to-B-to-A Retry, exact original-library Undo, actual CLI save and restart; not run yet. App-source and capture changes are uncommitted. Finish desktop, review source, commit, then run the native harness without parallel Electron suites.


Review added refusal when writes are revoked during capture and when a disabled connection finishes a read. Missing bindings also refuse retained-proposal discard before removal. Reads/import/links/Ask keep the original context; no foreign content is substituted into the open buffer.55 combined catalog/refresh/binding tests and37 host tests pass. Full desktop remains in progress; final targeted host tests include the later action-copy guards. Native proof and global visual approval remain pending.


Native38f1290 passed at visual/paper-connection/runs/2026-09-24T05-43-15-377Z: zero foreign requests for13 operations, preserved original/proposal/receipt, A-to-B-to-A Retry, exact original-library Undo, explicit CLI native save/refusal and restart. Runtime stopped; images pending review. The initial full desktop pass used a pre-existing renderer bundle for some UI suites; do not treat it as final compiled-UI acceptance. Added npm pretest build and rerun the full suite before acceptance.55 combined unit and37 source-host tests pass. No capture result was restamped.


Actual review of all nine native stills found duplicate connection/failure notices and proposal buttons that remained enabled after connection change (main already refused them). Consolidate the repeated notice and refresh proposal controls, then recapture the native journey with explicit assertions. The first gallery remains valid behavior proof but is superseded for final UI acceptance. Full rebuilt desktop session30962 targets8da8d0f; the notice-only follow-up will have fresh host/native evidence.


Repository truth review condensed obsolete22/23September pending instructions in the main/renderer health READMEs, retaining audit/gallery links and using the manifest-backed current live image. Historical source evidence remains in Git/cycle records. These health text edits precede the final captures, so their tripwire fingerprints will be current.
