# C010 — Explicit legacy workspace authority bridge

Status: active, storage-helper lane. Starting from C009 evidence fc177b0 on codex/cycle-next-12h. Completed C009 record remains archived beside its handoff. The approved [transaction draft](DRAFT-legacy-authority-adoption.md) is the design basis; C006 lane owns main/boot/recovery UI.

## Bounded goal and acceptance

Prepare an entire legacy shell plus stopped managed runtime in a private candidate registry; remap owned references, verify original/backup bytes and publish only by atomic rename into absent profile-data. Explicit --adopt-legacy invocation, no automatic adoption. Idempotent retry and actual process-exit recovery must not seed an empty replacement or duplicate profile. Offline rollback retires edited adopted data without changing the source. Disposable fixtures only, no user's library, merge or deployment.

Acceptance: mixed shell/runtime fixture preserves document/chat/side-parent/tab/draft/Page/favorite/receipt identities and attachment bytes; all owned absolute references target final UUID paths; source pointers intentionally remain originals. Interrupted prepare/activate/rollback either resumes exactly one operation or shows an explicit blocker. Active inspect validates matching final marker/root and expected UUID, missing/foreign final state refuses. Real C006 boot reads/edits/restarts adopted notes/media and rollback returns unchanged source only after owned services stop. Relevant unit/desktop/root tests plus source-commit/capture/actual image review/evidence-commit required.

## Agreed boot contract

Proposed createLegacyAdoption({userData,ownership,readSecrets,checkCold?,checkpoint?}) exposes prepare({legacyDir?,name?}), inspect(), recover({action:'activate'|'rollback'|'resume',...}). ReadSecrets uses bound store. inspect returns status none/staged/activating/active/rolled-back/blocked with verified finalRoot/profileId or explicit error. C006 agreed inspect runs before any profile-data construction or Personal creation. None preserves ordinary opt-in behavior; active uses verified final root; staged/activating/blocked renders recovery without writers/seed; rolled-back returns legacy only after verified receipt. Active registry may legitimately advance generation/selection, so verify marker identity and presence of adopted UUID, not frozen generation forever.

Proposed acquireAuthorityLease(userData) is a module-branded, canonical-root-bound lease shared by main and helper; every new legacy/profile writer must hold it until provider/runtime cleanup at quit. Mutation helper requires it, avoiding a second lock acquisition against the same process. C006 owns Electron single-instance UI behavior. Old binaries remain a closed-app prerequisite because they do not honor this lock.

## Ownership and next action

This lane edits helper/tests/docs only; no main/preload/renderer changes. Central cycle queue remains coordinator-owned. Read-only audit found C003 requires a new registry and auto-selects within it, while C006 currently creates Personal before any adoption gate. Candidate staging isolates that selection until publication. The authority lease API is agreed and implemented. Next: coordinated real boot proof and validation closeout. No C010 runtime is running in this lane.

## Implementation checkpoint

Additive legacy-authority-adoption helper now implements branded workspace ownership, private shell snapshot/candidate, C003+C009 staging, known-owned attachment remap (including nested receipts and Markdown), checksummed readiness marker, activation source/candidate revalidation, atomic absent-target publication, active identity inspection and retained rollback. API actions are explicit: staged resume/activate; interrupted activation activate; interrupted rollback rollback; blocked has no mutation actions. An unfinished legacy run is currently a deliberate blocker, not invented completion.

Windows fixture found open file handles prevent whole-directory rollback rename. file-lease now supports prepareRelocation (close fd while retaining live pid/token marker) and relocated (verify token at moved path); rollback retains ownership through rename before release. Full fixture remap/rollback and refusal groups pass. Sixteen actual process-exit cases across inner shell/runtime publication, outer reference/publication and rollback are running. Root replacement guard checks canonical identity/dev/inode; C006 main is implementing ownership+boot hook separately. Root owns a pending source bootstrap code-reloader fix; this lane has not edited bootstrap.

No real C010 runtime or user data touched. Next: finish process-exit/unit gates and publish source for C006 import, then coordinated real adopted-profile proof and visual/root closeout.

All sixteen composite subprocess exits passed (fixture96ufLr). File-lease regression and C009 adoption suite also passed after relocation support. Source implementation ready for C006 import; real boot integration and closeout remain pending. No background fixture processes remain.

## Ownership and recovery hardening

After coordinator review, missing outer journal with retained staging or published adoption marker blocks startup and new preparation; an unrelated ordinary profile registry still inspects as none. Rollback checks every later-created profile runtime, including owner leases and recorded PostgreSQL PIDs, before retiring the entire authority. Every async boundary and journal/reference publication rechecks the branded authority lease. Losing ownership during shell copy, awaited cold validation or streamed candidate verification prevents further publication.

Targeted helper suite passed at fixture barkdown-authority-2qmbQh, including all sixteen actual subprocess exits. File-lease regressions passed at barkdown-file-lease-Ub64VN; cold-adoption regressions passed at barkdown-cold-adoption-lmf30N. git diff --check passed. C006 lane will own the single actual Electron + real runtime adoption/restart/edit/rollback proof using this helper commit; this lane owns helper regression and visual evidence. No actual user data migrated and no C010 runtime is running in this lane.


## Source checkpoint e16eaa7 validation

Full npm run test:desktop passed: profile registry24, runtime pool13, cold adoption and composite authority interruption corpus, all backend suites,76 desktop assertions, direct editing/Undo/human takeover, composer history and full side-chat persistence. Deterministic capture2026-09-22T00-00-09-406Z was compared, all21 stills and21 decoded frames in five GIFs actually inspected, and explicitly approved. Zero pixel/geometry differences; pre-existing GIF palette/shadow banding remains. This is existing fixture shell coverage, not real adoption UI evidence.

Root npm run verify failed at the expected live status freshness gate: source e16eaa725 versus captured63def040d. No gate bypass or stale evidence promotion. Parent directed one coordinated real Electron adoption proof in the main/boot lane before redundant source status capture; that lane holds the shared a544 source window. C010 stays active. Root bootstrap correction5a3a502 is known but not imported into this source checkpoint. Next: link actual main-lane runtime evidence, complete appropriate live freshness and root verification on combined source; independently audit remaining A1 ownership/recovery gaps meanwhile.
Root concept npm test and standalone npm run check:visual both passed after the freshness failure; this does not change the failed aggregate verify result. All reviewed fixture evidence is committed as a checkpoint while C010 remains active.
