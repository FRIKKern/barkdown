# C039 — Verify shared device authentication and profile ownership

The user decided on 23 September: use the computer's existing provider authentication by default, without asking. This supersedes the [opt-in proposal](../archive/C039-device-auth-opt-in-proposal.md). No per-profile consent prompt or separate-account requirement is planned.

## Selected boundary

- Main chats, side chats, goal coordinators and workers may use the computer's existing Claude/Codex login and supported environment keys by default.
- An explicitly configured profile API key takes precedence in the API provider. It remains owned by that profile; an empty profile must never fall back to another profile's key.
- Shared device authentication does not share documents, chats, drafts, folders, caches or run results. Runs keep their captured profile and conversation ownership.
- Do not copy login files into profiles or portable exports, sign out the device, or change real credentials as test setup. Provider command/file approval rules are unchanged.

## Current evidence

Existing runtime behavior already matches the chosen default: run-scope captures the device environment, CLI adapters use device login, and goal-worker IPC carries the captured environment. The controlled actual API adapter audit was rerun on 23 September at source 5325300 with synthetic keys: A used its owned key, empty B used the device environment key, and B did not use A's owned key. Fixture: bd-provider-key-boundary-9IMqo1. No network requests or real credentials were used.

Command: node docs/cycles/evidence/provider-credential-boundary.cjs. This audit is evidence for API precedence, not a fresh live authentication test of every provider or goal path.

## Remaining proof

1. Reconcile the A1 evidence table against the chosen shared-device boundary, retaining all workspace ownership gates.
2. Verify main/side and coordinator/worker dispatch preserve profile-key precedence and captured ownership while using shared device authentication by default.
3. Verify missing authentication reports the provider's normal unavailable state and preserves drafts; switching profiles must not borrow another profile's owned key.
4. Run relevant provider/profile/goal regression checks and close C039 only with recorded evidence. P1 remains active until its remaining acceptance evidence is reconciled.

## Checkpoint

This is a policy/documentation change; no runtime or UI change is required to enable the default, and no opt-in prompt is being introduced. C040 reviewed screenshots remain applicable. No services started. Root npm run verify passed for this update; controlled API evidence is recorded above. Continue on codex/finish-profile-isolation from merged main 7c3a325. Subsequent goals remain P2 one Paper engine, P3 recovery/portability and P5 installation; optional sync is P4.
