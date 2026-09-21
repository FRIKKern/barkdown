# settings

Real Settings navigation. No server connection or credential is configured.

![Current view](../runs/2026-09-21T21-48-36-561Z/settings-3.png)

![Recorded interaction](../runs/2026-09-21T21-48-36-561Z/settings.gif)

[Full comparison](../runs/2026-09-21T21-48-36-561Z/README.md) · [Capture manifest](../runs/2026-09-21T21-48-36-561Z/manifest.json)

## Changelog

- 2026-09-21T21:50:11.399Z: C002: reviewed all 21 action frames across five areas after folder-context and offline-fallback changes. No pixel differences above tolerance or control-geometry changes; environment unchanged. Request/dispatcher tests cover resumed and cleared folders, image-only turns and original-text offline navigation. Visual evidence does not measure live folder-answer latency. Source 3e2ed6fa0; [review](../runs/2026-09-21T21-48-36-561Z/comparison.json).
- 2026-09-21T21:34:25.844Z: Reviewed the CI startup-toast difference and corrected capture timing without hiding UI. New local capture matches all 21 prior frames and geometry; workspace dismissal image inspected again. Environment-change flag reflects newly recorded OS/architecture/font fields on the same local machine. Prior full visual and desktop regression evidence retained. Source 335b460f3; [review](../runs/2026-09-21T21-33-30-215Z/comparison.json).
- 2026-09-21T21:27:32.744Z: Repeatability review: all 21 action frames and control geometries match the inspected baseline within tolerance; environment unchanged. Initial full image review retained in prior approval. This records fixture UI only; live saves, provider behavior and recovery require their separate tests. Source e15d08c29; [review](../runs/2026-09-21T21-26-13-874Z/comparison.json).
- 2026-09-21T21:25:36.090Z: Initial baseline: inspected all 21 action frames across five areas, full-size settings and side-chat details, and GIF frame counts/dimensions. Navigation, menus, draft controls, themes and narrow layout remain visible. Fixture provider calls are blocked; no live save or recovery claim. Source e15d08c29; [review](../runs/2026-09-21T21-24-32-164Z/comparison.json).
