# C027 — Immutable visual reviews

Isolated from ca0cef3. C008 parent remains active (snapshot retained). No runtime or UI launched.

Plan: reproduce two approvals of one candidate replacing the legacy manifest-hash review, then store content-addressed immutable attestations and keep only the latest pointer mutable. Retain every legacy review untouched. Test with the actual CLI in a disposable Git repository. P1 remains open; combined screenshot freshness is not inherited.

Failed-first regression: actual CLI on the old source replaced the seeded original review on the first same-candidate approval (385 original bytes became386). `node scripts/visual-approval.test.mjs` exits1 at legacy-byte preservation. Temporary repositories are retained.
