# Exclusive admission before migration activation

C081 decision for implementation, **not an available API**. The [source audit](../cycles/evidence/C081/source-audit.json) pins Barkdown d4e443ee and Barkpark b70214090. C080 preserves owned navigation; the [comparison](comparison.md) still returns `authority: legacy` and `activationAllowed: false`. This contract closes no A2 runtime acceptance gate.

## Why the app freeze is insufficient

Preparation holds Barkdown's foreground, captured writers and launch admission. Its runtime leases retain the correct server; they do not exclude direct HTTP or internal server writers. A successful comparison can become stale before selection. Repeating a traversal narrows observation time but does not remove that race.

The inspected upstream paths have different owners:

| Mutation class | Actual owner at the pinned source | Required coverage |
|---|---|---|
| Generic batch writes | `Content.Mutations.apply_mutations`, one database transaction | Batch admission through commit/rollback, including nested writers. |
| Direct creation/autosave | `Content.Writer.create_document` / `upsert_document` | Context calls as well as REST/Studio; wrapping only the batch controller is insufficient. |
| Publish, discard, delete, recovery | `Content.Lifecycle`; revision restore calls `Content.upsert_document` | Both variants, revision evidence, exact-draft deletion and restoration. |
| Native Paper edits | `Content.Papers.BlockOps`, called by the ingest controller | Create-only, ingest, guarded ops, contextual history/form variants and aliases. Existing revision guards still apply. |
| Read-side cache repair | `Content.Papers.reader_source` → `refresh_html_cache` | It performs `Repo.update` and changes the revision. During a seal, serve the derived result without persisting it, or refuse the read explicitly. HTTP GET is not a write-free guarantee. |
| Media upload/deletion | `Media.upload` / `delete_file`, blobstore plus database rows | Admission starts before blob persistence and lasts through hooks, commit and cleanup. A database-only lock does not cover bytes. |
| Media processing | `Media.Processing.process`, plugin upload hook and Oban stuck-processing sweeper | Renditions and asset metadata remain writers even without a foreground request. Pending/uncertain jobs prevent a claim of settled writes. |

This is a bounded inventory of relevant paths, not proof that every repository writer is covered. Before enabling a seal, enumerate direct database/blob writes reachable in the managed runtime, including import, backfill, maintenance and plugin jobs. Each must participate or be explicitly disabled/refused in this mode. Unsupported plugins or configurations refuse seal acquisition; they must not be silently omitted.

## Chosen boundary

Implement an **opt-in, runtime-wide upstream maintenance admission gate** for Barkdown's dedicated local instance. Keep normal/shared-server behavior unchanged. Do not infer a private instance from loopback alone: require host provisioning and a capability response bound to the captured runtime and persistent database identity. This does not grant permission to change another runtime.

Enforce admission below transport handlers, at the content and media mutation owners. A router plug may return an early refusal but cannot be the only enforcement. Nested operations share their existing admission rather than reopening it; a child/background process needs explicit owned admission. Authorization and revision checks continue to run. An admin token, `source: :worker`, or an ordinary caller-supplied option is not a bypass.

The initial implementation must include a coverage review of direct `Repo` and blobstore writes. A central API plus a voluntary call convention is not sufficient evidence of exclusivity. If coverage cannot be established, advertise no seal capability and keep activation disabled.

### State and interruption protocol

These are proposed semantics; endpoint names and wire fields must be specified and tested upstream before Barkdown calls them.

1. **Open → closing:** the trusted coordinator submits a unique operation identity. Persist closing before acknowledging it and atomically stop admitting new writes. Calls that already hold admission may settle; acquisition waits for their database, blob and child effects. Never hold a database connection while waiting for work that needs that pool. Unknown outcomes refuse readiness.
2. **Closing → held:** after the drain, return an opaque operation-bound capability with the current server boot identity and a monotonic admission generation. Bind it to the persistent instance/database and exact operation. Comparison runs while held; ordinary mutations, maintenance and cache writes remain blocked. No special content-write privilege is needed for comparison.
3. **Held → selection:** Barkdown freshly revalidates preparation, backup, full target/media inventory and owned projection. The later selector must hold upstream exclusion through durable local selection, namespace/generation changes and verified reopen. A historical report or an old capability cannot authorize selection. This step remains a separate implementation and crash-proof checkpoint.
4. **Abort/release:** before selection, explicitly invalidate the seal and reopen only through the matching trusted operation. After a durable selection intent exists, recover that intent first; do not interpret release as permission to revert to the old engine. Every reopen advances generation; old handles refuse. Duplicate requests reconcile the same operation, without acquiring or releasing another owner's hold.
5. **Crash/restart:** persist closing/held state. Supervisor or server restart must not silently reopen; generate a new boot identity and invalidate the old seal. A lost acquire/release response requires status reconciliation. A timeout or dead owner keeps the instance blocked for explicit recovery, never automatic write admission. Resume rechecks data and obtains a fresh seal before choosing authority.

A process crash during an admitted media write can leave uncertain bytes even when its database transaction rolls back. Retain reconciliation state; do not infer a clean drain from a process count reaching zero. The first checkpoint proves process-interruption behavior. Power-loss durability requires separate evidence and must not be claimed from ordinary file replacement or transaction tests.

## Next implementation checkpoint

**Owner: primary delivery agent, upstream in an isolated `codex/` lane.** Implement and prove the managed-runtime gate before wiring any Barkdown selector. Preflight the current upstream main and instructions; the pinned source is an audit baseline, not an instruction to branch from stale code. Keep the feature opt-in and unavailable until the complete supported writer set is covered.

Required proof before capability advertisement:

- Hold one admitted write at a deterministic barrier; start closing; prove a second caller is refused and acquisition waits until the first write and its effects settle. Cover commit, rollback, caller death and nested writes without deadlock.
- While held, attempt direct context writes and authenticated flat/scoped HTTP mutations, native Paper ops, lifecycle/restore and stale-worker actions. Verify exact rows, revisions, media bytes and journal state remain unchanged.
- Render a Paper needing an HTML cache refresh; demonstrate unchanged stored revision/content while held. Serve correct content without writing the cache.
- Race upload, delete and the media sweeper against acquisition; prove all admitted effects settle or readiness refuses. Include failures between blob persistence and row/hook completion.
- Crash the coordinator/server in closing and held; restart stays blocked, old capabilities refuse, and duplicate/lost-response recovery cannot reopen another operation. Prove normal behavior outside managed mode and profile/runtime isolation.
- Audit mutation coverage and adjacent consumers: error envelope/public codes, CLI mappings/help, OpenAPI, plugin callbacks and startup/restore paths. Run actual upstream integration tests before claiming this boundary exists. Then consume the merged capability in Barkdown with fresh native comparison/selection evidence.

The selector, atomic workspace replacement, rollback after Paper edits and legacy retirement remain subsequent A2 work. Do not expose a migration button or execute a real-library cutover from this contract.
