# C057 — Paper connection ownership

Accepted on `codex/paper-library`, source `0e4b891`, following C056 checkpoint6303ddf. The six-hour run continues until at least2026-09-24 10:18:54UTC. PR32 is merged asd126875; this cycle belongs to draftPR33.

## Outcome

A Paper opened on connection A retains an opaque main-process binding. Changing server, dataset, credential, access mode or profile/runtime owner cannot redirect its later reads/writes to B. Missing/foreign bindings refuse before access. Multi-step writes use captured configuration; CLI operations retain explicitly verified server/dataset/workspace/project routing. Permission revocation is checked before writing. Human unsaved blocks/title remain visible; restoring A permits guarded Retry. Body/title/media/conversion/proposal/Undo and related reads/import paths use the binding.

## Evidence

- [Private pre-fix reproduction](evidence/C057/before-fence-reproduction.json) at6d3dce1 confirmed one old-buffer POST reached a foreign recorder; storage was refused and original data stayed exact.
-16 binding tests and37 host tests pass;55 combined catalog/refresh/binding checks pass. [Logs and review](evidence/C057/review.json).
- Full desktop passes after automatically rebuilding8da8d0f. The earlier pass used a pre-existing bundle and is retained without final compiled-UI claims. Final notice-only changes have focused host and exact-source native proof.
- [Native gallery](../visual/paper-connection/runs/2026-09-24T05-53-21-002Z/README.md) at0e4b891/private30c007:13 refused operations, zero foreign requests, unchanged original/proposal/receipt, A-to-B-to-A Retry, exact original-library Undo, actual scoped CLI editing/refusal and restart. All9 stills/47 decoded GIF frames inspected;11 original hashes verified.
- First native38f1290 behavior passed, but image inspection found duplicate warnings and stale enabled proposal controls. Presentation corrected and recaptured; superseded evidence remains linked in the gallery.
- Fresh live Paper capture at0e4b891 uses real Claude and passes tablehead6/6;5 stills/37 GIF frames inspected. Standard05:55:41 capture has40 unchanged stills/diffs and40 reviewed GIF frames; explicit immutable approval19569a6c. Root verification passes.

## Truth review and limits

Main/renderer health READMEs now show current manifest-backed live evidence and link historical audits instead of obsolete pending instructions. README/app guide, acceptance and design decisions remain accurate for the private legacy-plus-Paper prototype. PLAN/plan.json, VALIDATION and NEXT-AGENT reflect this bounded result. Same delivery lane, no extra branch or shared-service changes; owned capture runtimes stopped. G1/G2 and upstream creation-route integration remain separate release gates. No deployment, authority cutover or real-library write.

This is an in-session boundary, not durable connection-qualified tabs/bookmarks or receipt/proposal ownership. CLI routing is captured; externally changed CLI credentials are not frozen. Native GIF sampling can omit brief states; full stills/raw video remain. P2 stays active.

## Next action

Commit/push this reviewed checkpoint and inspect exact-head CI. Then audit durable remote receipt/proposal identity: a newly opened same-slug Paper must not execute retained evidence from another connection. Preserve unknown legacy evidence without inventing ownership. Continue the authorized run through10:18:54UTC.
