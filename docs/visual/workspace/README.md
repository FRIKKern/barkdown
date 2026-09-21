# workspace

Real desktop navigation with disposable local notes; no cloud or provider.

![Current view](../runs/2026-09-21T22-41-46-408Z/workspace-4.png)

![Recorded interaction](../runs/2026-09-21T22-41-46-408Z/workspace.gif)

[Full comparison](../runs/2026-09-21T22-41-46-408Z/README.md) · [Capture manifest](../runs/2026-09-21T22-41-46-408Z/manifest.json)

## Changelog

- 2026-09-21T22:43:25.993Z: E001 final harness review: inspected all 21 action frames across workspace, chat, side chat, documents and Settings after adding the Paper recovery capture tripwire. No changed pixels above tolerance, geometry change or environment drift; clean capture inputs at e19edfa. Nineteen controlled Paper races and four real-server recovery journeys separately prove behavior. Live Paper and recovery images remain distinct from these fixture tours; no crash-recovery or profile-isolation claim. Source e19edfa6d; [review](../runs/2026-09-21T22-41-46-408Z/comparison.json).
- 2026-09-21T22:36:22.255Z: E001: inspected all 21 deterministic action frames across five areas; no changed pixels above tolerance, geometry changes or environment drift. Paper save ownership is separately covered by 19 controlled races and real private-server delayed save, Undo/redo, Retry and cancelable discard checks. Reviewed nine Paper recovery stills including 760px layout, the action GIF, five live Paper stills and all 37 editing GIF frames; those are distinct from fixture tours. No crash-recovery or profile-isolation claim. Source 228a0084f; [review](../runs/2026-09-21T22-34-11-177Z/comparison.json).
- 2026-09-21T21:50:11.399Z: C002: reviewed all 21 action frames across five areas after folder-context and offline-fallback changes. No pixel differences above tolerance or control-geometry changes; environment unchanged. Request/dispatcher tests cover resumed and cleared folders, image-only turns and original-text offline navigation. Visual evidence does not measure live folder-answer latency. Source 3e2ed6fa0; [review](../runs/2026-09-21T21-48-36-561Z/comparison.json).
- 2026-09-21T21:34:25.844Z: Reviewed the CI startup-toast difference and corrected capture timing without hiding UI. New local capture matches all 21 prior frames and geometry; workspace dismissal image inspected again. Environment-change flag reflects newly recorded OS/architecture/font fields on the same local machine. Prior full visual and desktop regression evidence retained. Source 335b460f3; [review](../runs/2026-09-21T21-33-30-215Z/comparison.json).
- 2026-09-21T21:27:32.744Z: Repeatability review: all 21 action frames and control geometries match the inspected baseline within tolerance; environment unchanged. Initial full image review retained in prior approval. This records fixture UI only; live saves, provider behavior and recovery require their separate tests. Source e15d08c29; [review](../runs/2026-09-21T21-26-13-874Z/comparison.json).
- 2026-09-21T21:25:36.090Z: Initial baseline: inspected all 21 action frames across five areas, full-size settings and side-chat details, and GIF frame counts/dimensions. Navigation, menus, draft controls, themes and narrow layout remain visible. Fixture provider calls are blocked; no live save or recovery claim. Source e15d08c29; [review](../runs/2026-09-21T21-24-32-164Z/comparison.json).
