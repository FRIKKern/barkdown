# Goal conversations — implementation and evidence

The goal coordinator is implemented for the Windows profile prototype. It saves parent/worker conversations, captures each worker's folder/provider/model choices at Start or Resume, enforces bounded admission and dependencies, and retains exact attempts for review and reconciliation. It does not create automatic Git worktrees or establish a background OS service.

| Evidence | What it establishes |
|---|---|
| [C015 authenticated proof](evidence/61eea4d/README.md) | Recorded Codex planning, three workers, evidence reviews and summary, plus native planning-crash recovery at the named source. |
| [C020 interruption proof](evidence/17c2cc8/README.md) | Stop races and native interrupted worker/review/summary recovery at the named source. |
| [C023 storage checkpoint](../cycles/C023-windows-atomic-write.md) | Bounded Windows atomic-write and ownership checks, with source-specific limitations. |
| [P1 completion audit](../cycles/C039-completion-audit.md) | Later combined profile/provider/goal ownership and validation acceptance; supersedes the old pending integration queue. |
| [Goal visual health](../visual/goals/README.md) | Reviewed screenshots/GIFs, with deterministic and authenticated evidence kept distinct. |

The [repository handoff](../NEXT-AGENT.md), [current cycle](../cycle.json) and [migration contract](../migration/README.md) own current work. P2 is active. The next note-engine transition must also fence captured goal/provider/MCP writers; a foreground profile switch or cancellation request alone does not prove child termination.

Workers may share a folder; assignments must be disjoint or dependency-ordered. Model review is not human verification. Uncertain effects require explicit reconciliation. No broad goal completion, arbitrary external-effect rollback, power-loss durability, cross-machine portability or execution while asleep is claimed.

The [archived integration handoff](archive/2026-09-24-HANDOFF.md) preserves earlier branches, investigations and pending statements for evidence lookup. It is not another active task queue.
