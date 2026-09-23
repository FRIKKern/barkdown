# Current handoff

P1/C039 is accepted and merged through PR #31. P2 remains active; no real-library migration, authority switch or deployment has occurred.

## Current work

Branch `codex/p2-migration`, worktree `C:/Users/Frikk/.codex/worktrees/barkdown-p2-migration`, draft [PR #32](https://github.com/FRIKKern/barkdown/pull/32). C043 prepares exact offline backups; C044 establishes a create-only route; C045 provides durable staging and interrupted-write reconciliation. [C046](cycles/C046-migrated-paper.md) proves nine permitted corpus cases through native typing, exact saved Undo, reload and Electron restart. Source, backup and workspace remain unchanged.

The tenth case is blocked: native inline newline input becomes a PM hardBreak rejected by Paper's serializer boundary. Preflight now explicitly refuses it. Code language uses the correct native `lang` field; long standalone titles wrap fully in narrow panes. [Evidence and failed-run diagnosis](visual/migration/README.md). No whole-P2 completion claim.

## Next action

Finish the current final desktop/root and screenshot evidence checkpoint and push; exact results belong in [C046](cycles/C046-migrated-paper.md). Then register/claim an upstream inline-break task and prove native DOM input, serialization, saved Undo and reopen before lifting the refusal. Media/internal links, reference-map activation and rollback remain separate A2 gates. Keep the legacy editor/store and readable history/receipts.

Consume upstream worktree `barkpark-paper-create` at `844ecd321`, branch `codex/paper-create-only`, stacked draft [PR #20020](https://github.com/FRIKKern/barkpark/pull/20020). This route is unmerged and carries separate upstream CI gates. Do not modify the shared Barkpark checkout or stop shared services. Barkdown has main plus one delivery branch; upstream has main plus three. The user's running app is separate from these disposable test runtimes.

The full Linux matrix at `962a28e` reported 19/20 (tablehead click timeout); its targeted rerun passed. This is an intermittent failure record, not proof that the full matrix passed on the current head.

Read [PLAN](PLAN.md), [decisions](DESIGN-DECISIONS.md), [A2 acceptance](ACCEPTANCE.md), [cycles](CYCLES.md) and [visual rules](visual/RULES.md); run `npm run plan` and `npm run cycle`. Current evidence supersedes historical pending work; older handoffs are not additional queues.
