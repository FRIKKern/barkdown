# C087 — Retiring the legacy editor

**Status:** active, opened 2026-09-30 on the user's go ([D-legacy-retirement](../DESIGN-DECISIONS.md#d-legacy-retirement--go-2026-09-30)). The stages are [legacy-retirement.md](../migration/legacy-retirement.md): R1 read-only rendering, R2 profiles by default with adoption, R3 a runtime by default, R4 removal. [C086](C086-packaged-runtime.md) is paused behind this cycle.

**Outcome so far:** R1 and R3 are in. Nothing removed yet.

**R1 read-only rendering (`shared/doc-html.js`):** a retained original or a read-only copy is rendered from its blocks with no editor mounted; links open as before. Asserted in the switch rehearsal: the retained original shows its text, nothing on the page is editable. [D-read-only-render](../DESIGN-DECISIONS.md#d-read-only-render--retained-originals-without-the-editor-2026-09-30).

**R3 runtime by default:** a never-configured profile runs the carried runtime, or else the runtime this installation last started. Asserted in the portable-profile rehearsal: a profile created from Settings runs its runtime with no setup. [D-runtime-default](../DESIGN-DECISIONS.md#d-runtime-default--a-new-profile-starts-on-a-known-runtime-2026-09-30).

**Next action:** R1 and R3: a retained original renders without the editor, a new profile starts on the remembered or carried runtime; both rehearsed in Electron.
