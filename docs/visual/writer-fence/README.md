# Writer admission and migration preparation

Captured foreground, provider, MCP and goal contexts cannot silently acquire a new writer generation. Failed or interrupted mutations retain uncertain admissions; a dead process alone cannot clear them.

![Save refusal with the unsaved text still visible](runs/2026-09-25T11-50-28-240Z/02-save-refused-buffer-retained.png)

Disposable private Paper, dark mode: typing after quiescence remains visible with a save refusal. This is an internal test controller, not a shipped migration button.

![Typing, refusal and narrow layout](runs/2026-09-25T11-50-28-240Z/writer-refusal.gif)

The full-frame excerpt shows typing, refusal and the deliberate narrow resize. [Full edit recording](runs/2026-09-25T11-50-28-240Z/page@9b539dc0173381de27bf4c7053f4249b.webm), [restart recording](runs/2026-09-25T11-50-28-240Z/page@460735364e5a3c57b5c7555476fcc945.webm), [manifest and stills](runs/2026-09-25T11-50-28-240Z/manifest.json), [named review and encoding](runs/2026-09-25T11-50-28-240Z/review.json). Source4e618ef7; private upstreamb70214090.

[Behavior evidence](../../cycles/evidence/C075/README.md) proves stale native/MCP/goal writes refuse, admitted asynchronous writes remain tracked, interrupted writers remain uncertain, and original/server bytes survive. The narrow pane is cramped but controls remain reachable. Restart shows readable original history and an honest refused workspace-save toast.

This does not restore a dirty buffer after abrupt restart, fence arbitrary external clients, reconcile uncertainty, select a migration authority or retire the legacy editor. Those remain A2.

## Changelog

- 2026-09-25, C075: reviewed4 native stills,103 raw samples at1fps and all59 excerpt frames. The [earlier recording](runs/2026-09-25T11-40-27-781Z/REJECTED.json) remains rejected for capture scale/clipping; the corrected capture uses actual BrowserWindow geometry.
