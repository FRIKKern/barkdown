# C039 — Finish the provider authentication boundary

Active on codex/finish-profile-isolation, based on verified checkpoint f00b489. The user authorized merging the existing combined checkpoint and focusing on remaining goals on 23 September. PR #30 carries the merge; inspect its current state before reporting it as merged. No deployment.

## Current evidence

The actual API adapter audit was rerun with synthetic credentials and a controlled client: A used its own key, empty B used the device environment key, and B did not use A's owned key. No network or real credentials were used. Command: node docs/cycles/evidence/provider-credential-boundary.cjs. Retained fixture: bd-provider-key-boundary-pfTzmC. CLI providers currently inherit the run environment and device home login.

The combined P1 native journeys pass as recorded in C008/A1-current-evidence. They do not establish separate provider accounts. Keep P1 open until the declared boundary and evidence agree.

## Choice and implementation map

Recommended policy: an explicit per-profile opt-in to device Claude/Codex login and environment keys; profile-owned encrypted API keys remain usable independently. The user's preference question is pending. Do not relabel device login as a profile-owned credential, manufacture separate accounts, copy login files, sign out the device or change real user settings as test setup.

- main/main.js: settings validation, persistence, public status and default-provider selection currently expose device availability unconditionally. UI must distinguish available on this computer from allowed for this profile.
- renderer/src/settings.js: put the choice with provider settings; main and side composers must show truthful availability.
- main/profile-service.js resolve/start: capture policy from the authoritative owning store, refuse before conversation reservation/provider launch where possible, and preserve the unsent draft.
- main/providers/run-scope.js: captures process.env. Environment-key fallback must obey captured policy; do not rely on clearing renderer flags.
- main/agent.js and providers/claude.js, codex.js: guard actual dispatch, including direct adapter paths. Reject unsupported or malformed policy, and do not silently substitute a provider.
- main/goal-provider.js, goal-worker-agent.js, goal-worker.js: queued and child-process runs must receive the same captured policy. Revalidate before launch after a user revokes permission; do not substitute the selected profile's settings. Define already-running behavior explicitly.

## Proof before closing

1. Controlled actual adapters: owned key works with device access denied; empty denied profile cannot consume environment keys or load CLI SDKs; A permission cannot authorize B; main/side and coordinator/worker use the same decision.
2. Native UI: save per-profile choice, switch A/B, refuse with retained text/images, change policy and explicitly retry once, then quit/restart. Preserve legacy content and login files.
3. Race cases: settings revocation during delayed scope/runtime acquisition, queued goal dispatch, background A completion while B is foreground.
4. Existing provider, profile, send-preservation and goal regression gates; real two-profile journey; source commit, reviewed screenshots/GIFs and evidence commit, root verify.

## Checkpoint

No app behavior changed. No new services running. Next action is policy implementation after the preference is settled. The main merge is a working checkpoint, not P1 completion. Subsequent sequence remains P2 one Paper engine, P3 recovery/portability, then P5 installation; optional sync is P4.

Planning checkpoint validation: root npm run verify passed after the documentation and cycle update. Read-only upstream refresh confirms PR #19579 OPEN/BLOCKED at a5440345c and no BARKDOWN_READ_TOKEN in Barkpark repository secrets. P1 is now accurately marked active with evidence links; it is not complete.
