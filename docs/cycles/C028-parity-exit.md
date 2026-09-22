# C028 — parity process exit guard

Base 51994b4; isolated codex/parity-exit-guard-12h. Parent C008 remains active. No UI, provider or runtime launches.

Failed-first actual runner: 15 cases, 5 pass / 10 fail; raw output in evidence/C028-parity-before.txt. Disposable child scripts prove false green after exit1 and controlled signal/spawn failures.

Plan: require successful process plus positive supported evidence; retain raw output and failure diagnostics. Paper structured results[].ok and opaque compound summary remain supported. Observational gaps output cannot establish green: converting that probe into behavioral assertions is a separate outstanding matrix task.

Validation and final combined visual/root freshness pending.

## Source checkpoint

Failed-first commit 0cf23f7 retained. Corrected actual runner: 24/24 controlled cases pass. Real child exit1 after a complete green report is red; deterministic spawn-result seams cover SIGTERM (including status0), and spawn error. All cases invoke the actual copied runner and inspect its exit and parity.json. Paper uses explicit nonempty boolean checks; opaque requires all three positive count equalities and bundle.pass. Gaps remains unsupported observational evidence.

Root npm ci and Playwright Chromium installation passed; check:cycle passed. Root verify follows source checkpoint; combined visual/root freshness and actual live matrix remain pending. No product code, CI configuration, credentials or upstream workflow changed.
