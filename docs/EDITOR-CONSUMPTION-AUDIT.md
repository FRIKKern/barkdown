# Editor fallback consumption audit

Offline audit on 2026-09-22. This is a proposed follow-on after E009/E010 native proof, not an asset update or upstream merge claim. E00925cb114/3495 and E0100c73c7f/54579 remain frozen. [Exact hashes and dependency inventory](editor-consumption-audit.json) bind the observed integration checkout and source.

## Exact change boundary

Barkdown app/BARKPARK_REF currently contains a5440345caa413087ac6488cac67f19fce58fa0f. Both current vendored editor files exactly match that upstream commit. Proposed source is 54579debe6ad4579c1a48586805498602867d983 on codex/canvas-upload-history; no upstream merge is implied.

| File to change | Current SHA1 | Proposed SHA1 |
|---|---|---|
| app/renderer/vendor/bp-paper-editor.bundle.js | 62b805268c6c4b687d4504cf292b50acef2b3e16 | c73a0f46c5402178721a9fe334a25a8a6f530d70 |
| app/renderer/vendor/bp-paper-editor.css | 63d19d9fd48133511f3d1feb8c5a15d33acb62c2 | 38197e09d17efc468a3dc875dbd59571e3aeb7c8 |
| app/BARKPARK_REF | a5440345caa413087ac6488cac67f19fce58fa0f | 54579debe6ad4579c1a48586805498602867d983 |

Copy those two assets byte-for-byte from api/priv/static/assets at the exact source. Do not regenerate or overwrite the entire vendor directory. A write:false esbuild reproduction produced the identical proposed JS SHA1 without changing the frozen checkout.

Keep bp-paper-popups.css byte-identical: this is Barkdown's extracted/adapted shell styling, including the compact format bubble, slash menu and link preview. The upstream shell stylesheet itself has no a544-to-54579 change and should not replace this extraction. Keep bp-flags.js (BP_PAPER_EDITOR_NO_INJECT=true); without it, the bundle can inject /assets CSS into the file renderer. Keep bp-paper-mermaid.js: it matches both source commits exactly (SHA1 9e947c9d2436ff521ecef9cc3b9450c7599cc0aa). The reader-only bp-paper-code.js, editor hooks and shell stylesheet are unchanged and are not newly required by the bundle. No new side asset is introduced by these edits.

Preserve app/renderer/paper-notion.css and the existing index.html stylesheet/script order. Update app/README.md fallback baseline, the parity matrix's dated consumption note and the active handoff/validation after proof. Add a small vendor provenance manifest/readme binding source SHA, each consumed hash and the intentionally preserved Barkdown overrides. Keep G1/G2 open until their independent gates actually close.

## License and attribution

BARKPARK-LICENSE exactly equals upstream LICENSE, Apache-2.0; preserve it unchanged (SHA256 in the inventory). The popup extraction's existing header says MIT while current upstream LICENSE is Apache-2.0. Do not silently erase the historical attribution or relabel the whole source MIT; record the extraction separately in the provenance note.

THIRD-PARTY.md currently says no production Barkpark code is copied, which is stale. Correct that statement for the actual shipped fallback and identify the source/license. The upstream package lock is unchanged between a544 and54579, so this update adds no dependency version. The read-only esbuild metadata identifies49 bundled packages:47 MIT and2 BSD-3-Clause. The generated JS has no bundled-license appendix; a Tiptap package's installed directory carries its MIT package metadata but no license text. Include a companion third-party notices file for the actual bundled closure, preserving installed ProseMirror/highlight/lowlight notices and obtaining the matching Tiptap copyright/license from its exact package source when preparing distribution. Do not treat the unchanged dependency graph or Barkpark's Apache text as a replacement for those notices. This audit records source facts; it does not claim distribution review is completed.

## Compatibility and delivery semantics

The a544-to54579 source diff changes editor JS/CSS and tests only; no API controllers, PortableDoc server modules, Elixir dependencies or editor package-lock bytes changed. The added applyServerBlocksIfIdle method is additive. Existing patch/acknowledgement methods and uploader injection remain. Clipboard tables use already-supported PortableDoc table fields; upload history flags do not serialize. No new API incompatibility was found in the diff. Actual new-client/old-server save/Undo/reload proof is still required before calling that compatibility validated.

Current integration resolver precedence is server, verified profile-owned cache, then vendor. Updating the fallback does not override an older reachable server or older valid cache. BARKPARK_REF selects the parity CI source checkout; it is not a runtime auto-updater. Custom elements load once per renderer, so restart is required when changing the active build. Preserve those source/ownership diagnostics and avoid relabeling cached/server bytes as the new fallback.

## Meaningful follow-on checks

1. Byte checks: pin equals provenance source, consumed JS/CSS equal committed upstream bytes; preserved popup/flags/Mermaid/license hashes are unchanged. Regenerate the bundle from locked dependencies and compare hashes; retain the existing upstream full-suite result and exact native E009/E010 evidence.
2. Main resolver checks: no server plus empty cache yields the new vendor SHA; bad JS/CSS hashes, foreign origin and linked paths refuse cache; healthy verified cache retains its own provenance. Run current canvas-bundle.test.mjs, including CSS-only immutable pairs and interruption/repair cases.
3. Actual renderer fallback: fresh disposable profile, new process, no valid cache, deliberately unavailable asset fetch. Assert source:vendored and loaded JS/CSS hashes, then mount real Paper. Exercise aligned/table multiline paste, no-op unsupported clipboard selection, one actual image upload across Undo/Redo, later human input and server reload. Use the private server for document/media calls while refusing only its editor-asset endpoint; do not mock save acknowledgement.
4. Compatibility: run that fallback client against a544 as well as the selected source, retaining current revision/conflict protection. Verify the older-bundle safety path separately where the old server legitimately wins resolution; do not claim the new behavior runs there.
5. Presentation: actual wide/narrow format bubble, slash/link popups,200% recovery notice, table header newlines and image fields. Inspect continuous action frames for clipping or movement with Barkdown's preserved popup and Notion CSS. Then deterministic visual capture/compare, named image approval, live status and full root/app/parity gates as applicable. Implementation commit precedes captures; evidence commit follows review.

This audit changed documentation only in codex/editor-consumption-audit. No fallback, pin, runtime, foreground UI, shared checkout or production source was changed.
