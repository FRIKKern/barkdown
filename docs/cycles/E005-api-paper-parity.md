# C017 / E005 — API provider Paper parity

Root-owned isolated branch codex/api-paper-parity-12h, based on verified9c77cb7. Current source audit proves API list/search/read/edit only access local documents; signed providers reach remote Paper through MCP. This is a real capability gap, not a settings difference.

Outcome: API conversations discover/read/edit connected Paper through the same captured run connection and revision-checked receipt adapter, with structured fallback for content Markdown cannot represent. Preserve local documents, per-chat folders, writes-disabled guards, read-before-write, stale-revision refusal, visible direct edits and Undo. Every remote request must retain the run owner after ambient profile/settings changes.

Ownership: agent.js and a dedicated API Paper test/harness. E004 owns table adapter, markdown/PortableDoc, MCP and upstream CSS; import its committed adapter before adding API edit_table. No concurrent edits to those files. C014 owns ordinary recovery and C015 owns goal coordination.

Validation: actual agent loop with deterministic provider responses and HTTP fixtures for discovery, structured read, saved receipt/Undo, stale/disabled/missing connection, owner switch and errors. Then real disposable Paper server and actual Electron/API tool journey, source-before-media, full desktop/root checks and reviewed screenshots. Fixture responses are not authenticated model proof. Legacy CLI follows the existing legacy connection mode; managed profiles require explicit captured endpoints. Do not claim shared CLI selection is profile-isolated.

Next: implement initial list/search/read/edit parity, test captured connection boundaries, then integrate E004 table tool and collect exact-source real evidence. No runtime owned.


Initial source511c26d: API list/search merges local and connected Paper results; remote reads cache revision/title and return structured fallback. Edits use the immutable run connection and captured receipt store; activity uses bp: identity. Existing local agent suite and new actual API-loop/HTTP fixture pass: captured A endpoint/token/dataset after ambient B switch, discovery/search, headerless structured read, remote save/Undo, unread/stale/disabled guards and explicit network errors. First fixture expected the wrong search URL slash; corrected without production workaround. Root/app npm ci and Chromium install completed; locked app dependencies reported two existing high advisories, no force upgrade.

A Python locale decoding error prevented test-script registration/docs finalization before511c26d; corrected using explicit UTF-8 in the next checkpoint. Full desktop/root checks and actual-server/UI evidence remain pending. E004 table adapter is not yet imported; this is not cycle completion. Legacy CLI retains existing behavior and is excluded from profile-isolation claims. No runtime owned.
