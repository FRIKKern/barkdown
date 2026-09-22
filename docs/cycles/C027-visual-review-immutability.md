# C027 - Immutable visual reviews

Isolated from ca0cef3. C008 parent remains active (snapshot retained). No runtime or UI launched.

Plan: reproduce two approvals of one candidate replacing the legacy manifest-hash review, then store content-addressed immutable attestations and keep only the latest pointer mutable. Retain every legacy review untouched. Test with the actual CLI in a disposable Git repository. P1 remains open; combined screenshot freshness is not inherited.

Failed-first regression: actual CLI on the old source replaced the seeded original review on the first same-candidate approval (385 original bytes became386). `node scripts/visual-approval.test.mjs` exits1 at legacy-byte preservation. Temporary repositories are retained.

## Source and validation checkpoint

Source d3c8550 follows failed-first4d0a287. Each serialized attestation now has a content-addressed approval-<sha256>.json record, exclusively created; existing mismatched bytes refuse. Old approval is archived before current pointer replacement. Legacy manifest-hash records are never written. Current pointer carries exact path/hash, verified against immutable bytes and fields. Area changelogs link individual attestations. This is an engineering audit trail, not protection against malicious repository edits or crash-atomic multi-file transactions.

Actual CLI regression uses a disposable Git repository and synthetic artifact bytes, not UI screenshots. Both reviewers and original legacy bytes survive; latest selects reviewer two; original pointer additionally archived; area changelog retains both links; identical preservation is idempotent; mismatched existing bytes fail closed. Test passes. Existing visual comparator, cycle checks, syntax, TypeScript, root build and complete root concept tests passed (session84771 exit0). npm ci and Playwright Chromium install passed.

Root verify stops at inherited status freshness9b4346463 versus capturee38038577. Separate check:visual passes both test programs then correctly refuses changed input fingerprint. No approval or media was promoted. No Electron/runtime launched; no processes remain.

Truth review: PLAN, ACCEPTANCE, DESIGN-DECISIONS, app guide and validation claims remain applicable: no app behavior changed. Visual RULES now documents actual immutable semantics and admits historical overwritten attestations cannot be reconstructed. C008/P1 remain open. Tooling changes require fresh combined capture/compare/inspection/approval before closure. Next: coordinator imports tested source and records combined evidence. Preserve the parent snapshot; do not replace the integration's active cycle with this lane cycle.
