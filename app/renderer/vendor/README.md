# Shipped Paper editor fallback

The JavaScript and CSS are byte-exact Barkpark sourcebf23f773ce59ef148a6e6eeb1374f64d9e2aa81f from codex/canvas-block-identity. This is an explicitly selected working branch, not a claim of upstream merge or release. See [provenance](paper-editor-provenance.json) for consumed and preserved asset hashes.

The connected server wins, then its verified profile-owned cache, then this fallback. Updating these files or BARKPARK_REF does not upgrade an older reachable server or valid old cache. The renderer must restart to change its loaded custom element.

[Barkpark Apache-2.0 license](BARKPARK-LICENSE) is preserved. [Bundled dependency notices](paper-editor-notices/manifest.json) retain49 version-bound package notices plus exact source provenance. They ship under renderer/** beside the bundle. Historical bp-paper-popups.css header says MIT; it is Barkdown's adapted extraction and differs from current upstream licensing. Its header and bytes remain unchanged; this does not relabel the full editor MIT. Flags and Mermaid helper also remain unchanged.

E012 adds stable native split/checklist identities and projection ownership that prevents phantom Undo entries. Exact connected-source native split/checklist/history/reload and the full upstream suite pass. New fallback compatibility is pending. Earlier E011 consumed54579; its image-upload/history compatibility was exercised against both a544 and54579 servers while only editor assets were refused. The E011 repository handoff records exact evidence and remaining full release gates; unfinished-upload restart recovery and every PortableDoc operation are not established by that bounded proof.
