# C023 queued validation commands

Prepared offline after parent independent review of3e9c0a9 passed44 focused checks and four default lease groups. These commands subsequently passed under the explicit parent UI grant; [exact results and source hashes](C023-validation-plan.json) record the executed gates. Source remains frozen and the UI/runtime slot has been released. Commands are retained for reproducibility.

Run from the Barkdown worktree in PowerShell. Run each next gate only after the preceding gate exits successfully; keep exact command exit codes and full logs. Existing locked dependencies/Chromium are installed; no dependency change is planned.

~~~powershell
git status --short
git rev-parse HEAD
npm run test:desktop *> app/test-results/c023-final-desktop.log
$desktopExit = $LASTEXITCODE
Get-Content app/test-results/c023-final-desktop.log -Tail 25
if ($desktopExit -ne 0) { throw 'C023 full desktop failed; inspect retained log before continuing' }
~~~

Record actual native review/summary roots and preserve their proof.json files, plus normal/recovery coordinator manifests and all17 stills. Inspect the actual images. The suite outputs synthetic fixture data only; never copy credentials or workspace content into the handoff.

~~~powershell
npm run visual:capture *> app/test-results/c023-fixture.log
if ($LASTEXITCODE -ne 0) { throw 'C023 fixture capture failed' }
npm run visual:compare
if ($LASTEXITCODE -ne 0) { throw 'C023 fixture comparison failed' }
~~~

Use pending.json to locate the fresh manifest/report. Inspect every action frame and GIF, including narrow layouts and intermediate states. Back up area README text before explicit approval; the existing generator may drop custom tails. Restore retained historical notes if necessary. Supply the approval command from the JSON plan with an actual review note only after inspection; do not copy an old approval.

~~~powershell
$env:BARKDOWN_TEST_BP_SOURCE = 'C:/Users/Frikk/Documents/GitHub/barkpark-editor'
npm --prefix app run shots:isolated *> app/test-results/c023-live-paper.log
$paperExit = $LASTEXITCODE
Get-Content app/test-results/c023-live-paper.log -Tail 25
if ($paperExit -ne 0) { throw 'C023 live Paper failed; inspect owned runtime status' }
~~~

Read the actual status manifest. Inspect five stills and all GIF frames; verify the actual frame count, provider, server/source versions and dirty fields. Never relabel fallback transcript as a real provider. Verify the logged private runtime stopped and its pgdata/postmaster.pid is absent; then release a544 source ownership.

~~~powershell
npm run verify *> app/test-results/c023-root.log
$rootExit = $LASTEXITCODE
Get-Content app/test-results/c023-root.log -Tail 25
if ($rootExit -ne 0) { throw 'C023 root verification failed' }
~~~

Release UI when foreground work ends; image review and evidence closeout can continue offline. Update the planned manifest with actual outcomes without inventing missing fields. Keep original failures, source attribution and operator-recovery limitations. Review repository truth, run the documentation checks, commit and push evidence. Do not change the cycle to done until all gates and actual reviews pass. Parent integrates hunks while preserving C010 lease relocation methods and runs its own combined gates.
