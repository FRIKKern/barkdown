# C010 — Explicit legacy workspace authority bridge

Status: active, storage-helper lane. Starting from C009 evidence fc177b0 on codex/cycle-next-12h. Completed C009 record remains archived beside its handoff. The approved [transaction draft](DRAFT-legacy-authority-adoption.md) is the design basis; C006 lane owns main/boot/recovery UI.

## Bounded goal and acceptance

Prepare an entire legacy shell plus stopped managed runtime in a private candidate registry; remap owned references, verify original/backup bytes and publish only by atomic rename into absent profile-data. Explicit --adopt-legacy invocation, no automatic adoption. Idempotent retry and actual process-exit recovery must not seed an empty replacement or duplicate profile. Offline rollback retires edited adopted data without changing the source. Disposable fixtures only, no user's library, merge or deployment.

Acceptance: mixed shell/runtime fixture preserves document/chat/side-parent/tab/draft/Page/favorite/receipt identities and attachment bytes; all owned absolute references target final UUID paths; source pointers intentionally remain originals. Interrupted prepare/activate/rollback either resumes exactly one operation or shows an explicit blocker. Active inspect validates matching final marker/root and expected UUID, missing/foreign final state refuses. Real C006 boot reads/edits/restarts adopted notes/media and rollback returns unchanged source only after owned services stop. Relevant unit/desktop/root tests plus source-commit/capture/actual image review/evidence-commit required.

## Agreed boot contract

Proposed createLegacyAdoption({userData,ownership,readSecrets,checkCold?,checkpoint?}) exposes prepare({legacyDir?,name?}), inspect(), recover({action:'activate'|'rollback'|'resume',...}). ReadSecrets uses bound store. inspect returns status none/staged/activating/active/rolled-back/blocked with verified finalRoot/profileId or explicit error. C006 agreed inspect runs before any profile-data construction or Personal creation. None preserves ordinary opt-in behavior; active uses verified final root; staged/activating/blocked renders recovery without writers/seed; rolled-back returns legacy only after verified receipt. Active registry may legitimately advance generation/selection, so verify marker identity and presence of adopted UUID, not frozen generation forever.

Proposed acquireAuthorityLease(userData) is a module-branded, canonical-root-bound lease shared by main and helper; every new legacy/profile writer must hold it until provider/runtime cleanup at quit. Mutation helper requires it, avoiding a second lock acquisition against the same process. C006 owns Electron single-instance UI behavior. Old binaries remain a closed-app prerequisite because they do not honor this lock.

## Ownership and next action

This lane edits helper/tests/docs only; no main/preload/renderer changes. Central cycle queue remains coordinator-owned. Read-only audit found C003 requires a new registry and auto-selects within it, while C006 currently creates Personal before any adoption gate. Candidate staging isolates that selection until publication. Next: freeze authority lease API with C006, implement storage transaction and fixture corpus, then coordinate real boot proof. No C010 services or code changes exist yet.

## Implementation checkpoint

Additive legacy-authority-adoption helper now implements branded workspace ownership, private shell snapshot/candidate, C003+C009 staging, known-owned attachment remap (including nested receipts and Markdown), checksummed readiness marker, activation source/candidate revalidation, atomic absent-target publication, active identity inspection and retained rollback. API actions are explicit: staged resume/activate; interrupted activation activate; interrupted rollback rollback; blocked has no mutation actions. An unfinished legacy run is currently a deliberate blocker, not invented completion.

Windows fixture found open file handles prevent whole-directory rollback rename. file-lease now supports prepareRelocation (close fd while retaining live pid/token marker) and relocated (verify token at moved path); rollback retains ownership through rename before release. Full fixture remap/rollback and refusal groups pass. Sixteen actual process-exit cases across inner shell/runtime publication, outer reference/publication and rollback are running. Root replacement guard checks canonical identity/dev/inode; C006 main is implementing ownership+boot hook separately. Root owns a pending source bootstrap code-reloader fix; this lane has not edited bootstrap.

No real C010 runtime or user data touched. Next: finish process-exit/unit gates and publish source for C006 import, then coordinated real adopted-profile proof and visual/root closeout.

All sixteen composite subprocess exits passed (fixture96ufLr). File-lease regression and C009 adoption suite also passed after relocation support. Source implementation ready for C006 import; real boot integration and closeout remain pending. No background fixture processes remain.
