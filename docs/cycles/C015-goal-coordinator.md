# C015: natural-language goal coordinator

Planned after C013 closes. This branch owns goal planning/review, not C014 ordinary chat recovery. The parent integration task coordinates the narrow workspace-repository role/fingerprint overlap; preserve its context/recovery changes. Do not change the ordinary composer, profile-service or owned worker adapter in this slice.

## Bounded outcome

A person supplies an objective and time window in a conversation. A real coordinator turn proposes three bounded assignments and a dependency graph. Main validates the response before creating three saved full side chats. Workers execute within the existing admission, deadline, ownership and Windows process lifecycle boundaries. Coordinator review of exact stopped successful attempts releases dependencies, requests a bounded retry, or pauses for a person. A final coordinator summary records outcomes and limits.

Reuse the existing goal journal and attempt lifecycle for planning, review and summary turns. Coordinator turns count against the same three-running-turn admission limit and cannot spawn native agents. Old manually assigned goals remain readable and executable. No new global project context, Agents section or simulated runtime.

## Authority and recovery

- Model output contains assignments and review decisions only. Main chooses profile/chat/goal/attempt identities, captured folder/provider/model/effort, permissions and deadline. Reject unexpected scope fields and malformed/ambiguous responses.
- Persist the plan before worker staging; stage all workers before dispatch. Restart pauses active goals and never replays a reserved attempt. Partial staging repairs only through explicit Start.
- Automated review is eligible only for the exact latest successful, stopped attempt in review state. Interrupted, failed, cancelled or uncertain work requires person reconciliation. A review response cannot prove shutdown.
- Require explicit evidence and verified effects for automated acceptance or retry. Uncertain/blocked results pause for a person. Recheck attempt identity and shutdown immediately before applying review. Bound worker retries to three attempts.
- Preserve raw model replies as evidence, but display readable planning/review messages in the ordinary coordinator conversation. Label coordinator review accurately; never imply human verification.
- Include reviewed dependency results with attempt/evidence identity as untrusted input data. Preserve human drafts and never silently rebind changed chat context. All new turns use current trusted session state within unchanged captured choices.

## Required proof

Parser/DAG/unknown-field/count tests; durable planning/staging; exact-attempt review and dependency dispatch; uncertainty/failure/retry bounds; shared admission; deadline/cancel; interrupted coordinator no replay; retained drafts/full side chats. Actual Electron through the default owned process and deterministic local SDK transport, followed by authenticated synthetic Codex work when available. Full desktop/root verification and source-commit → fresh deterministic/live screenshots → inspected evidence commit sequence apply.

## Checkpoint

Design only. C013 final live capture is running; no C015 app changes or passing implementation claims. Next: close C013 with final evidence, archive its cycle record, activate C015 and run `npm run cycle` before editing behavior.
