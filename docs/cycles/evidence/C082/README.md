# C082 admission coordinator evidence

Upstream source `d5b909fe16fe82b2d40ef23b9f04b5e5d9e0d2c6`, [PR20420](https://github.com/FRIKKern/barkpark/pull/20420). This is an unwired primitive; it does not establish runtime-wide exclusion or enable migration.

- [Elixir1.18.4 final run](focused-12.log):25 tests,0 failures; local OTP28. [Elixir1.19.5](focused-11.log) also passes. Both load the real source and ExUnit file without the full Mix application.
- Mutation control: [restart bypass](mutant-restart.log) causes6 failures and [premature hold](mutant-drain.log) causes4 in the preceding23-test suite. The [unmodified control](focused-09.log) passes; [exact mutations](mutations.json) describe the temporary copies. These deliberate failures prove that the relevant checks discriminate.
- [Development failures](development-failures.md) distinguish repaired harness/implementation failures from final checks.
- [Root verification](checks-01/result.json) passes in50,617ms. [Adjacent writer review](integration-review.json) records deferred effects that the next integration must cover.
- No UI inputs changed. C080 imagery remains applicable; no new capture or UI behavior claim.

[Upstream integration](upstream-checks.json) passes:30 doctests,23,168 tests,0 failures,40 excluded,2 skipped, plus14 boot tests. The [named module excerpt](linux-admission.log) contains all25 admission completions; the [summary](linux-summary.log) records the full-suite selector and totals. The test step ran07:04:44–07:30:55 UTC. Merge awaits authorization because the active upstream workflow deploys production automatically.

The host must guarantee exclusive instance/journal ownership across OS processes. Tests cover process and whole-VM restart, not power loss or real content/media adapter coverage.

The task's test criterion was clarified before CI completed: it accepts the named strict local recipe or the hosted Elixir gate with this exact file in the executed selection and zero failures. The hosted gate satisfies it; the merge criterion remains unmet. The strict wrapper was not run locally, and standalone passes alone do not satisfy this criterion.
