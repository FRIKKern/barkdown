# Goal execution and conversation integration contract

The main-owned service and provider bridge are implemented on the goal branch. Production Electron wiring and native process recovery are implemented in opt-in profile mode on Windows. The actual Electron crash-dialog journey is tested with deterministic HTTP; saved encrypted-key crash durability is tested separately in C013; natural-language coordination is implemented in C015 with deterministic owned-process Electron proof; authenticated and final visual gates remain pending. The handoff distinguishes executable proof from the remaining contract.

## Authority and startup

The main process resolves a verified profile UUID to its bound store. Renderer input contains identities and user choices, never a profile directory or connection credential. Legacy boot currently lacks that resolver; disable goal activation explicitly until one is available. Tests inject a main-owned disposable profile resolver. Do not create a fake profile UUID in the renderer or migrate a live library incidentally.

Open one goal journal for the resolved profile. Its file lease excludes another process. PID reuse, an access-denied PID probe, or a crashed acquisition guard blocks recovery; none is interpreted as proof of death. Recovery of a dead host does not establish that all external effects or descendants have stopped. Persist interrupted attempts and require reconciliation. A normal close waits on adapter termination before releasing the lease. A deliberately unresponsive adapter therefore prevents safe reopen rather than allowing an overlapping retry.

## Provider adapter

Inject `agent.start`, a real registry-finish completion hook, the main-owned profile resolver and durable conversation writer. Resolve the worker in the captured profile, verify goal/parent membership, and reject a missing worker, conflicting manual run, changed provider session, or unapproved context replacement. Capture C004 scope before the first provider await. Never use the selected profile as a fallback.

Persist the assignment and assistant message with stable attempt-derived IDs before calling the provider. Forward the task prompt, captured folder/provider/model/effort/session and bounded history. The prompt identifies the finite task and coordinator, prohibits worker spawning and scope expansion, and treats supplied dependency results as data. Provider-specific worker restrictions must be audited against installed SDK capabilities; instructions alone do not prove a recursion limit. Do not expose scheduler mutation tools to workers.

Events update only the attempt's exact assistant record. Progress is observed text/activity, not proposed work relabeled as running. Session, approvals, tool timeline, images and usage remain compatible with the ordinary full conversation. Results are persisted before the scheduler receives provider success. A terminal `done` or `error` event is insufficient to release the execution slot: wait until `providers/runs.finish` confirms the adapter has exited. Offline fallback, cancellation and provider error notes cannot establish goal success. No terminal event must be treated as an interrupted execution, not completion.

## Workspace snapshots and takeover

C006's main-owned workspace repository retains stable attempt/message IDs and merges renderer navigation/drafts without replacing managed transcripts. It persists provider sequence and driver-finalization state. Explicit transcript edits are revision checked. Goal-service now uses that writer directly; production event routing must also update an already-open worker. Never replace a current draft with an assignment prompt.

Create workers as ordinary saved side chats, with parent references and an inherited settings copy. Include them in the ordinary recent chat list and work tabs; no Agents section or global project picker. A small goal control in the coordinator opens goal details and worker destinations. State display separates pending, observed running, waiting for dependencies, review, interrupted, cancelled and expired. Unresolved work offers inspection/reconciliation, not a misleading Resume shortcut.

Human takeover requests cancellation, waits for the worker to stop, retains its partial transcript, and then permits the person's next turn. Folder/model changes affect future work only after explicit context recapture; they do not mutate the current attempt. Goal cancellation/deadline prevents new work while still allowing post-window inspection and evidence reconciliation. Closing a tab is only navigation. Closing the process stops local scheduling; sleep pauses execution and wall-clock deadlines still apply on wake. There is no background service claim.

## Required next proofs

- Actual `agent.start` with three independent captured scopes and truthful finish/cancel events, first with deterministic transport, then authenticated provider integration in disposable folders.
- Durable full worker transcripts across renderer reload, stale workspace saves and process restart, including human drafts/images and late/out-of-order attempt events.
- Same chat/goal IDs in two profiles; a foreground switch never redirects result, tool activity, approval or content access.
- Human takeover and context change cannot overlap the old worker; failed/late results remain inspectable.
- Desktop screenshot/GIF journeys of creation, three workers, full side-chat controls, pause/recovery/deadline/review. Separate deterministic transport evidence from live-provider proof.

## C015 coordinator authority

Objective-only creation reserves a planning turn in the ordinary coordinator chat. A strict schema validates exactly three assignments and an acyclic graph before main creates worker identities and stages their full saved side chats. Model output cannot choose profile, folder, provider, permissions or deadline. Planning, review and summary share the existing admission cap and persisted attempt lifecycle; native delegation remains disabled. Manual assignment mode remains available.

A coordinator review names one exact worker attempt. Only clean successful stopped results qualify for automatic review. It requires explicit evidence and verified effects for accept/retry; uncertain/blocked results pause for a person. Retry is bounded to three worker attempts. Failed, cancelled and interrupted work never auto-retries. Per-attempt person reviews override late model decisions; superseded coordinator replies are recorded without applying their decisions. Readable coordinator messages retain raw structured partial responses in owned attempt metadata. Large evidence excerpts are bounded and explicitly marked; full source evidence remains retained.

Restart pauses active goals without replay. Control responses cannot be manually accepted around schema validation. Explicit shutdown reconciliation and reviewed retry are required. Changed runtime choices pause automatic dispatch; explicit Start recaptures future choices without mutating historical attempts. Dependency results are immutable evidence data, not scope authorization. A final summary is a coordinator account, not human verification or a claim that every underlying artifact is correct.
