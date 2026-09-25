# Main-process health

This directory owns persisted data, provider execution, native processes and the IPC authority boundary. Start with the [current handoff](../../docs/NEXT-AGENT.md) and [A1 evidence table](../../docs/cycles/A1-current-evidence.md): a passing lane does not approve a newer combined source.

![Current live Paper checkpoint in dark mode](../../docs/images/status/paper-dark.png)

The [capture manifest](../../docs/images/status/manifest.json) identifies this live Paper checkpoint. Use the boundary galleries below for ownership, process and recovery proof; one screenshot does not validate every module.

| When changing | Review the contract and evidence |
|---|---|
| Profiles, registry or adoption | [Ownership](../../docs/PROFILE-OWNERSHIP.md), [repeated adoption](../../docs/visual/adoption-repeat/README.md), [native rollback](../../docs/cycles/C021-rollback-native-preflight.md) |
| Provider dispatch or conversations | [Chat recovery](../../docs/visual/chat-recovery/README.md), [goal integration](../../docs/goals/INTEGRATION.md) and the captured run scope |
| File reads and saves | [Exact file authority](../../docs/visual/project-file-authority/README.md); unavailable navigation must not redirect a retained draft |
| Editor bundle loading | [Cache integrity](../../docs/visual/cache-integrity/README.md); verify both assets and preserve rejected originals |
| Ordinary local Paper notes | [Human draft-note journey](../../docs/visual/paper-notes/README.md) and [agent-note journey](../../docs/visual/agent-notes/README.md): exact rows, distinct revision domains, durable creation identity and guarded Undo. `paper-tools.js` shares captured API/MCP access; `paper-edit-ops.js` preserves the locked title. |
| Delete and recover local notes | [Deletion recovery](../../docs/visual/paper-deletions/README.md): `paper-deletions.js` retains an owned snapshot before dispatch. Sent deletions reconcile by reading; recovery uses one new creation identity and preserves later human edits. Requires upstream `deleteExactDraft`; older servers refuse safely. |
| Native processes or storage | [Terminal ownership](../../docs/visual/terminal-ownership/README.md), [C023 write recovery](../../docs/cycles/C023-windows-atomic-write.md) |

Resolve profile identity in main before using a store, connection or run. A foreground switch cannot rebind captured work. A failed acknowledgement does not authorize replay. Shutdown claims require the owned process receipt, not merely a closed window. Device provider login and environment credentials remain distinct from profile-owned encrypted secrets.

Run the affected real-adapter tests and the required desktop/visual/root gates in [the visual rules](../../docs/visual/RULES.md). The conservative tripwire includes this directory; screenshots require named review, while storage and process claims require behavior evidence.

## Current authority and recovery checkpoints

| Boundary | Current behavior and retained proof |
|---|---|
| Ordinary conversation folder | Current persisted folder is captured for every turn. C032 refuses known missing/non-directory/inaccessible Claude/Codex folders before reservation; [actual8b51fbc refusal/restart gallery](../../docs/visual/folder-preflight/README.md) includes main and side chats. A stat check does not prove full access or prevent later removal; API/null-folder and goal-worker behavior are distinct. |
| Context changes while acquiring a runtime | [C033](../../docs/cycles/C033-context-reservation.md) rejects a stale trusted context before dispatch/reservation, releases the lease and preserves newer folder/draft/session state. Fifteen controlled race tests cover ordinary and goal paths; no native race video is claimed. |
| Selected workspace missing or corrupt | [C012 actual87ca623 recovery stills](../../docs/visual/workspace-recovery/README.md) show explicit blocked startup and retained drafts. [C022 cold-adoption motion](../../docs/visual/adoption-repeat/README.md) proves repeat/rollback only for the recorded same-machine fixture. |
| Provider and process completion | [C034 Codex7e07099 proof](../../docs/cycles/evidence/C034/codex-7e07099/manifest.json) verifies local MCP edit revision1→2 and stopped/zero-active Job; [C035 packaged38 ownership](../../docs/visual/packaging38/README.md) proves terminal descendants across switch/forced exit. Neither proves all providers or clean-machine deployment. |

Packaging includes shared modules and resolves the three fixed external native resources outside ASAR; [C035](../../docs/cycles/C035-packaging38.md) retains exact package hashes. The local PostgreSQL/Barkpark runtime still needs a built source checkout. Recovery must retain source data and an uncertain attempt rather than synthesize success or replay it.

### Current migration boundary

The [migration contract](../../docs/migration/README.md) owns the current P2 limits; [validation](../../docs/VALIDATION.md) separates accepted checkpoints from open work. P1 is accepted through C039. Earlier capture lifecycle/adoption evidence remains in its cycle records, not a separate task queue.

