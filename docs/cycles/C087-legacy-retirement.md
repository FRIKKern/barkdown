# C087 — Retiring the legacy editor

**Status:** active, opened 2026-09-30 on the user's go ([D-legacy-retirement](../DESIGN-DECISIONS.md#d-legacy-retirement--go-2026-09-30)). The stages are [legacy-retirement.md](../migration/legacy-retirement.md): R1 read-only rendering, R2 profiles by default with adoption, R3 a runtime by default, R4 removal. [C086](C086-packaged-runtime.md) is paused behind this cycle.

**Outcome so far:** R1, R2 and R3 are in. Nothing removed yet.

**R1 read-only rendering (`shared/doc-html.js`):** a retained original or a read-only copy is rendered from its blocks with no editor mounted; links open as before. Asserted in the switch rehearsal: the retained original shows its text, nothing on the page is editable. [D-read-only-render](../DESIGN-DECISIONS.md#d-read-only-render--retained-originals-without-the-editor-2026-09-30).

**R3 runtime by default:** a never-configured profile runs the carried runtime, or else the runtime this installation last started. Asserted in the portable-profile rehearsal: a profile created from Settings runs its runtime with no setup. [D-runtime-default](../DESIGN-DECISIONS.md#d-runtime-default--a-new-profile-starts-on-a-known-runtime-2026-09-30).

**R2 profiles by default (`870cc68c`):** an ordinary launch opens profiles; a legacy library beside no registry is offered for adoption at launch (adopt, not now, quit); `--legacy` keeps the legacy library for the 61 development tours that still need it. [Rehearsal](evidence/C087/live/2026-09-30T20-00-38-778Z-launch-default/result.json): a fresh launch, adoption from the offer with notes, chats and settings arriving and the legacy files untouched, not now, and a `--legacy` launch. [D-profiles-default](../DESIGN-DECISIONS.md#d-profiles-default--profiles-are-the-ordinary-launch-2026-09-30).

**Limits:** the adoption offered at launch is the existing adoption; a library with a managed runtime is covered by the runtime adoption tour, not here. Tours that write the legacy library still exist and pass `--legacy`; R4 moves or retires them.

**Next action:** R4: remove the legacy write paths and the Tiptap packages; keep the readers, retained originals, rollback and adoption; stop when no code path writes the legacy store and the app builds without `@tiptap`.
