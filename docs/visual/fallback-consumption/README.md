# Paper fallback compatibility

**Current baseline:** C074 consumes merged b70214090. [Exact manifest](runs/2026-09-25T10-24-51-699Z/manifest.json), [review](runs/2026-09-25T10-24-51-699Z/review.json) and [recording](runs/2026-09-25T10-24-51-699Z/fallback-consumption.webm) prove actual vendored loading, real upload, Undo/Redo, later human save and reload on the merged private server. All6stills/77video samples inspected; light mode preserves the historical contrast/layout comparison. Narrow metadata truncation remains.

Earlier E011/E012 evidence follows; it does not identify today's pin.

E011 candidate consumes exact54579 editor JS/CSS and ships49 dependency notices, preserving the host popup/flags/Mermaid/license. Both actual native compatibility runs passed: the proxy refused only editor asset fetches while actual Paper/media/ops used disposable servers. Old a544 and intended54579 runs reported vendored and loaded the pinned bytes before upload/history/reload assertions.

[Cycle handoff](../../cycles/E011-fallback-consumption.md). Server→verified profile-owned cache→vendor precedence is unchanged. An older reachable server or valid old cache still wins. This establishes bounded native compatibility, with no upstream merge or unfinished-upload restart-recovery claim.

## Actual compatibility runs

Both native runs use cleancefe312 consumed source, exactvendored545 hashes and actual document/media traffic.

| Private server source | Proof | Motion |
|---|---|---|
| a5440345c | [Manifest and server state](runs/2026-09-22T05-23-20-987Z/manifest.json), [review](runs/2026-09-22T05-23-20-987Z/review.json) | ![Old-server upload history](runs/2026-09-22T05-23-20-987Z/fallback-history.gif) |
| 54579debe | [Manifest and server state](runs/2026-09-22T05-24-51-920Z/manifest.json), [review](runs/2026-09-22T05-24-51-920Z/review.json) | ![Current-server upload history](runs/2026-09-22T05-24-51-920Z/fallback-history.gif) |

Each run preserves one actual uploaded image across repeated native Undo/Redo and later human revision9/reload. All12stills,78video samples at2fps and32decodedGIFframes were inspected. This establishes bounded image/paragraph compatibility, not all PortableDoc operations or recovery after restarting an unfinished upload. Earlier pending text is the retained preparation checkpoint. Final visual/full gates are recorded in the handoff.

## E012 consumption replay

After consuming Barkpark `bf23f773c` and vendored JS `3a94a2964b37358f3ec791f009a2f52b28cffb0d`, the same real upload/history/reload journey passed against both the historical `a5440345c` server and the current `bf23f773c` server. In both runs the proxy refused live editor JS/CSS, proving the app exercised the vendored bundle while forwarding real document, media and operation traffic.

| Private server source | Proof | Motion |
|---|---|---|
| a5440345c | [Manifest](runs/2026-09-22T22-19-48-916Z/manifest.json), [named review](runs/2026-09-22T22-19-48-916Z/review.json) | [Raw recording](runs/2026-09-22T22-19-48-916Z/fallback-consumption.webm) |
| bf23f773c | [Manifest](runs/2026-09-22T22-21-27-598Z/manifest.json), [named review](runs/2026-09-22T22-21-27-598Z/review.json) | [Raw recording](runs/2026-09-22T22-21-27-598Z/fallback-consumption.webm) |

All 12 stills and the complete recordings were independently inspected. Upload pending, Undo before delivery, acknowledged Redo, repeated history, human revision 9, reload and 900px layout retained the image and surrounding content. Narrow media metadata values truncate inside their fields; no metadata-input usability fix, unfinished-upload restart recovery or global release readiness is claimed.
