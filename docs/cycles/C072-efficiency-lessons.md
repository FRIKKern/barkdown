# C072 — Apply the efficiency lessons

**Outcome / status:** documentation maintenance completed after the C071 efficiency review. Canonical workflow now requires toolchain/platform preflight, adjacent-contract checks, integration triage and checking whether a prior lesson prevented repeat work. Visual rules require a completed smoke journey before broad capture. Agent entry points route to those owners; no extra recurring checklist or metrics system.

**Delivery budget:** codex/paper-library, starting at 0606c7d. Aim for a 20-minute documentation checkpoint, excluding unexpected failures; this is an estimate, not measured savings. Stop when active instructions agree, root validation passes and the checkpoint is pushed. No app, upstream, dependency, capture or acceptance-threshold changes.

**Affected boundaries:** agent routing, cycle sequencing, visual preparation and current capability claims. Existing screenshots remain applicable because their source inputs do not change.

**During work:** inspect canonical instructions and stale claims; map C071 failures to the earliest useful check. Read result summaries and failing log sections, not whole histories.

**Ready checkpoint:** one root verification after edits settle, existing visual freshness checks, generated-output review, one commit/push. Relevant new edits or failed checks require reassessment; documentation changes do not prove new app behavior.

**Lessons to apply:** C071 had three failed upstream setup runs totaling 92.97 seconds of command time, three native capture rounds, an omitted CLI help entry found late by hosted CI, and an unsuitable broad Windows Go run. Full desktop validation took 629.334 seconds while other work continued; root validation took 46.055 seconds. Token usage, debugging time and agent-idle time are unavailable. These observations support earlier toolchain checks, adjacent-contract tests and a completed UI smoke journey; they do not establish a savings percentage.

**Validation / truth:** root verification passed in 47.198 seconds ([result](evidence/C072/validation/result.json)). Existing visual hashes and approval remain applicable: no application, dependency or capture input changed. Corrected stale human/agent/deletion and profile claims in the root README, migration guide and runtime setup. Reviewed plan, architecture and acceptance; P2/A2 remains open. [C071 hosted checks](evidence/C072/prior-hosted-checks.json) all pass; [upstream snapshot](evidence/C072/upstream-state.json) still has integration failures. These snapshots do not predict this checkpoint's CI.

**Learning / cost:** three patch attempts were rejected before writing because their contexts were invalid; a whitespace-only PowerShell command failed and was replaced with an explicit file write. Inspect exact lines and use smaller patches for unrelated files. No tests or captures were repeated to clear those editing errors. One full root check, no app suite/capture or provider calls. Token and total active-work time remain unavailable; improved efficiency is an instruction to evaluate, not a demonstrated result.

**Repository / services:** reused the current lane; two local branches and 43 locked historical worktrees remain. The delivery owner must review their recovery/retirement status at the next integration checkpoint; no unique work was deleted. No services started. C071 remains archived with its original evidence. No merge or deployment.

**Next:** inspect live upstream integration failures at the exact proposed heads and record an owner/next action for each blocking category before expanding dependent features. Keep the retained-evidence viewer as the next product slice once that review identifies a safe boundary. In that cycle, check whether preflight and early consumer tests prevent the C071 setup/help failures; do not start another process-only cycle without a new measured problem.
