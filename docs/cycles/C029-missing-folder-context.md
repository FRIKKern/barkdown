# C029 — missing working-folder context

Base f3e67ac, codex/missing-folder-context-12h. C008 parent remains active.

Audit: profile-service resolves persisted chat.folder verbatim; agent.start adds current context every turn; Claude cwd and Codex workingDirectory use that path without filesystem fallback. Folder/provider changes clear native sessions in workspace-repository. API search root errors were corrected in e3fec49. Existing tests do not combine missing persisted B with provider SDK routing and restart.

Plan: use real stores/resolver/provider modules and controlled SDK seams to prove routing only; preserve unavailable selected folder and tool errors. Prepare actual Electron restart/reference/send fixture for later serialized grant, consuming C026 for failed-send preservation. No authentication policy change. No native provider execution or model claim from seams.

Dependencies: root npm ci passed; app npm ci passed with two inherited high audit findings (no force upgrades). No processes owned.

## Offline checkpoint

Ten routing tests pass through real profile registry/repository, resolver and provider modules, with explicitly controlled SDK seams. Missing/non-directory/null folders are preserved for API/Claude/Codex, including supplied resumed session options; fresh service handles restore selected B and draft. A folder change clears prior native sessions. No production change was needed. This is not native CLI execution proof or an actual process-restart proof.

Existing agent suite passes including real missing/non-directory/empty filesystem roots and controlled EACCES search denial. A real inaccessible Windows ACL has not been exercised. Root/app npm ci and Chromium install passed; fixture syntax passed. Root verify failed inherited global screenshot freshness (UI16a3b6085 vs capturee38038577); raw logs retained.

Prepared `app/tests/missing-folder-ui.live.mjs` is NOT RUN. It creates disposable A/B, process-restarts with missing B selected, opens same.txt to require explicit unavailability instead of A substitution, and optionally sends actual installed CLI turns using C029_NATIVE_PROVIDERS=claude,codex. It records real native errors and retained acknowledged user text; SDKs are not replaced. Authentication/login configuration is not modified. Native failures after accepted dispatch must preserve the user transcript; pre-ack failures must preserve unsent drafts and require C026 integration. The fixture presently tests accepted attempts only; do not claim C026 draft coverage from it.

Next: obtain named UI grant, consume reviewed C026 source as needed, commit source before running fixture; inspect native failure semantics without treating routing seams as execution. Then fresh deterministic/status/root gates as assigned. No owned app/runtime processes. C029 stays active.
