# Missing working-folder search audit

The retained [original command](original-command.cjs) and [report](original-report.json) describe the bde5e23 API adapter before the correction. The absolute checkout path was the audited source then; reproducing the old result requires that original source, not today's modified checkout. No real credentials or provider requests were used. Claude/Codex denial and owned-worker transport were injected checks, not native permission or authenticated SDK evidence.

The real API loop returned successful `[]` when its selected B folder was missing; A-only text was not exposed and no fallback folder was created. The correction propagates root enumeration failure. Descendant traversal remains best effort; this does not establish complete indexing, filesystem confinement against junctions, or provider preflight policy.

`node app/tests/agent.test.mjs` adds tool-result checks for a real missing root, a regular-file root, a valid empty root, and controlled root EACCES. Initially the existing helper swallowed assertions thrown inside a scripted model response because the production adapter converted them into ordinary error events. The helper now rethrows recorded fixture assertion failures after the run. With that correction and before the product fix, the test exited 1:

```
Error: search root ENOENT reported incorrectly: {"type":"tool_result","tool_use_id":"search-root","content":"[]"}
```

After the root enumeration fix the complete agent suite exits 0, including all four new cases. These are production API-loop checks using deterministic transport. Full combined desktop, visual, live and root gates remain pending; no native missing-folder UX or general P1 completion is claimed.
