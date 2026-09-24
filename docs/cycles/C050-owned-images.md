# C050 — Owned images

Starting from pushed C049 a08b901 on codex/p2-migration. Use disposable profile stores and private Barkpark30c007 only. Preserve source/backup/workspace and legacy authority; no merge/deploy.

## Implemented scope

Strict same-profile attachment resolution and PNG signature/chunk CRC/decompression checks. Top-level eight-bit non-interlaced grayscale/RGB PNG with optional alpha, alt and width only. Explicit height, captions, animated/paletted/interlaced PNG and other formats refuse. Upstream retains height metadata but paints by width/natural ratio; data retention alone cannot establish appearance.

Audited POST /v1/media/:dataset/upload is non-idempotent. A durable random attempt filename precedes one upload request. Before first upload, refuse pre-existing matches. Resume reconciles only one exact-name scoped candidate after metadata and binary hash readback. Missing/ambiguous candidates stop without another POST. Immutable media journals bind source, target and Paper staging payloads. GET list/detail and binary delivery are owned-runtime scoped; configured absoluteUrl and redirects are not trusted. Upstream anchors: v1/media_controller.ex, media.ex, delivery/asset_response.ex and delivery/urls.ex at30c007.

## Current evidence and next action

49 migration tests pass, including lost responses and four actual child exits. Initial child-exit failures exposed a harness/journal compatibility issue: retained abandoned lease archives are now recognized by their exact name pattern. The absolute/file-URL fixture now reads its selected backup.

Native attempt at96c1c8c, docs/visual/migration/runs/2026-09-24T01-23-25-081Z: actual post-upload child exit and reconciliation created one media object for two references, exact bytes rendered, alt/width saved and exact Undo passed. Deletion timed out at rev5 because clicking the image does not activate native atom selection. Failure PNG inspected: original images/content intact. Next capture uses the existing accessible figure focus + Enter selection, then asserts selected identity before Backspace. Native deletion/restart proof and final validation remain pending. Private capture runtime stopped cleanly.

C049 Linux Editor parity run35941746300 is19/20; tablehead2/6 because the initial chrome action unnecessarily waited for text selection. Right/left alignment passed; header-dependent assertions cascaded. Current harness uses caret-only clicks for header chrome while retaining real keyboard text selection for bubble alignment. Failure log/artifact retained in Temp/c049-linux-parity.log and Temp/c049-linux-artifacts. Run local tablehead and fresh Linux before claiming that gate clears.

Native rerun a6c0f29 passed all alt/width/delete saved Undo, reload and restart checks at docs/visual/migration/runs/2026-09-24T01-29-38-039Z. Final media revalidation now runs after Paper writes, so mid-batch missing/changed bytes cannot receive a completed staging stamp. 51 migration tests pass including that failure and two-file partial-upload reconciliation. Next: commit final revalidation, rerun native image proof and local tablehead, inspect stills/motion, full desktop/root verification and standard visual capture/compare/review/approve. Source app changes require implementation then evidence commits. C050 remains active. Six-hour run ends no earlier than2026-09-24 04:17:20UTC.

Final native source bc1dc82 passes at docs/visual/migration/runs/2026-09-24T01-32-14-944Z. All ten stills,35 raw2fps frames,35 decoded GIF frames and eight restart samples inspected; full-size width and narrow controls reviewed. Tablehead6/6 locally; full desktop command completed with exit0. Next standard live/fixture capture, explicit review/approval, root verification and evidence push.

Capture sequencing correction: a2feb5d recorded full desktop too early after the77-check subsection. Later Electron suites were still running when standard captures began. The01:39 live/fixture candidates are retained unapproved, not final evidence (see evidence/C050/capture-sequencing.json). Wait for the entire desktop command to exit, then recapture without overlap. Dedicated native image evidence preceded desktop testing and is unaffected.

The entire npm --prefix app test command now completed with exit0, including final staging/media tests. Log: Temp/c050-desktop.log. No desktop suite remains running. Recapture standard views now; the earlier overlap candidates remain unapproved.
