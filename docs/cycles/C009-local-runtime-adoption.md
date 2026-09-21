# C009 — Cold managed-runtime adoption

Status: active. Source baseline C0077435ca5; branch codex/cycle-next-12h. C007 completed record remains archived beside its handoff. Central queue is coordinator-owned.

## Bounded goal and acceptance

Add a trusted-main helper that copies an existing stopped managed runtime into an inactive UUID profile, in disposable fixtures only. Preserve source and verified backup, original media origin/ports and encrypted credential bytes. Publish runtime descriptor only after verified copy; interruption/retry must not duplicate or reseed. Rollback removes destination runtime authority while retaining copied data and source/backup. Prove source/destination sequential restart with the same notes/media/credentials. This is same-machine cold-copy adoption, never a portable export.

## Audit and authority contract

Legacy runtime lives at local-barkpark/default: pgdata, media, optional indx/bundles and seeded. runtime-build is regenerable; owner locks, boot-ready and logs are operational state, excluded from destination payload and retained in source. PostgreSQL tablespaces/reparse links are refused. Entire pgdata is copied only after explicit clean shutdown control-state verification, absent postmaster.pid and exclusive SourceDriver-compatible owner lease; no process is killed. Cooperating Barkdown writers must remain closed throughout; unrelated external writers cannot be made safe by a Node lease.

Credential bytes live in local-credentials.json, separate from runtime. enc: values are machine/account bound; plain: fallback is existing format. Trusted callback must unlock both password/token before staging, and bytes must match destination shell credentials; no generated credentials. Settings barkpark.local provide original source/HTTP/Postgres ports; retained ports preserve saved absolute media URLs. Source and adopted copy are mutually exclusive at the same origin; port occupancy is refused, never stolen. Browser partition and userData/canvas-bundle lie outside legacy root; cache can regenerate, browser sessions are not migrated.

The additive API targets an already staged inactive UUID profile with no descriptor and matching credential bytes. This does not yet bridge C003's refusal of full local-barkpark roots or perform default authority selection. C006 remains explicit opt-in desktop authority; combined shell/runtime cutover requires additional integration proof. No main/preload/renderer edits in this lane.

## Plan before implementation

1. Audit tools/control-state and define durable phase/backup manifests.
2. Add helper and interruption/rollback/corruption/refusal fixtures.
3. Commit source; obtain source slot for real cold source/destination restart proof.
4. Complete desktop/root regression and screenshot capture/compare/actual review/evidence commit.

No C009 process started or user data touched. Next: implement scoped copy/recovery helper and fail-closed cold checker. P1 remains pending.

## Source checkpoint 926b22f

Additive helper implemented and pushed. Registry descriptor lease and source/destination owner leases exclude cooperating writers. Streamed hashing/copy uses bounded buffers and atomic per-file publication; partial temp copies remain retained outside payload. Named receipt phases prepared/backed-up/copied/committed and rollback retirement are recoverable. Runtime pool refuses incomplete/rolled-back receipts and absent/mismatched committed descriptors, preventing accidental empty-database startup after interruption.

Unit groups pass: backup/origin/credential retention, cache exclusion, six exception checkpoints, five actual process exits, refusal of changed credentials/source/unknown files/junctions, rollback interruption and start gating. Actual installed PostgreSQL18 pg_controldata checker returned clean shut down on an earlier stopped disposable C007 cluster. This follows PostgreSQL's filesystem-backup requirement for a stopped full cluster ([official guidance](https://www.postgresql.org/docs/18/backup-file.html)); external tablespaces are deliberately unsupported.

Current real fixture is qKEZPn under the temporary barkdown-cold-runtime directory, session40638, launched from clean926b22f. Source slot granted by root; source runtime preparing. Full desktop regression session41770 and deterministic capture are running independently. No live adoption pass yet. Next: finish real source→cold backup→destination edit→rollback→source restart proof, stop all owned services and release source slot before C006 uses it.
