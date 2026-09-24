# C050 — Owned images

Accepted for the bounded offline adapter at source `bc1dc82`, with standard capture at `d53a5a7` and private Barkpark `30c007e43`. [Results and hashes](evidence/C050/results.json), [reviewed native gallery](../visual/migration/README.md). No real libraries, authority switch, merge or deployment.

## Outcome

Captured same-profile top-level PNGs now stage through an immutable single-attempt upload journal. Eight-bit non-interlaced grayscale/RGB with optional alpha, alt and width are supported. Explicit height/captions, animated/paletted/interlaced PNG, other formats and external downloads refuse. Upstream retains height metadata but renders by width/natural ratio; retention alone cannot establish appearance.

POST media upload is non-idempotent. A durable random filename precedes one request. Missing/ambiguous interrupted attempts stop without replay. Scoped list/detail metadata and exact binary SHA-256 verify identity before Paper references the image and again before staging completion. Original source/backup/workspace remain exact. API anchors at30c007: v1/media_controller.ex, media.ex, delivery/asset_response.ex and delivery/urls.ex. Configured absoluteUrl and redirects are not trusted.

## Validation

- 51 migration tests pass, including lost response, four real child exits, two-file partial upload, corrupt/foreign/missing/changed media and final revalidation after Paper creation.
- Actual private-server child exit after upload reconciles one object for two references. Native alt/width/deletion save, exact Undo, reload and restart pass.
- Full desktop command and root verify exit0. Existing POSIX-only authentication test skips on Windows. Local tablehead6/6 passes; Linux rerun is pending after push.
- Ten native stills,35 raw2fps samples,35 decoded GIF frames and eight restart samples inspected. Narrow ALT/URL inputs remain cramped. Final standard live capture includes a real Claude turn; five stills/all37 GIF frames inspected. Fixture comparison has zero thresholded pixel/geometry/environment changes; three changed side-chat stills and one GIF have1/255 shadow noise, all inspected and explicitly approved.

## Retained failures and limits

Initial native deletion timed out because clicking the picture did not select the atom. The harness now uses existing accessible focus + Enter, asserts the selected identity, then Backspace. Original content remained intact. Initial child-exit tests required recognition of retained abandoned lease files; the file-URL fixture now follows its selected backup.

C049 Linux run35941746300 was19/20, with tablehead2/6 after an unnecessary text-selection wait before header chrome. Current test uses caret-only chrome and native text selection for bubble formatting. [Failure log](evidence/C050/c049-linux-parity.log) and [image](evidence/C050/c049-linux-tablehead-failure.png) are retained; Windows success is not Linux success.

The first standard capture overlapped later desktop suites because a subsection completion was mistaken for the full command exit. [Sequencing correction](evidence/C050/capture-sequencing.json) retains those candidates unapproved. The full command then exited0, followed by separate final captures, review and root verification.

A2 remains open: remaining corpus/media, navigation activation, legacy history/receipt semantics and rollback of later Paper edits. Caller quiescence/ownership is not an atomic cross-service snapshot. Fixed runtime origins and clean process restart do not establish portability or power-loss durability.

## Handoff and repository truth

[Repository truth](evidence/C050/repository-truth.json): main plus one Barkdown lane; three owned upstream lanes.46 registered Barkdown worktrees include43 retired locked/recoverable checkouts. Historical C049 overcount is explicitly corrected without rewriting evidence. Keep other contributors, user app and shared services untouched. Next cycle should prove restore from the exact retained migration backup into an empty owned destination, with interruption/resume and usable legacy content; no overwriting or automatic authority change. Review branch/task/evidence retention again at that closeout.
