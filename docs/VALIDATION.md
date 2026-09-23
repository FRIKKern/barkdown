# Evidence and remaining proof

## Accepted prototype checkpoint

P1/C039 is accepted for the Windows source prototype at source `27ea120`, with evidence through `f65c0c6`. The [completion audit](cycles/C039-completion-audit.md) maps acceptance requirements to full desktop and root passes, authentication/recovery proof, reviewed captures and 102 verified retained native artifact hashes. [Validation hashes](visual/provider-login/27ea120/validation.json) bind the recorded logs.

[PR #31](https://github.com/FRIKKern/barkdown/pull/31) carries this acceptance checkpoint and the repository cleanup; its state records main integration. Earlier integration/editor work landed through PR #30; [C040](cycles/C040-linux-parity.md) records the passing Linux and Windows gates.

## Open work

[C046](cycles/C046-migrated-paper.md) proves nine permitted migrated cases at `fe8696c` through native typing, exact saved Undo, server readback, reload and Electron restart. The original ten-case acceptance remains blocked: inline newlines become rejected PM hardBreak nodes, so preflight refuses them and retains source/backup. The native code-language carrier and long-title clipping were fixed. Seven preflight plus 22 staging tests and Paper-host checks pass; [reviewed migration media](visual/migration/README.md) retain both failure and success. Final desktop/root and refreshed general capture results are recorded in the cycle handoff before publication.

[C045](cycles/C045-migration-staging.md) completes offline durable staging at `cf0612c`: the full desktop suite, 22 staging tests, ten-case real Paper API interruption/reconciliation, root verification and fresh reviewed live/deterministic captures pass. [Evidence](cycles/evidence/C045/results.json). Source/navigation remain legacy; this does not yet prove migrated content through editor save/Undo/reopen or permit real-library cutover.

[C044](cycles/C044-paper-create-contract.md) completes the narrow creation-contract proof at Barkdown `b1cd732` / upstream `15bfe254a`: 63 upstream controller tests, real collision/concurrency/lost-response checks and root verification pass. Five live Paper stills/37 GIF frames and 40 deterministic frames/eight GIF sequences were inspected and approved. [Evidence](cycles/evidence/C044/results.json). Upstream [draft PR #20020](https://github.com/FRIKKern/barkpark/pull/20020) is stacked and unmerged; no migration adapter, real-library write or authority switch is claimed.

[C043](cycles/C043-migration-preflight.md) completes offline P2 preparation at source `f109601`: six filesystem integration tests, full desktop suite and root verification pass; one POSIX-only authentication test skips on Windows. Exact backups, four real process-exit boundaries, source/corruption refusals and stable IDs are covered. Fresh 40-frame deterministic capture has zero differences; five live Paper stills and 37 GIF frames were inspected after a real Claude edit on private Barkpark `bf23f773`. Logs and hashes are retained in [C043 evidence](cycles/evidence/C043/results.json). This branch is not merged and the module is not UI-wired. It does not prove migration target writes, cutover, power-loss durability or portability.

P2 migration, P3 portability/recovery, P4 sync and P5 ordinary installation remain unfinished. [Migration preparation](migration/README.md) is preparation, not a completed migration rehearsal. Upstream editor integration and cross-repository enforcement are separate release gates in [PLAN.md](PLAN.md).

[Current cycle](cycle.json) and [handoff](NEXT-AGENT.md) own the active queue. [The historical validation ledger](archive/2026-09-23-validation.md) preserves earlier results and failures for targeted evidence lookup. Do not treat old pending statements as current tasks.
