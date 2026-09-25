# Writer admission and migration preparation

C075 adds a durable generation and cross-process writer admission. Captured foreground, provider, MCP and goal contexts cannot silently refresh their ownership after quiescence. Interrupted or failed mutations retain uncertain admissions; a dead process alone cannot clear them.

Native Paper refusal, retained-buffer and original-history restart evidence is being validated in [C075](../../cycles/C075-writer-fence.md). No accepted capture exists for this new boundary yet. Quiescence is driven by the disposable test controller, not a shipped migration button.

This does not preserve a dirty buffer across abrupt restart, fence arbitrary external Barkpark clients, select a migration authority, reconcile uncertain admissions, or retire the legacy editor. A2 must demonstrate those required cutover/recovery boundaries before activation.
