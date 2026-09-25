# Consumed Paper editor baseline

C074 consumes merged Barkpark `b702140907921e82e9ce5eecb3e2445f13ab2d6e` from main (PR #20020). The locked esbuild reproduction exactly matches committed JavaScript; CSS is copied byte-for-byte. The bundled closure and all 49 notice versions/texts remain unchanged and verified. [Hash inventory](editor-consumption-audit.json), [shipped provenance](../app/renderer/vendor/paper-editor-provenance.json) and [C074 validation](cycles/C074-original-history.md) separate byte provenance from runtime proof.

Barkdown popup styling, flags, Mermaid helper and original Barkpark license are preserved. Resolution remains connected server → verified profile-owned cache → vendored fallback; this pin does not update a reachable older server or cache. Restart the renderer to change its loaded custom element.

The [22 September audit](archive/editor-consumption/2026-09-22-audit/README.md) is historical preparation for E011, not current instructions. Earlier E011 fallback proof against a544/54579 remains in [its evidence](visual/fallback-consumption/IMPORT.md). C074 must establish the newly consumed fallback and live regression proof before G1 closes; G2 cross-repository enforcement is independent. No deployment or migration authority change is implied.
