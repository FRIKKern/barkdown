# Remaining PostgreSQL native source candidates

Actual NSIS05 bytes of testplug.dll, plugin_debugger.dll and system_stats.dll match the preserved publisher audit. The debugger's54 exports match the complete current EDB source declaration roster; its control and principal SQL match after newline normalization, while raw originals differ and are preserved. System-stats'22 exports match the v3.2.1 declaration roster. These establish source candidates, not exact compiled source revisions.

Static Pg_magic_func instruction/data review against the exact PostgreSQL18.4 header observes ABI18 and null module-name/version pointers in both EDB DLLs. It cannot supply an extension version. ICU's testplug project/PDB path is associated, but the actual DLL has no export directory or ICU import; the source is conditional on UCONFIG_ENABLE_PLUGINS. That does not prove a compiler flag or remove its source obligations.

[Review](review.json), [native exports/imports](native.json), [source candidates](sources.json), [raw originals](originals.json) and [retained comparison failure](source-comparison-failure.json). Every raw source/text/tool input is losslessly encoded and hash/roundtrip checked. Existing notice audit gaps remain open; no candidate is relabeled as an exact compiled version.

The ASAR has only22 native-suffix npm files, all already covered node-pty files; provider platform binaries are deliberately excluded and user CLI discovery is traced. No DLL/function/installer execution or runtime/application/dependency/pin/capture change. Full notice/source/CRT/clean-machine and A5 acceptance remain open.
