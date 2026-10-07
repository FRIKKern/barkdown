# Import identity and content preservation

The actual importer at5b8d2bb8 rewrites every occurrence of the exported profile ID and Paper owner in serialized JSON. A valid archive whose human text mentions either identity therefore changes that text during import. This is an unresolved preservation defect, separate from the repaired path/file-alias checks.

[Initial probe](import-identity-probe-initial.mjs) and [receipt](import-identity-characterization-initial.json) retain the first reproduction. The [extended probe](import-identity-probe.mjs), [receipt](import-identity-characterization.json) and [failed preservation assertion](import-identity-02/result.json) bind the importer SHA-256. The extended run took345ms; the initial run took294ms. These are actual import, registry, store and deletion-record modules with a **stubbed database restore** and owned temporary archives. No native database, provider, UI, real library or Mac export was used. Source archive bytes and retained originals remain unchanged in every case.

| Case | Observed result |
| --- | --- |
| Valid profile UUID and owner | Structured navigation re-owned, but matching draft/title/message/tool-output/folder/tab-title/receipt-summary/Undo-before text changed. Import journal says imported. |
| Deletion snapshot containing identity text | Production deletion list reads the source record. After import it refuses the record: snapshot text changed while snapshotHash remained the original. No recovery request was sent. |
| Empty profile ID | Destination created and restore called; journal says imported while workspace JSON is unreadable. |
| Missing profile ID | Destination created and restore called; journal says imported without correctly re-owning the root profile identity. |
| Short profile ID `note` | Destination created and restore called; substring replacement changes content/paths; root identity remains wrong. |

The preservation assertion deliberately remains failed. This receipt is a defect characterization, not acceptance. It also does not show an actual Undo operation restoring altered content: it proves the stored before-content was changed. Native save, recovery and Undo require later integration proof after repair.

## Repair boundary established by source review

`app/main/profile-import.js` owns orchestration and currently performs raw string replacement. Replace that with explicit transformations for the actual persisted formats, after validating manifest identity and all transformed payloads **before** creating a destination or restoring a database. Preserve the source archive. Reject unsupported or ambiguous records with a useful reason; do not silently omit them or repair content by recomputing hashes over altered text.

| Persisted format / actual reader | Fields to inspect and re-own | Content to preserve |
| --- | --- | --- |
| workspace.json: renderer state, workspace-repository, pages, paper-navigation | Root profileId; known Paper tab/favorite/direct-tab owners; exact owned Page keys in roots, children and expansion/archive/label maps; relevant ownership contexts after schema audit | Drafts, messages, tool payloads, API history, chat IDs/relationships, titles, working folders, file/website paths, Page labels/order and arbitrary user data, including keys named profileId inside tool data |
| selection.json: migration-selection | Root profileId and explicitly owned paperOwner/target fields | Operation IDs, hashes and retained rollback payloads; selection/ remains verbatim under the existing contract |
| paper-creation records: draft-notes | Root profileId and paperOwner | Request ID, nonce, contentHash, status and content identity |
| paper-deletions records: paper-deletions | Root profileId and paperOwner | Snapshot, snapshotHash, revision, key, recovery request and copy identity; list/recover must still validate |
| agent-edits records: agent-edits | Receipt paperOwner plus filename derived from document ID and owner | documentId, revisions, before-content, summary and receipt identity; original evidence must remain recoverable |
| paper-proposals.json: documents | Each proposal's actual paperOwner | Grouping slug, proposal content and identity |
| documents/, attachments/, selection/ | Existing verbatim contract | All original bytes |

The agent-edit reader computes `remote-SHA256(JSON.stringify([documentId, owner])).json`; the current importer rewrites file contents but copies the old filename. **Source-review finding:** the repair must audit and migrate this key, detect destination collisions and verify `latest`/Undo with the new owner. The current fixture uses a generic receipt path to isolate content substitution, so it does not independently reproduce the filename lookup failure. Do not treat a global recursive key-name replacement as a fix: tool results and document content can contain the same property names.

Regression exits for the future repair: all demonstrated cases refuse or preserve correctly; ordinary navigation still re-owns; other-owner records stay isolated; deletion list and guarded recovery remain readable; imported agent receipts are discoverable and Undo preserves exact content; malformed metadata and unsupported transformed payloads refuse before destination creation. Then run adjacent import/export/portable checks, native two-installation import with matching identity strings in human content, required visuals and full gates. Retain these original failures. Broader filesystem races, cross-machine transfer and historical media reconciliation remain separate gaps.

This is preparation while the previous batch's CI runs. No application, runtime, dependency or capture input changes were made. The existing migration estimate remains unchanged: this is an additional bounded refusal/preservation gap within the already uncertain recovery/portability work, not completed scope or a stage exit.
