# Current handoff

C039/P1 is accepted for the Windows source prototype at source `27ea120`, with evidence through `f65c0c6` on `codex/finish-profile-isolation`. Main remains `9c623d5`; the checkpoint is not merged. See the [acceptance audit](cycles/C039-completion-audit.md). No deployment or real-library migration occurred.

## Current work

Repository cleanup is on `codex/repository-hygiene`, based on the accepted checkpoint. See [the cleanup handoff](cycles/C042-retirement-closeout.md) for verified retirements and remaining debt. Do not reopen completed authentication or Paper polish tasks.

P2 is the next product stage. [Migration preparation](migration/README.md) defines the synthetic inventory, preflight and durable-manifest slice. Resolve safe target creation before any Paper writes. Preserve the legacy store, source data and backups until comparison, interruption/resume and rollback are proven.

## Evidence and limits

Full Windows desktop and root verification passed for the accepted checkpoint. Native isolation/adoption evidence retains 102 verified hashes. Reviewed login, real Paper and deterministic captures are linked from the acceptance audit. This proves the stated prototype boundary; migration, portability, sync and ordinary installation remain unfinished.

Barkpark's consumed editor source is `bf23f773`. Upstream integration and cross-repository enforcement remain separate release gates; recheck their actual state before landing or releasing. Never modify the shared Barkpark checkout or stop shared services incidentally.

## Resume

Read [PLAN.md](PLAN.md), [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) and the relevant [acceptance stage](ACCEPTANCE.md); run `npm run plan` and `npm run cycle`. Follow [cycle closeout](CYCLES.md) and [visual rules](visual/RULES.md). Keep this handoff current by replacement, not accumulated historical checkpoints.

Earlier investigations remain in [the archived handoff](archive/2026-09-23-next-agent.md) and source-bound cycle evidence. Consult them only for a specific evidence question; they are not another task queue.
