# C009 — Cold managed-runtime adoption

Status: done for bounded cold-runtime proof; P1 remains pending. Source baseline C0077435ca5; branch codex/cycle-next-12h. C007 completed record remains archived beside its handoff. Central queue is coordinator-owned.

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

## Real proof checkpoint

Fixture qKEZPn passed all four live phases on clean926b22f against clean a5440345c. Source running refusal left it untouched; normal stop and PG18 control-state verification preceded streaming backup/copy. Adopted runtime returned the same note revision/content and original absolute media bytes, accepted a revision-checked edit, and refused rollback while live. After destination stop/rollback, source restarted with its unchanged original note/revision/media. All owned services stopped, postmaster pidfiles absent, no cleanup errors; source slot explicitly released to C006.

[Live report](C009-runtime-evidence.json) and [backup recheck](C009-backup-evidence.json) retain exact paths and manifest digest. Independently rehashed1915 backup files /74,656,550 bytes after the source restart; all matched the frozen source-at-copy manifest. PostgreSQL control files legitimately change on restart, so post-restart source verification is semantic note/revision/media equality, not a false whole-directory byte-equality claim.

Source656378c adds partial-unpublished-copy rollback: missing pg_control in a never-published destination no longer prevents retiring its receipt; live pidfiles/owners still refuse and data remains retained. Targeted fixtures including repeat rollback passed. Full desktop suite passed926b22f (76 Electron assertions plus direct edit,100-entry history and side-chat restart). Final656378c deterministic capture2026-09-21T23-19-56-866Z was compared, all21 frames inspected, and explicitly approved with zero pixel/geometry change. Earlier926b capture retained unapproved because final source changed. Live Paper status capture and final root verification still pending behind C006 source slot; do not mark done yet.

## Missing-data guard checkpoint

Source63def04 closes a fail-open edge found in final review: a committed adoption receipt whose PG_VERSION or seeded marker later disappears must not allow SourceDriver to create/reseed an empty replacement. Both helper retry and pool startup now refuse it. New missing-marker tests passed, along with the entire adoption suite and all13 pool cases. Source656378c deterministic approval is preserved as historical evidence; final63 capture is in progress. No services currently owned. Root agreed the next slice after closeout is an explicit combined shell/runtime staged-authority bridge; do not expand C009's claim to cover that future work.

Final source63def04 deterministic run2026-09-21T23-23-57-750Z is now compared, all21 frames inspected, and named approval recorded. Prior candidate/approval histories remain intact. Only final live status capture and root verify remain for C009 closeout; no services owned while C006 holds the source window.

Final63def04 live status capture has now started in private root D0X2Sp (session21754) after C006 released the shared source. No C010 app edits are allowed before this evidence closes. The read-only next-cycle draft is [combined authority adoption](DRAFT-legacy-authority-adoption.md), coordinator-approved provisional C010 with explicit --adopt-legacy and pre-boot recovery gate.

Final live capture63def04 completed in D0X2Sp; owned runtime stopped and CLI unchanged, source slot released. Manifest records actual server0.2.26.3877 and real Codex after Claude weekly limit. Inspected all five stills and37 GIF frames (slash filtering, quote typing, table Tab/selection/sample replacement, quick-open transitions). This is a live regression tour, not adoption UI/integrity proof; table sample typing intentionally replaces selected cell text. No new layout regression found. Immutable manifest: [C009-63def04](../images/status/history/C009-63def04.json). Root verification is the final pending check.

Repository truth review: root/app READMEs, active PLAN/plan.json, acceptance, NEXT-AGENT, storage/runtime guides and VALIDATION reviewed. Updated only bounded backend claims; stage P1 remains pending and central queue stays coordinator-owned. No actual user workspace adoption, activation UI, cross-machine transfer, merge or deployment. C010 draft is design evidence only. Earlier C009 captures and named approvals are retained; no baseline was removed to pass freshness.

Final root `npm run verify` passed on63def04 with fresh live/deterministic evidence. Tracked `git diff --check` passed; generated new visual READMEs retain their harmless trailing blank line as immutable evidence. Final source commits926b22f/656378c/63def04 → actual capture/review → evidence commit sequence complete. Next exact action: coordinate C010 prepare/inspect/recover helper with C006 boot hook, starting from the approved draft. All owned services stopped and no untested app edits remain.
