# C058 — Remote evidence ownership

Validated locally on `codex/paper-library`, draft PR33, starting at pushed `1f58c0a`. C057 is accepted and archived. Continue the authorized six-hour run through at least 2026-09-24 10:18:54 UTC. No deployment or real-library cutover.

## Confirmed problem and implementation

The [private HTTP reproduction](evidence/C058/before-owner-reproduction.json) at `0ae9538` confirmed that a fresh foreign connection with the same Paper ID/revision could execute an original-library Undo. The recorder stored nothing; no user library was used.

Source `56c94a8` derives an opaque HMAC owner from the captured server/dataset/credential or explicit CLI route using a durable per-store key under agent-edits. Separate remote receipt files preserve each connection's latest Undo. Missing, corrupt, foreign and unknown owners refuse execution before remote access. Older unowned receipts/proposals remain unchanged and readable as reference-only; their controls cannot execute. Foreground evidence lookups require the open Paper binding. API/MCP tool sessions capture CLI routing once before their first read and reuse it for edits.

Credentials are absent from persisted receipts. Credential rotation or HTTP/CLI mode changes deliberately create another owner; no automatic reassignment or remote database identity guarantee. Profile transfer and migration authority remain separate contracts. The ownership key is retained with agent-edits backups.

## Current validation

- Eleven focused ownership checks pass; actual API/MCP integration, structured table and local compatibility pass. Forty host checks include mounted-controller tab title retention and acknowledgement ordering.
- Native HTTP/MCP-CLI evidence ownership passes at77b3a24: six foreign operations make no further request, legacy bytes remain exact, and guarded Undo recovers after actual Electron restarts. [Final native gallery](../visual/paper-evidence/runs/2026-09-24T07-12-46-438Z/README.md): all11 stills and58 decoded GIF frames inspected, including full-size narrow/refused-title screens.
- [C057 connection regression](../visual/paper-connection/runs/2026-09-24T06-32-34-882Z/README.md) passes;9 stills and47 sampled motion frames reviewed. [Profile isolation](../visual/profiles/isolation-runs/2026-09-24T06-35-40-918Z/README.md) passes with6 stills and6 step-GIF frames reviewed. Owned runtimes stopped.
- Full rebuilt desktop passes at72d8f64, including77 desktop UI,40 host and31 catalog/CLI checks. One existing POSIX-only authentication check skips on Windows.
- Final local parity passes20/20 at72d8f64 against private upstream30c007e43, including tablehead6/6. Fresh live Paper capture includes a real Claude turn; five stills and37 decoded GIF frames were inspected. All40 fixture stills,40 difference images and40 decoded GIF frames were inspected and explicitly approved; pixels and geometry are unchanged. Root verification passes. C058 is locally accepted; push and fresh exact-head Linux CI are next.

## Title contract finding

Tab rename previously omitted the mounted editor binding and optimistically relabelled favorites. It now routes through the mounted Paper controller and retains refused title text. Native testing then exposed three old CLI problems: shell splitting, unused stdin refusal, and false acknowledgement. Generic doc.patch writes a draft twin while raw Paper reads retain the published title. Audited upstream mutations.ex confirms draft-first paper semantics; the Paper ops API has no guarded title operation, and ingest refuses ifRev.

The app now explicitly refuses title changes before invoking a command, consistently for HTTP and CLI. It does not publish a twin or invent endpoint support. Native proof verifies no new draft, unchanged actual Paper/title labels, foreign refusal and explicit discard. A supported guarded title endpoint remains future work. CLI reads/ops now use literal native arguments and pipe stdin only for explicit JSON bodies, with bounded output and timeout.

Failed captures remain in paper-evidence/runs at06:24:50 (fixture asset response),06:54:28 (missing hover),06:58:06 (argument splitting),07:04:28 (unused pipe),07:08:21 (false acknowledgement). Their failure stills were inspected; failed motion is not claimed as reviewed. The06:31 native gallery is superseded by the narrow-text correction and subsequent proof.

## Parity routing correction

C056 Linux35959845676 and C057 Linux35962599940 both failed19 suites at discovery: the old fixtures enabled CLI without an explicit server. Their failure logs are retained here. The shared helper now validates the CLI's actual server/dataset and binds the desktop explicitly.

The first corrected local full matrix at77b3a24 reached14/20. Six remaining failures compared against reader/assets from a default server instead of the owned fixture server; some other reader checks could falsely pass against existing fixture pages. [Run log](evidence/C058/parity-wrong-reader-route.log), [bundle mismatch](evidence/C058/parity-opaque-wrong-route.log), [reader mismatch](evidence/C058/parity-subsup-wrong-route.log). All nine old default-server read paths now use the same validated fixture scope, with a refusal if it differs from the isolated runtime. Do not weaken assertions or call the old results a passing parity gate.

## Next action

Run root verification, record its result and push this verified milestone. Inspect exact-head Linux CI: local Windows evidence does not establish the pinned Linux baseline. Continue through10:18:54 UTC with durable source/navigation ownership before local Archive classification. Preserve one branch/PR, user checkouts, upstream source and shared services.
