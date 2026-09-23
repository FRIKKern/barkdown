# C039 / four-task completion audit

23 September 2026. Implementation `27ea120` on `codex/finish-profile-isolation`; main is unchanged. Acceptance is for the current Windows source prototype, not installation, portability or every operating system. No deployment, real-library migration or device credential changes.

## Requirements and inspected evidence

| Requirement | Evidence and result |
| --- | --- |
| Login assistance; cancellation/failure retains main/side text and images; explicit retry only | `provider-login.live.mjs` at clean source27ea120 passes ten capture steps using actual Electron/preload/composers and controlled login/SDK transport. Lifecycle tests cover duplicate starts, unavailable CLI, timeout, cancellation and verified owned-process cleanup. [Manifest](../visual/provider-login/27ea120/manifest.json). |
| Existing computer login by default; explicit selection preserved | Native `provider-discovery.live.mjs` passes initial keyring-only status and saved API/Codex choice. Actual status command probes from the preceding checkpoint used existing device login read-only. No copied credential files, consent prompt or silent provider substitution. |
| Expired login versus quota/network/tool errors | Installed Claude SDK authentication enum and Codex structured401 tested through actual adapters. Precise classifier tests reject rate limit, transport and tool-authorization false positives. Saved failed requests remain in transcripts; guarded explicit copy preserves newer drafts and attachments, with no dispatch. |
| Profile-owned API precedence and B device fallback | `provider-authentication.test.mjs` passes actual API/CLI capture plus six native child transports across A/B × API/Claude/Codex, using synthetic credentials. Delayed scope tests retain owner/environment and do not emit secrets. |
| Main/side/planning/worker/review/summary ownership | Four-role preflight precedes durable reservation. Goal adapter settlement retains the authentication hint. Scheduler and native goal view route CLI/API assistance without resuming; production callback checks captured profile/generation before settings. Existing ordinary/goal reservation and background completion regressions pass in final desktop suite. |
| Authentication recovery after profile switch/restart | Repository test delivers A's late auth failure with B selected, restarts repository, verifies saved A prompt/auth metadata and byte-identical B. Draft-copy unit cases cover images, newer input, pending/running/interrupted turns. |
| Repeated backed-up adoption | [Combined native41500dc](../visual/combined-native/41500dc/README.md), real runtime repeated adoption/restart/edited rollback, with original source/backup hashes; final desktop reruns adoption and crash-boundary regression suites. |
| Colliding-slug documents/media/search/Undo and B reading position | [Combined native3ce6b21](../visual/combined-native/3ce6b21/README.md), real two-runtime journey with A-only edit/Undo, B scroll/draft/parent/favorite restart. Underlying data adapters are unchanged by C039; reuse is explicit, not a claim of a new native run. |
| Caches, missing references, corrupt/interrupted storage | Combined41500dc native cache/folder/file/rollback evidence; final desktop cache, registry, lease, adoption, recovery and selected-B restart tests. All 102 retained combined-native artifact hashes were rechecked. Refusal/manual recovery limits remain recorded; no universal filesystem identity claim. |
| Fresh integration/visual/truth gates | Final desktop session37384 exit0 and root49277 exit0 on frozen source. [Validation/log hashes](../visual/provider-login/27ea120/validation.json). Explicit deterministic approval plus five live stills/37 decoded frames, ten login stills/19 decoded frames reviewed. Real isolated Paper/Codex turn; runtime stopped. |
| Audited migration preparation and handoff | [Preparation](../migration/README.md), actual converter harness and 22-case report: ten representation-preserved, five lossy, one unresolved reference, six refused. Inventory covers IDs, blocks/marks/tables/media, graph, Pages/favorites/tabs/chat references, receipts/history/proposals. API contract, stable mapping proposal, backup/progress/retry/rollback boundaries and first P2 slice are specified. No production migration or simulated server rehearsal claimed. |

## Decision and limits

C039 and A1/P1 are accepted for this Windows prototype. The four prepared tasks are complete at their stated scope: Task 4's **preparation** acceptance is complete; its separately gated real Paper migration rehearsal is future P2 work. G1/G2 release gates, actual browser account-login completion, native POSIX containment, packaged-app validation, migration and cross-machine portability are not implied by this decision. Prior evidence keeps its original source and limitations. The earlier ledger is historical; this audit supersedes its pending policy/combined-validation statements.

The entire broader product journey is not complete. Start P2 with a new bounded cycle before production migration implementation. Retain local authority and backups; resolve create-or-replace retry safety and all lossy mappings before any cutover.

## Manual checkpoint for the user

1. Start the branch build with disposable user data. Confirm your preferred provider stays selected; open Assistant Settings to check device-login status.
2. Keep different drafts in a main chat and saved side chat; open and close sign-in help. Neither draft should move or send itself.
3. In the controlled expired-session fixture, enter newer text before choosing “Copy message to empty draft”: it must refuse to overwrite. Clear the draft and copy explicitly; review previous effects before choosing Send.
4. Switch between two disposable profiles and restart with B selected. Confirm B's chats/tabs/drafts remain selected and A's background results stay in A.

No real sign-out or credential reset is needed to test failure paths. The fixtures manufacture those conditions without changing device authentication.
