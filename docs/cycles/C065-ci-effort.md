# C065 — CI effort and useful parallel work

**Outcome:** read-only CI timing audit and guidance from714a575. The new `scripts/ci-effort.mjs` collects a bounded sample via GitHub CLI, saves immutable metadata and supports offline replay. Its calculation tests run inside the existing cycle check. No new dependency, scheduler, CI skip or evidence-reuse framework.

**Measured findings:** [assessment](evidence/C065/assessment.json), [raw15-run snapshot](evidence/C065/ci-snapshot.json), [summary](evidence/C065/ci-summary.json).

| Observation | Evidence / implication |
|---|---|
| C064 deduplication works | Head714a575 has one successful PR Verify36033770189 (133 job seconds), without its old duplicate push job. |
| Three cancelled parity jobs used20m29s | Source app/parity/dependency paths are unchanged from f3514cc through714a575. Our small successive process/documentation pushes interrupted useful full-run completion. This is consumed runner time, not measured agent idleness or wholly valueless partial testing. |
| Three prior push/PR Verify pairs | The push members used353 job seconds combined; event duplication was removed in C064. Push and PR merge contexts are not automatically identical proof. |
| Typical pre-job delay was small | Median4s, maximum40s in this sample; job setup/execution and cancellation churn are larger observed costs than scheduling delay. |
| Latest visual artifact is436,624,363 bytes | [Artifact metadata](evidence/C065/visual-artifact-size.json); current workflow uploads all retained `docs/visual/runs/`. Candidate plus baseline/provenance packaging is the next concrete optimization to evaluate, with complete link/hash validation and history preserved. No upload narrowing implemented here. |

**Useful work during CI:** from measurement start17:25:39UTC, parity36033770223 was running. Used that interval to collect metadata, implement/test the audit, review artifact packaging and improve guidance, then run local verification. Avoid a process-only push until that run completes. CI is not a reason to create busywork; if no authorized independent work remains, leave a pending handoff rather than poll indefinitely.

**Tests/limits:** root verification passed in43.81s ([timing](evidence/C065/root-timing.json), [log](evidence/C065/root.log)). [Focused tests](evidence/C065/timing-tests.txt) cover overlapping, failed, cancelled, unfinished, missing and negative timestamps; duplicate-event candidates; offline replay; overwrite refusal; bounded live input. Real-snapshot offline replay matches exactly. One added CLI fixture initially compared undefined object fields against JSON omission; corrected the fixture comparison and reran focused checks. Full job time is not CPU/billing time or delivery critical path. Latest-attempt bounded metadata is not a complete cost ledger. Agent idle/token use is unmeasured; no money estimate.

**Tripwire/truth review:** CI metadata/analysis, agent guidance and generated roadmap only; no app, capture input, approval or upstream changes. Existing visual freshness checks pass. Final roadmap is reviewed separately. Root guide points to the same cycle protocol; P2/A2 remains open. Known43 locked worktrees preserved, no owned runtime launched. One existing delivery lane.

**Final check:** parity36033770223 completed successfully on714a575 with20/20 rows ([results](evidence/C065/parity-results.md), [run](evidence/C065/parity-completed.json)). The timing snapshot intentionally retains its earlier in-progress observation; it was not overwritten. Audit work overlapped that run and no audit push cancelled it. Final generation/cycle checks and one push close this cycle.

**Next:** Do not narrow tests for cost alone. Product work remains the owned ordinary draft-note/native journey; when optimizing CI further, package only a self-contained current visual review and prove omitted history is already durably retained.

Local packaging scope:97 retained run directories,7,247 files and496,064,337 bytes; the approved example run has91 files/6,315,606 bytes ([sizing](evidence/C065/local-artifact-scope.json)). These are local uncompressed sizes, not promised artifact savings. Measurement window began17:25:39UTC and reached final CI confirmation17:37:04UTC; it includes local work and waiting and does not isolate agent idle time.
