# API provider and real Paper

This area tracks API conversations using connected Paper through the actual SDK transport, Electron UI and a disposable real server. Model responses are scripted SSE fixtures; this does not prove authenticated model quality. The dedicated journey covers discovery, structured read, revision-checked paragraph/table edits, visible Undo and reload. Captured owner/endpoint/token and refusal cases are covered separately in `app/tests/api-paper.test.mjs`.

Run `npm --prefix app run test:api-paper:isolated` with `BARKDOWN_TEST_BP_SOURCE` pointing to the verified clean editor source; `BARKDOWN_EDITOR_CAPTURE=1` writes reviewable runs here. Freeze source before capture, inspect stills and video samples, record manifest/artifact hashes and keep original attribution. Source changes invalidate combined freshness even if earlier lane artifacts remain useful.

## Original failure history

[First real attempt](runs/2026-09-22T01-05-21-430Z/manifest.json) at7d6cf2f saved the paragraph through actual SDK/server, but revealed incorrect activity routing: the Paper opened as a local document and displayed an error. [Failure screenshot](runs/2026-09-22T01-05-21-430Z/failure.png) and video are retained. Private runtimepJWZEp stopped normally. cef73f8 corrects remote activity identity to match signed providers. Fresh actual evidence is pending; this is not an approved passing area.

[Second attempt](runs/2026-09-22T01-15-27-656Z/manifest.json) atfcb81fb found an initial host-load race: a fast agent edit notification arrived before canvas mount, leaving old visible content despite the acknowledged server save. [Failure screenshot](runs/2026-09-22T01-15-27-656Z/failure.png) reviewed;6dTR7W stopped normally. Failing-to-passing host regression now preserves/replays the notification after mount. Fresh actual passing evidence remains pending.

## Passing actual journey

[Reviewed run 01:45](runs/2026-09-22T01-45-39-232Z/README.md), clean `d8423e7`/`01dfdd663`, passes paragraph edit, multiline centered table edit, exact visible Undo and durable reload. Runtime `rReqHN` stopped normally. Four stills, 38 video samples and all 36 GIF frames inspected. Third attempt at `4d5dc21` reached correct visible edits but failed an array reference-equality fixture assertion; `d8423e7` corrects structural comparison. Earlier failed runs remain intact. Full combined regression and standard freshness gates remain pending.
