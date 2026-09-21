# Goal execution and conversation integration contract

Planned next slice; this is not an implemented API claim.

## Authority and startup

The main process resolves a verified profile UUID to its bound store. Renderer input contains identities and user choices, never a profile directory or connection credential. Legacy boot currently lacks that resolver; disable goal activation explicitly until one is available. Tests inject a main-owned disposable profile resolver. Do not create a fake profile UUID in the renderer or migrate a live library incidentally.

Open one goal journal for the resolved profile. Its file lease excludes another process. PID reuse, an access-denied PID probe, or a crashed acquisition guard blocks recovery; none is interpreted as proof of death. Recovery of a dead host does not establish that all external effects or descendants have stopped. Persist interrupted attempts and require reconciliation. A normal close waits on adapter termination before releasing the lease. A deliberately unresponsive adapter therefore prevents safe reopen rather than allowing an overlapping retry.

## Provider adapter

Inject `agent.start`, a real registry-finish completion hook, the main-owned profile resolver and durable conversation writer. Resolve the worker in the captured profile, verify goal/parent membership, and reject a missing worker, conflicting manual run, changed provider session, or unapproved context replacement. Capture C004 scope before the first provider await. Never use the selected profile as a fallback.

Persist the assignment and assistant message with stable attempt-derived IDs before calling the provider. Forward the task prompt, captured folder/provider/model/effort/session and bounded history. The prompt identifies the finite task and coordinator, prohibits worker spawning and scope expansion, and treats supplied dependency results as data. Provider-specific worker restrictions must be audited against installed SDK capabilities; instructions alone do not prove a recursion limit. Do not expose scheduler mutation tools to workers.

Events update only the attempt's exact assistant record. Progress is observed text/activity, not proposed work relabeled as running. Session, approvals, tool timeline, images and usage remain compatible with the ordinary full conversation. Results are persisted before the scheduler receives provider success. A terminal `done` or `error` event is insufficient to release the execution slot: wait until `providers/runs.finish` confirms the adapter has exited. Offline fallback, cancellation and provider error notes cannot establish goal success. No terminal event must be treated as an interrupted execution, not completion.

## Workspace snapshots and takeover

Today's renderer replaces `workspace.json` and routes events to the last assistant message. Neither is adequate for background goal durability. Main-owned goal message IDs must survive a stale renderer save. Keep managed turns in a separate authoritative overlay/journal and merge them by stable IDs at load/save; preserve all renderer-owned draft, image, folder, model, effort, navigation and human-message fields. Never replace a current draft with an assignment prompt.

Create workers as ordinary saved side chats, with parent references and an inherited settings copy. Include them in the ordinary recent chat list and work tabs; no Agents section or global project picker. A small goal control in the coordinator opens goal details and worker destinations. State display separates pending, observed running, waiting for dependencies, review, interrupted, cancelled and expired. Unresolved work offers inspection/reconciliation, not a misleading Resume shortcut.

Human takeover requests cancellation, waits for the worker to stop, retains its partial transcript, and then permits the person's next turn. Folder/model changes affect future work only after explicit context recapture; they do not mutate the current attempt. Goal cancellation/deadline prevents new work while still allowing post-window inspection and evidence reconciliation. Closing a tab is only navigation. Closing the process stops local scheduling; sleep pauses execution and wall-clock deadlines still apply on wake. There is no background service claim.

## Required next proofs

- Actual `agent.start` with three independent captured scopes and truthful finish/cancel events, first with deterministic transport, then authenticated provider integration in disposable folders.
- Durable full worker transcripts across renderer reload, stale workspace saves and process restart, including human drafts/images and late/out-of-order attempt events.
- Same chat/goal IDs in two profiles; a foreground switch never redirects result, tool activity, approval or content access.
- Human takeover and context change cannot overlap the old worker; failed/late results remain inspectable.
- Desktop screenshot/GIF journeys of creation, three workers, full side-chat controls, pause/recovery/deadline/review. Separate deterministic transport evidence from live-provider proof.
