# Export subtree ownership

At58da49a4 the exporter rejects linked directory entries but follows a link used as the subtree root itself. A real Windows junction from disposable profile attachments to a distinct outside-profile sentinel is accepted; the [expected-refusal regression fails](export-link-before-01/result.json). The fixture stays inside one temporary root and contains no real content.

The repair checks each walked directory with lstat before readdir, including the initial attachments/media root. Optional absent trees remain allowed; a dangling link is inspected and refused rather than silently treated as absent. The [original regression passes](export-link-after-01/result.json), and [35 adjacent tests](export-link-adjacent-01/result.json) pass1.710s, including media-root, nested-link and dangling-root refusal. Tests require unchanged outside sentinel bytes, no completed manifest or copied outside bytes, and reopening/release of the operation’s held runtime lease. Existing manifest-path refusal and valid export/import tests remain gates.

Scope: static directory symlinks/junctions at the walked root or entries. This is not complete filesystem alias, hard-link, top-level single-file or substitution-race proof. The prepared inventory contract retains broader ownership requirements.

Implementation b4e85d7f passes [real logical export/restore](export-link-native-01/result.json) in 51.721 s. The [native receipt](../C085/live/2026-10-07T10-12-01-148Z-export/result.json) proves held-write refusal/reopening, manifest verification, machine-secret exclusion and scratch-database restoration with matching Papers. This is a headless disposable profile with controlled foreground hooks, not a new UI import or Mac transfer.

[Capture11](capture-11/result.json) passes for private Paper, standard fixtures and comparison. [Named image review](review-export-link.json) covers all new stills/differences and decoded motion; only temporary Settings path characters change, with unchanged geometry. [Root verification19](verify-19/result.json) passes43.664s. Current-head hosted integration remains required after publication.
