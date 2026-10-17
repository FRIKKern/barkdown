# Native Windows media custody

Twenty disposable NTFS scenarios pass in30,339ms, including exact empty/nonempty handoff, locked/changed/aliased objects, target collision, controller failure and termination before/after rename. A held native handle moves the exact object to a separate unused same-volume quarantine destination. Its inode and bytes remain exact; no file is purged.

A sealed pre-move record precedes the rename. After worker termination, bounded inspection observes an unmoved original or retained custody. A later file at the old path stays untouched; changed custody or record refuses a settled result. All results still deny deletion/recovery authority and physical settlement. Caller declarations do not prove a committed server intent or complete runtime writer fence.

[Source-hash-bound result](result.json), [twenty case records](cases.json), [raw test output](test.log), [independent disk/process review](disk-review.json), [retained first failure](../native-01-failed/result.json). Implementationc2ee93f0 on Windows10.0.26200/x64; two Node groups, zero skips/failures. Test outputs include synthetic local paths, not credentials or real library content. All temporary files remain for diagnosis.

The first move refused because of target-directory sharing. The corrected directory permits the kernel's FILE_ADD_FILE open while denying deletion/rename; the source file and prepared record remain sealed against ordinary writes/deletion, and target replacement stays disabled. Attribute changes are detected separately. Flush(true)/WriteThrough and process termination are tested; power-loss durability is not established.

No API endpoint, runtime pin, installer, source-server behavior, UI, real library, purge/restore or A2/A3/A5 acceptance changes. Existing reviewed Windows app visuals remain applicable; the generated roadmap is reviewed separately. [Full current root verification](../verify-02/result.json) passes98,903ms, including a fresh20-scenario native run and existing media/visual/concept gates. Publication and exact hosted join follow.
