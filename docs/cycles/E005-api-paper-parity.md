# E005 — API provider Paper parity

Root-owned isolated branch codex/api-paper-parity-12h, based on verified9c77cb7. Current source audit proves API list/search/read/edit only access local documents; signed providers reach remote Paper through MCP. This is a real capability gap, not a settings difference.

Outcome: API conversations discover/read/edit connected Paper through the same captured run connection and revision-checked receipt adapter, with structured fallback for content Markdown cannot represent. Preserve local documents, per-chat folders, writes-disabled guards, read-before-write, stale-revision refusal, visible direct edits and Undo. Every remote request must retain the run owner after ambient profile/settings changes.

Ownership: agent.js and a dedicated API Paper test/harness. E004 owns table adapter, markdown/PortableDoc, MCP and upstream CSS; import its committed adapter before adding API edit_table. No concurrent edits to those files. C014 owns ordinary recovery and C015 owns goal coordination.

Validation: actual agent loop with deterministic provider responses and HTTP fixtures for discovery, structured read, saved receipt/Undo, stale/disabled/missing connection, owner switch and errors. Then real disposable Paper server and actual Electron/API tool journey, source-before-media, full desktop/root checks and reviewed screenshots. Fixture responses are not authenticated model proof. Legacy CLI follows the existing legacy connection mode; managed profiles require explicit captured endpoints. Do not claim shared CLI selection is profile-isolated.

Next: implement initial list/search/read/edit parity, test captured connection boundaries, then integrate E004 table tool and collect exact-source real evidence. No runtime owned.
