# C058 — Remote evidence ownership

Active on `codex/paper-library`, draft PR33, starting at pushed `1f58c0a`. C057 is accepted and archived. Continue the authorized six-hour run through at least 2026-09-24 10:18:54 UTC. No deployment or real-library cutover.

## Confirmed problem and implementation

The [private HTTP reproduction](evidence/C058/before-owner-reproduction.json) at `0ae9538` confirmed that a fresh foreign connection with the same Paper ID/revision could execute an original-library Undo. The recorder stored nothing; no user library was used.

Source `56c94a8` derives an opaque HMAC owner from the captured server/dataset/credential or explicit CLI route using a durable per-store key under agent-edits. Separate remote receipt files preserve each connection's latest Undo. Missing, corrupt, foreign and unknown owners refuse execution before remote access. Older unowned receipts/proposals remain unchanged and readable as reference-only; their controls cannot execute. Foreground evidence lookups require the open Paper binding. API/MCP tool sessions capture CLI routing once before their first read and reuse it for edits.

Credentials are absent from persisted receipts. Credential rotation or HTTP/CLI mode changes deliberately create another owner; no automatic reassignment or remote database identity guarantee. Profile transfer and migration authority remain separate contracts. The ownership key is retained with agent-edits backups.

## Validation checkpoint

- 11 ownership checks pass: persistent identity, dimension/store separation, corrupt-key refusal, zero-request foreign Undo, separate A/B/restart receipts, immutable legacy evidence, captured configuration, proposals, CLI route reuse and local compatibility.
- Actual API tool-loop, conversion, structured table, MCP and 37 host checks pass.
- Full rebuilt desktop passed as session71824, log `Temp/c058-desktop.log`. Source has not changed during that compiled UI run; later changes affect fixture setup, native harness and health documentation.
- Native run at56c94a8 failed because the foreign recorder served JSON as editor assets; failed gallery06:24:50 is retained and its two stills inspected. Fixture correction def8b85 passes at `docs/visual/paper-evidence/runs/2026-09-24T06-31-10-092Z`: fresh foreign binding, six zero-request refusals, preserved legacy bytes and exact HTTP/MCP-CLI Undo after restart.
- C057 connection regression passes at `docs/visual/paper-connection/runs/2026-09-24T06-32-34-882Z` (13 refusals, Retry, exact Undo, CLI and restart).
- Eight native stills inspected, including full-size foreign/narrow views. Narrow unknown-owner explanation was clipped; a CSS wrapping correction remains uncommitted and needs recapture. Derived55-frame GIF prepared but not yet reviewed; no visual acceptance yet.
- Final944e251 native run06:35:09 passes; all8 stills and56 decoded GIF frames reviewed. The explanation now wraps at820px. The previous55-frame derivative is also reviewed and retained as superseded presentation.
- Profile isolation at944e251 passes; six stills and six step-GIF frames reviewed at `docs/visual/profiles/isolation-runs/2026-09-24T06-35-40-918Z`. All owned processes stopped. Parity then refused before starting because this older isolation-runs path is outside the untracked-evidence allowance; commit reviewed evidence before retrying, do not weaken the guard.
- Call-site audit found tab rename omitted C057 binding and optimistically changed labels on refusal. The uncommitted correction reuses the mounted Paper title save, refuses over unsaved human work, and only changes tab/favorite labels after acknowledgement. All40 host checks pass, including three new actual controller/tab-path checks. Full rebuilt desktop58334 passed in Temp/c058-desktop-final.log; the native harness adds CLI rename success, foreign refusal and retained title discard.
- No capture runtime is currently owned.

## Linux setup failure

C056 Linux run35959845676 finished 1/20: 19 suites enabled CLI with an empty server, then timed out at catalog discovery. [Failed job log](evidence/C058/c056-linux-failure.log) and [table setup timeout](evidence/C058/c056-tables-failure.log) are retained. C056 intentionally requires an explicit destination; production ownership must not fall back to ambient defaults. The shared fixture helper and 22 callers now capture the fixture CLI's server/dataset explicitly and surface setup refusal before waiting. Prove a fresh full parity run before claiming merge readiness. C057 Verify/Visual checks at1f58c0a pass; its parity remains pending with the same old setup.

## Next action

Commit the bound tab-rename correction and run expanded native C058 plus corrected full parity. Then final live/fixture capture, actual image/GIF inspection, explicit approval and root verification. Update handoff/evidence, commit/push and inspect fresh exact-head CI. Preserve one lane, user checkouts, upstream source and shared services.

Native extension checkpoint: source bb59d11 passed the existing ownership/restart/Undo steps but timed out clicking the favorite control before hovering its tab. Gallery06:54:28 and the inspected failure screenshot are retained. Correct the fixture to perform the ordinary hover, then rerun; no app change or forced hidden click.

Native retry at b3ce22f exposed a real Windows CLI title failure: shell parsing split a multiword title. The editor retained the attempted title and unchanged tab/favorite, as designed. Gallery06:58:06 retains the inspected failure. The adapter now invokes the native bp executable without a shell; a regression covers spaces, quotes and metacharacters, and the native title includes an ampersand. Expanded live proof and parity must pass before closeout.

The next native retry07:04:28 reached the CLI and refused an unused stdin pipe. Its inspected failure still confirms retained title and old labels. The adapter now uses native spawn with ignored stdin for argument-only operations and piped stdin only for JSON bodies, keeping timeout/output bounds. All31 catalog/CLI tests pass; native proof pending.

Native d7077af exposed false acknowledgement in the old generic doc.patch title path: a draft twin was written while the Paper still read its old published title. Upstream mutations.ex confirms draft-first semantics for paper; Paper block ops has no guarded title operation, and ingest explicitly refuses ifRev. Do not publish the twin or invent support. cliPatchTitle now refuses before any command; native proof must show unchanged title/labels and no new draft twin. The mounted-controller binding and retained attempted title remain useful. This is an explicit title-editing limitation, not a successful rename feature.
