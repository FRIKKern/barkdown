# C087 — Retiring the legacy editor

**Status:** done 2026-10-01; opened 2026-09-30 on the user's go ([D-legacy-retirement](../DESIGN-DECISIONS.md#d-legacy-retirement--go-2026-09-30)). The stages are [legacy-retirement.md](../migration/legacy-retirement.md): R1 read-only rendering, R2 profiles by default with adoption, R3 a runtime by default, R4 removal. [C086](C086-packaged-runtime.md) is paused behind this cycle.

**Outcome:** R1 to R4 are in. The app no longer writes the legacy store, the legacy editor and its packages are gone, profiles are the ordinary launch and a new profile starts on Paper.

**R1 read-only rendering (`shared/doc-html.js`):** a retained original or a read-only copy is rendered from its blocks with no editor mounted; links open as before. Asserted in the switch rehearsal: the retained original shows its text, nothing on the page is editable. [D-read-only-render](../DESIGN-DECISIONS.md#d-read-only-render--retained-originals-without-the-editor-2026-09-30).

**R3 runtime by default:** a never-configured profile runs the carried runtime, or else the runtime this installation last started. Asserted in the portable-profile rehearsal: a profile created from Settings runs its runtime with no setup. [D-runtime-default](../DESIGN-DECISIONS.md#d-runtime-default--a-new-profile-starts-on-a-known-runtime-2026-09-30).

**R2 profiles by default (`870cc68c`):** an ordinary launch opens profiles; a legacy library beside no registry is offered for adoption at launch (adopt, not now, quit); `--legacy` keeps the legacy library for the 61 development tours that still need it. [Rehearsal](evidence/C087/live/2026-09-30T20-00-38-778Z-launch-default/result.json): a fresh launch, adoption from the offer with notes, chats and settings arriving and the legacy files untouched, not now, and a `--legacy` launch. [D-profiles-default](../DESIGN-DECISIONS.md#d-profiles-default--profiles-are-the-ordinary-launch-2026-09-30).

**Limits:** the adoption offered at launch is the existing adoption; a library with a managed runtime is covered by the runtime adoption tour, not here. Tours that write the legacy library still exist and pass `--legacy`; R4 moves or retires them.

**R4 removal:** the legacy write requests refuse with one reason, the assistant's tools refuse on legacy notes, New page without a runtime says so, rename and delete of a legacy note are refused, and the legacy tab is a read-only rendering; the eight `@tiptap` packages left `app/package.json`. Tours that used legacy writes as their vehicle now expect the refusal; the legacy agent-edit tour is retired; the native-defaults migration test builds by hand what the retired editor persisted, and fixtures that need libraries of the retired era (receipts, revisions) build them through a fixture-only option of the edit service that the app never passes. A rolled-back library is read-only until switched again, which the switch rehearsal now asserts.

**Limits after R4:** the provider truth runner (`tests/providers.live.mjs`) proved successful assistant edits on a legacy document; those three scenarios (approval, success, delayed finish) now need a Paper runtime and are skipped in the unit suite until the harness makes its document a Paper under the isolated runtime. No Windows run yet.

**Closeout (2026-10-01):** unit suite 684 cases green; the legacy journey, the [switch](evidence/C083/live/2026-09-30T21-09-23-992Z-switch-ui/result.json) and [launch](evidence/C087/live/2026-09-30T21-14-12-290Z-launch-default/result.json) rehearsals pass at the R4 commit; visual run approved, pixel-identical. Not chased: the writer-fence tour outside the suite predates the preparation gate and expects a writer refusal where the gate now answers first. Still owed to P2: the real-library review on Windows. Repository clutter: none new; `runtime/` (ignored) holds the built runtimes.

**Next action:** none in this cycle; resume [C086](C086-packaged-runtime.md) until the Windows machine is back.
