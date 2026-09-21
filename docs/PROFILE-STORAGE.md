# Profile storage foundation

`app/main/profile-registry.js` is an opt-in foundation with real filesystem recovery fixtures. It is **not called by desktop startup**. The current UI and existing workspace authority are unchanged. See the [ownership contract](PROFILE-OWNERSHIP.md), [C003 handoff](cycles/C003-profile-registry.md) and [A1 acceptance](ACCEPTANCE.md#a1--profile-ownership-and-isolation).

## Boundaries

Create a registry in a directory disjoint from the legacy store. UUID v4 IDs own `profiles/<id>`; selection only changes the registry pointer, never the identity of an existing bound store. `storeFor(id)` exposes `profileId`, `storeDir`, `readJson` and `writeJson`. Unknown owners, missing directories, invalid JSON and path escapes fail explicitly. No selected-profile fallback exists.

`createProfile({name, requestId})` creates an empty profile. Retain a UUID `requestId` across retries after an uncertain result; the same ID returns the same published profile. Omitting it intentionally creates a new operation. `selectProfile(id)` persists selection. These APIs do not start servers, grant provider credentials or expose a switching UI.

## Staging adoption and recovery

`adoptLegacy({legacyDir, name})` snapshots the audited shell files only: workspace, settings, local document JSON/Markdown, attachments, proposals, edit receipts and connection/credential metadata. It requires quiescent legacy writers, rejects unsupported workspace versions/malformed documents and refuses unclassified entries or any local database directory. Compatible unknown fields/blocks survive. App-wide appearance keys are extracted into registry `appSettings`; the profile retains provider/connection settings and unknown keys.

The immutable backup retains original bytes and a SHA-256/size manifest. The journal records one destination UUID and backup identity. Repeated calls resume named checkpoints and return the same owner. Changed source bytes stop publication. Absolute attachment references still point at retained source files: a later cutover must remap and verify them. This is staging, not complete default-workspace adoption or cross-machine portability.

Committed registry generations are immutable and checksummed. The pointer is replaced atomically, with the previous pointer retained. `load()` never silently replaces corrupt state. `recoverPrevious()` explicitly restores the previous committed pointer and retains corrupt pointer bytes for diagnosis; later profile directories remain available for reconciliation. `rollbackAdoption()` unpublishes the adopted profile but preserves the original, backup and edited staged data. Calling it again after interruption completes the journal without restoring the removed profile.

Exclusive registry writes use a PID lease. Live owners block another writer; dead-owner evidence is renamed and retained. Unreadable ownership is not guessed away. Writes fsync file bytes before rename; directory-fsync limitations on Windows mean tests establish process-crash recovery, not every power-loss/storage-device guarantee. An old application does not honor this lease, so legacy quiescence is a prerequisite, not something inferred from a successful hash comparison.

## Proof and next integration

Run `node app/tests/profile-registry.test.mjs` (also part of the desktop suite). It covers byte preservation, same-slug stores, drafts/side-chat references, appearance split, source/schema corruption, registry corruption, missing roots, case aliases/junctions, concurrent ownership, seven real adoption process exits, rollback interruption and three profile-creation publication exits. Synthetic media/credential/cache files demonstrate bound path isolation, not real server/browser/provider isolation.

The additive [C007 runtime pool](cycles/C007-profile-runtimes.md) now binds descriptors, credentials and foreground/run leases to these stores. Two real disposable runtimes passed concurrent same-slug/media isolation, active-run retention across selection, independent restart and selected-profile restoration. Desktop authority integration remains a separate C006 slice. Existing managed database adoption, external browser sessions, cache ownership, attachment remapping and OS-encrypted credential transfer remain pending. The [current UI galleries](visual/README.md) are regression evidence only; they do not depict a profile switcher.

`createProfileRuntimePool({registry,readSecrets})` requires a trusted credential callback receiving the bound store. `acquire(id,{source,ownerId,writes})` captures an immutable direct connection and awaited idempotent release. `select` starts the destination before committing selection; cleanup failure after commit returns the selected profile with `cleanupWarning`. `selectWithoutRuntime` supports local-only/remote profiles while retaining previous background run leases. Writes default off. Changing foreground permission never mutates an existing run lease. Shutdown refuses active run leases; provider finalization must release them first.

Runtime descriptors persist distinct ports and source paths; data roots derive from profile identity. The source driver uses a verified private build snapshot to avoid shared Mix locking. Lease recovery preserves stale evidence, serializes recovery and verifies ownership; interrupted recovery gates fail closed. This proves process-level behavior, not packaging, crash-proof power-loss recovery or full profile adoption.