`migration-preflight.js` inventories a closed profile and preserves exact backup bytes. `migration-staging.js`, `migration-media.js` and `migration-journal.js` bind source-qualified identities, create-only writes, owned PNG upload receipts and exact readback to one captured runtime. Ambiguous, missing or edited targets refuse. C052 accepts only the audited standard attributes actually saved by the legacy editor; custom metadata remains blocked.

`migration-workspace.js` computes a hash-bound offline navigation preview, preserving typed paths, human Pages and favorites while leaving opaque history/receipts unchanged. Malformed order, missing identities, ambiguous closed document targets and unplaced local archives block. C053 native preview is a separate disposable app, never authority activation.

`migration-restore.js` copies a pinned committed backup into an empty closed profile without overwriting human changes. Process interruption/resume and native restored-profile editing pass; settings, credentials, runtime databases and Paper edits are outside this adapter.

`migration-evidence.js` reads original documents/history/proposals and the canonical local agent receipt from a caller-pinned, fully verified backup. It preserves legacy revision semantics and exposes no actions, Paper revision or mutation. Unsupported historical content stays original evidence; changed or mismatched records refuse. This offline reader is not a native history viewer or cutover permission.

[Reviewed stills and motion](../../docs/visual/migration/README.md) cover native content, references, media, legacy restore and source compatibility. These remain offline adapters. The app has no migration UI or authority switch; original navigation, history and source data remain authoritative. Cross-machine paths, other media, live writer fencing and cutover/rollback remain open.

## Changelog

- 24 September, C056: complete foreground Paper discovery validates every page and refuses partial success; failed same-connection refresh keeps known notes with a conditional Retry notice. Changed connection generations cannot borrow the previous catalog. [Native catalog proof](../../docs/visual/catalog/README.md) records the200/201-paper journey, failure/retry and restart; limited provider list queries remain unchanged. The current handoff records acceptance and remaining scope.

- 24 September, C057: foreground Paper reads and mutations carry a main-process connection binding; settings changes refuse old-buffer access before transmission. The host retains unsaved text and shows the original-connection requirement. Captured CLI routes avoid ambient destination changes. [Connection evidence](../../docs/visual/paper-connection/README.md) and the current handoff record actual acceptance; this is an in-session boundary, not durable bookmark migration.

- Earlier ownership, login, recovery and editor integration checkpoints are retained in [the P1 completion audit](../../docs/cycles/C039-completion-audit.md), [integration history](../../docs/cycles/C008-integration.md) and their linked galleries. Historical pending statements are not an additional active queue.

C058 scopes persisted remote edit evidence to an opaque original-connection owner. Unknown older receipts/proposals remain reference-only; foreign same-slug records cannot execute. [Native evidence and limits](../../docs/visual/paper-evidence/README.md). The cycle handoff records current validation; it does not authorize migration cutover.

C059 carries durable Paper navigation owners from catalog reads through saved targets and provider activity. Foreign/unknown saved references refuse before Paper reads; provider CLI routing is captured once and passed to its MCP process. [Navigation evidence](../../docs/visual/paper-navigation/README.md). Validation is tracked in the current handoff.

C060: [Owned Paper Archive](../../docs/visual/paper-archive/README.md) records trusted main-process origin, local/cloud partition and preserved human organization across two profiles, failure and restart.

- 24 September, C069: [Agent notes](../../docs/visual/agent-notes/README.md) shares managed-local API/MCP creation/discovery, preserves locked titles during body replacement and retains revision-checked Undo receipts across restart. Creation retries retain the original request and content; managed tools no longer seed legacy notes. Native acceptance and remaining recovery limits are tracked in C069.

C074 adds `original-history.js`: profile-owned references pin both source and manifest hashes, verify the full migration backup on each read, and expose no restore or mutation action. Native IPC captures the owner before the folder picker. [Viewer evidence and limits](../../docs/visual/original-history/README.md).

C075 adds `writer-admission.js`: durable store generations and admitted operations guard bound documents/receipts, foreground Paper and attachment writes, captured API/MCP/goal processes and workspace persistence. Failed or interrupted writes remain uncertain; quiescence cannot call them completed. The controller is internal and does not select an engine. [Native evidence and limits](../../docs/visual/writer-fence/README.md).

Legacy adoption retains writer controls byte-for-byte in source backups and excludes them from the new profile projection. The destination captures its own root identity; active, uncertain or quiescing source controls refuse adoption. Cold-runtime staging validates copied controls against their original root before publication.

Provider drivers emit the first chunk immediately, then combine consecutive text/thinking chunks within a100ms batching window and16Ki-character pending limit before assigning event sequence numbers. Tools, approvals, replacements, cancellation and completion flush the buffer. Owned-worker bridges do not batch again; the same fenced synchronous persistence still precedes every forwarded event. Durable sink failures cancel and finalize the run without retrying failure reports through the broken sink. C075 stream tests cover all three provider loops, order, failures, profile ownership and restart readback; measured latency remains recorded in its evidence.
