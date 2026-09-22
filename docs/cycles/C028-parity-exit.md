# C028 — parity process exit guard

Base 51994b4; isolated codex/parity-exit-guard-12h. Parent C008 remains active. No UI, provider or runtime launches.

Failed-first actual runner: 15 cases, 5 pass / 10 fail; raw output in evidence/C028-parity-before.txt. Disposable child scripts prove false green after exit1 and controlled signal/spawn failures.

Plan: require successful process plus positive supported evidence; retain raw output and failure diagnostics. Paper structured results[].ok and opaque compound summary remain supported. Observational gaps output cannot establish green: converting that probe into behavioral assertions is a separate outstanding matrix task.

Validation and final combined visual/root freshness pending.

## Source checkpoint

Failed-first commit 0cf23f7 retained. Corrected actual runner: 24/24 controlled cases pass. Real child exit1 after a complete green report is red; deterministic spawn-result seams cover SIGTERM (including status0), and spawn error. All cases invoke the actual copied runner and inspect its exit and parity.json. Paper uses explicit nonempty boolean checks; opaque requires all three positive count equalities and bundle.pass. Gaps remains unsupported observational evidence.

Root npm ci and Playwright Chromium installation passed; check:cycle passed. Root verify follows source checkpoint; combined visual/root freshness and actual live matrix remain pending. No product code, CI configuration, credentials or upstream workflow changed.

## Handoff

Source b83efb1 pushed. Root `npm run verify` failed at inherited screenshot freshness: latest UI16a3b6085, global captured e38038577. Build and TypeScript completed first; later root tests were not reached. Raw output: evidence/C028-root-verify.txt. No screenshots were launched, restamped or approved; this lane has no UI/runtime ownership. Final combined visual/root gates remain required, so C028 stays active pending integration.

Truth review: README/app guide/PLAN and decisions remain unchanged because no product behavior or roadmap changed; EDITOR-PARITY now names the exact evidence rule and unverified gaps probe. NEXT and VALIDATION point to this bounded result. No P1, upstream merge or CI credential claim. No owned processes. Next: import source/test/package command union into combined branch, independently rerun24 controlled cases, then use the coordinator’s final combined gates.
