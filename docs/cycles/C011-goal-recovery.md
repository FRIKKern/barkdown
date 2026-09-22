# C011: Electron goal recovery

Starting evidence: source043e472, verified/pushed checkpoint5c27845. C005 is archived in [its completed record](../goals/C005-completed.json). Full goal remains active; central P1 queue unchanged.

Outcome: abruptly end the actual Electron main process while three owned workers stream, reopen the same disposable profile, inspect persisted interrupted work, verify shutdown through the UI, explicitly review/retry, and preserve human drafts and side-chat relationships. No real-library changes, no background-service claim, no automatic replay. Natural-language planning is a later bounded outcome.

Acceptance: actual native workers and SDK/local HTTP; no new request on reopen; Resume blocked until all uncertain workers are reconciled; trusted Check worker shutdown; explicit review gates; retained partial replies, draft, parents and attempt identity after retry. Capture intermediate and final recovery views. Run relevant tests, source commit then visual/live evidence, root verify and truth review.

Checkpoint: planning only. No owned processes. Next: add profile-goals-recovery.live.mjs and exercise current UI before changing behavior.

## First recovery fixture checkpoint

Added actual Electron/local-HTTP recovery journey; not yet passing. Initial harness failures: omitted generation envelope was correctly rejected; async browser polling returned before durable progress, replaced by explicit acknowledged snapshot polling; Playwright process() identified Windows cmd launcher rather than main, so crash target now comes from Electron main and must match the disposable journal lease. The test killed only that verified owner; one launcher-only experiment left main7436 alive and it was explicitly stopped after checking its command/root. A subsequent true crash recovered paused, no replay, and trusted shutdown succeeded; fixture incorrectly waited for a form hidden inside closed details, now corrected to attached state. No production behavior weakened. Current rerun pending; source remains uncommitted and new capture/root gates remain pending.

## Passing journey, source review

Actual Electron crash/reopen/shutdown/review/retry passed using a synthetic environment API key; root bd-goal-ui-recovery-4iGBMy. Three first attempts remain partial, three second attempts complete; zero requests on reopen or during review, exactly six after explicit Resume. Four recovery screenshots inspected. UI exposed misleading recovered wording saying process stopped before trusted proof, changed to interrupted/needs reconciliation; pending retry now shows the completed review note rather than an outdated instruction to review.

Separate finding: synthetic encrypted API key remains enc: in settings.json but is unavailable after abrupt reopen. The recovery test uses environment credentials to isolate worker lifecycle and does not prove encrypted-key recovery. Coordinator was informed. Remaining: rerun changed UI and46 goal checks, commit source, capture fresh deterministic/live evidence and complete root/full desktop gates. Current app/test/docs changes uncommitted; no test-owned processes running.

Changed UI rerun passed (gjlXjw); combined46 goal tests pass. Test added to the full desktop gate. Five-frame manifest now records source/dirty provenance and explicit transport/credential limitations; fresh committed-source capture remains next.

## e9be019 validation checkpoint

Source committed/pushed e9be019. Full desktop gate passed, including46 goals,76 desktop checks, all profile/editor/conversation regressions and the new actual crash UI journey (IbyKaD).31 deterministic frames inspected; all pixel/geometry comparisons unchanged, explicit approval saved. Five recovery stills inspected including390px, retained under docs/goals/evidence/e9be019; manifest dirty=true reflects parallel docs visual generation only, not uncommitted app code. No continuous-motion recovery claim. Live Paper slot is queued after the other task's adoption runtime; root freshness/verify and evidence commit remain next.

Synthetic credential experiment mveveS confirmed acknowledged encrypted settings exist while Chromium Local State/key file does not yet exist; abrupt kill then restart makes safeStorage.decryptString throw. Existing p95Bun ciphertext also fails directly with encryption available. Only synthetic disposable keys used; no key material printed. Further isolated fix is assigned after C011 closeout; this is not covered by environment-key recovery test.

Credential audit follow-up: fresh4icf4p actual-app experiment observed Local State appear with encrypted_key after9144ms. Killing immediately after observed persistence then reopened with roundtrip=true. Electron38.8.6 [browser process source](https://raw.githubusercontent.com/electron/electron/v38.8.6/shell/browser/browser_process_impl.cc) stores Local State under DIR_SESSION_DATA and commits pending preferences at shutdown; [safeStorage source](https://raw.githubusercontent.com/electron/electron/v38.8.6/shell/browser/api/electron_api_safe_storage.cc) uses OSCrypt. Installed38 API has no documented Local State flush. Future gate must observe and sync the real sessionData key file, fail if unavailable, and preserve profile generation while awaiting; a sleep alone is not proof. Local runtime credentials share this boundary, so API-key-only fixing would be incomplete.

## Completed bounded outcome

`npm run verify` exit0 (session93687). Full desktop exit0 (45796). Live Paper82264 exit0, no postmaster.pid, slot released.31 fixture frames+five recovery stills+five Paper stills+37 live GIF frames actually inspected. Truth reviewed README, app guide, NEXT-AGENT, PLAN/plan.json, VALIDATION, architecture and integration contract: no new central stage completion, encrypted-key defect explicit, planner/reviewer still required. No owned processes remain. Source e9be019 pushed; this evidence commit contains only documentation/artifacts. Next: archive this completed record and open C013 credential durability; coordinate main.js integration with parent. Then natural-language coordinator.
