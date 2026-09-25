# Current handoff

Follow [C077](cycles/C077-comparison-contract.md) and the [comparison contract](migration/comparison.md). P2/A2 remains active. C076 and its roadmap closure merged through PR40/41; main19f9cb8a has passing post-merge Verify and20/20 parity. C076 JSON is archived beside its handoff.

Current lane: codex/migration-comparison in the reusable migration worktree, based on main. This bounded checkpoint audits the next comparison adapter; no app behavior changed. 208 owner regressions and root verify pass; see C077 evidence. At this commit the contract is integrating: check its PR before doing further work. After merge, archive C077 and begin the implementation checkpoint. Do not claim the comparison adapter exists.

Next implementation must compare mapped legacy notes and pre-existing published/draft Papers, verify source/media/navigation, and revalidate preparation/writer/runtime ownership. Capture the existing-Paper baseline before staging; historical staging receipts cannot reconstruct it. See the contract for refusal and native acceptance cases. Keep authority legacy and preserve backups. No deployment or legacy retirement.

Repository: main plus this one lane; preserve43 locked recovery worktrees, two stashes and detached integration recovery. Primary agent reviews provenance at the next cleanup. No owned test services. Built upstream remains b70214090; heartbeat remains paused. G2 upstream enforcement and startup light-shell flash remain separate limitations.
