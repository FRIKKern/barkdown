# Whole-library comparison before authority selection

Implementation contract audited against Barkdown `19f9cb8a` in C077. This is a design for the next adapter, **not an implemented seal or permission to switch engines**. [P2/A2](../ACCEPTANCE.md#a2--one-engine-without-lost-notes) remains open. The active queue remains [PLAN](../PLAN.md) and [cycle.json](../cycle.json).

## What the existing checks actually establish

| Existing owner | Verified boundary | Missing composition |
|---|---|---|
| `profile-preparation.js` | `prepare()` rechecks frozen foreground, retained drafts, child drains and the exact quiescent writer generation. | `inspect()` reads a durable record; it is not fresh admission evidence. Cancellation/restart can invalidate an earlier successful preparation. |
| `migration-preflight.js` | Inventories supported legacy files, copies them and checks the source hash again. | `quiesced: true` is supplied by the caller. It does not establish the live preparation boundary. |
| `migration-restore.js` | `validateBackup()` verifies the pinned manifest, exact file inventory and bytes without restoring. | The manifest does not represent existing Paper rows or the runtime database. |
| `migration-staging.js` | Rebuilds expected payloads, checks owned intents and exact receipts, rejects draft twins, then rereads every staged note and media asset. | Covers mapped legacy notes, not pre-existing Papers. It can create missing targets, so it must not be used as a read-only comparison API. |
| `migration-media.js` | Checks owned upload metadata, unique discovery and exact PNG bytes. | Can upload on first staging. Existing Paper media needs its own inventory and preservation policy. |
| `paper-catalog.js` | Validates bounded traversal and page overlap for published or draft perspective. | Counts and overlap are not an atomic snapshot. A catalog summary is not full structured content or media evidence. |
| `migration-workspace.js` | Projects supported paths, favorites and human Pages without modifying the source. | Still refuses unplaced legacy notes and source-less closed document targets; does not establish current connection-qualified activation. |

The old workspace comment claiming every unplaced Paper is cloud is historical. Managed-local Archive now exists; the projection's refusal remains real until an owner-qualified replacement is tested. Do not remove the refusal on the strength of that stale comment.

## Comparison inventory

Capture an immutable input identity containing the profile/store owner, preparation ID and closure ID, exact quiescent writer generation, owned runtime identity/dataset, backup manifest/source hashes and the migration plan hash. Never include runtime credentials in the report. The production caller must obtain and revalidate these identities; a caller-supplied boolean or unverified JSON is insufficient.

Account for three disjoint populations, with published and draft variants kept distinct:

1. Every legacy source document has exactly one expected target and valid owned intent/receipt. Compare its complete migration payload and acknowledged revisions, including rewritten links and media. Never adopt an existing same-content note without its intent.
2. Every pre-existing managed-local Paper remains unchanged, including ordinary draft-only notes and both variants when present. Do not treat an existing draft as disposable staging clutter or publish it to simplify comparison.
3. Every other observed target identity is an explicit mismatch requiring reconciliation. An extra row, duplicate mapping, draft twin of a staged target or incomplete listing cannot be accepted from matching counts.

The baseline for population 2 must be captured **before staging writes**, under the same verified preparation boundary. Existing completed staging receipts cannot retroactively prove which other Papers existed beforehand. If that baseline is absent, retain the rehearsal and refuse a whole-library seal; do not manufacture history from the current catalog.

Read complete structured rows and revisions, not the UI catalog's selected summary fields. Preserve original history/receipts through the verified legacy backup and readable-originals path; this does not convert them into Paper revisions. Include the source workspace and its proposed projection, media references and exact byte hashes, and retained-draft identities. A backup hash does not by itself prove the correctness of its derived document map or conversion; recompute those with the current eligibility rules.

Draft perspective is **not a draft-only listing**: it falls back to published rows without twins. The existing `draft-notes.js` filters that result using `_draft`/the exact `drafts.` identity. Preserve and validate exact variant identities when combining perspectives; do not count the fallback twice or collapse a divergent twin. This follows the pinned upstream `api/test/barkpark_web/controllers/query_controller_perspective_test.exs` contract at `b70214090` (inspected, not rerun in C077). Exact raw reads must reject identity substitution rather than accepting the bare-ID fallback.

## Read-only comparison sequence

1. Freshly validate preparation, launch closure, writer identity and runtime ownership. Hold the foreground freeze for the operation. Refuse any active/uncertain writer or changed preparation.
2. Verify the complete backup using the pinned source hash; inventory the live legacy source and compare it with the backup. Derive expected payloads, mappings and the workspace projection. Any unsupported or ambiguous input blocks comparison before network work.
3. Validate the complete staging/media journals and pre-staging Paper baseline without creating directories, completing missing receipts, uploading or publishing. Missing records are failures, not recovery instructions.
4. Traverse both target perspectives with bounded complete discovery. Read each exact variant and compare its structured data/revisions with the appropriate baseline or staged payload. Verify all referenced media under captured-origin and byte limits. Refuse unsupported existing media until its preservation path is proven.
5. Repeat identity/source/journal/fence checks after asynchronous reads, and reconcile final complete target inventories/revisions against the first traversal. A runtime replacement, changed row or changed projection invalidates the result.
6. Return a source-bound comparison report with `authority: legacy` and `activationAllowed: false`. No authority write, workspace replacement, source cleanup or remote mutation belongs in this adapter.

Repeated reads detect observed drift; they do not create a server transaction or fence unrelated direct upstream clients. Before introducing an activation-capable seal, prove exclusive mutation admission for the owned runtime or add a supported upstream snapshot/revision boundary. Record that limitation explicitly rather than claiming the app's writer fence stops every HTTP client.

A persisted report is historical evidence. Resuming must revalidate the complete input identity and current data; reading a successful report never authorizes a switch. The later selector needs its own durable transition and interruption/rollback proof.

## Bounded implementation and stopping condition

The next implementation checkpoint is a **read-only comparison adapter for an explicitly captured rehearsal**, including the pre-staging Paper baseline and refusal cases. Keep it internal and return actionable mismatches. No migration button, authority selector or legacy retirement in that checkpoint. Extract shared read/validation logic from staging only where needed; do not call mutating staging as a shortcut or invent upstream endpoints.

Before broad visual capture, prove:

- A mixed corpus beyond one page: mapped legacy notes, an unchanged published Paper and an ordinary draft-only Paper; exact variants and counts survive comparison.
- Missing/extra/changed rows, reordered or repeated pages, stale revisions, draft collisions, unsupported content/media, broken references and navigation ambiguity refuse without any POST/PATCH/DELETE or source/journal mutation.
- Cancellation, generation rollover, profile/runtime replacement, source/backup/media changes and interruption between reads invalidate the result; restart cannot reuse a stale pass.
- Human Pages order, Archive classification, tabs/favorites and retained drafts remain unchanged. A mock callback cannot substitute for native preparation ownership proof.

Use scoped owner tests during development, then the real isolated runtime for the mixed-corpus and interruption journey. App changes require the normal desktop/root gates and reviewed native/standard/live evidence. Freeze scope when this checkpoint passes and integrate it before selection/rollback work.
