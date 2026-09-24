# C050 — Owned images

Starting from pushed C049 a08b901 on codex/p2-migration. Use disposable profile stores and private Barkpark30c007 only. Preserve source/backup/workspace and legacy authority; no merge/deploy.

Audited `POST /v1/media/:dataset/upload` is non-idempotent and chooses a random filename/blob UUID. `GET /v1/media/:dataset` returns result.assets/total/hasMore and filters original filename with q; `GET /v1/media/:dataset/:id` checks ownership/dataset and returns metadata. Binary bytes are served from the captured origin plus validated `/media/files/` path. Do not trust configured absoluteUrl for an ephemeral local runtime and never follow credential-bearing redirects. Code anchors: upstream v1/media_controller.ex, media.ex, delivery/asset_response.ex and delivery/urls.ex at30c007.

Plan: strict same-profile attachment resolution, top-level PNG only, known alt/width/height attrs, exact byte inventory. A durable random attempt filename precedes the single upload request. Before first upload, refuse any pre-existing match. On resume, reconcile only one exact-name scoped candidate after metadata and byte-hash readback. Missing or ambiguous candidates stop; no speculative second POST. Bind receipts and image payload mapping into the immutable staging plan; preserve old unlinked plans. Native image atom supports src/alt/width and retains height; prove actual rendering and native Undo rather than assuming API equality.

Next: implement bounded adapter and unit checks, then actual interrupted upload/native image rehearsal. C049 Linux CI remains pending. No image implementation or native proof claimed yet. Six-hour run ends no earlier than04:17:20UTC.
