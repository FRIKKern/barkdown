# Current handoff

**Current cycle:** [C073 upstream integration](cycles/C073-upstream-integration.md), active. Barkdown PR33 merged at a772217 after all checks passed. P2/A2 remain open.

**Delivery:** reuse codex/paper-library, [evidence PR35](https://github.com/FRIKKern/barkdown/pull/35). Upstream codex/paper-create-only has current-main integration 446f29ced and follow-ups through 677992c51; [PR20020](https://github.com/FRIKKern/barkpark/pull/20020) targets main. No upstream merge or deployment.

**Next action:** review required checks on 677992c51 and resolve remaining owned failures. Keep the existing task claimed; do not grow dependent work while integration is unresolved.

**Proof:** [C073 evidence](cycles/evidence/C073/README.md) records 234 server tests, 20/20 real editor rows, exact deletion/recovery, fresh production compile and reviewed live/hover media. The initial Linux suite found nine contract failures; 111 targeted follow-up tests and the repaired census pass. Later checks exposed formatting, a seven-byte documentation overflow and the CLI conflict exit mapping; these are corrected with focused proof. Fresh required CI is running. Read the cycle for exact IDs and attribution.

**Limits:** app/BARKPARK_REF and fallback bundle remain bf23f773; fresh proof is for the connected private runtime. Upstream main auto-deploys affected hosts, so merge/deployment scope must be resolved after validation. Migration activation and the retained-evidence viewer remain open. Older branch refs and historical worktrees are preserved; owned runtimes are stopped.

**Working rules:** canonical workflow is [CYCLES](CYCLES.md#preflight-and-integration-first), visual authority is [visual rules](visual/RULES.md). Check the real toolchain, line endings, PR base and published task before expensive runs. Review evidence summaries first; stopped or skipped checks are never passes.
