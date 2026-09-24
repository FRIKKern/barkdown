# Hosted integration review

Reviewed upstream head ae6065545; these results do not establish main readiness.

- Go tests caught a C071 omission: `deleteExactDraft` was missing from CLI mutation help. Follow-up f2528db12 adds its exact draft ID and opaque revision shape. All 11 focused checks pass in `upstream-go-help-focused.log`; Go build/vet also pass. The broad Windows run in `upstream-go-help.log` fails, including missing `/bin/sh`, POSIX permissions, Windows path handling, context determinism and task deadline diagnostics. It is not a full Go pass. Fresh hosted results are required after the fix.
- Elixir test and production compile stop at warnings-as-errors for separated function clauses in PortableDoc parser, printer, compose and walk. Those files are unchanged by ae6065545 relative to its parent. This is a stacked-branch integration failure, not proof that main has the same failure.
- Path-escape gate reports stale vendored SDK tarballs. Documentation job reports Paper-editor style mirror and design-token drift. Local document budgets and corrected anchor checks pass; that does not override hosted comparisons against a different base.
- Workflow ledger gate reports an unledgered population increase from 22 to 23. Security shape self-test reports a mismatched baseline census and an undetected baseline-growth mutant. Their inputs were not changed by C071; they remain integration work for the existing upstream lane.

Raw `hosted-*.log` files and `upstream-hosted-checks.json` retain the diagnoses. No checks were waived, no automatic reruns requested, and no merge or deployment performed.
