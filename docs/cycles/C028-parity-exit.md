# C028 — parity process exit guard

Base 51994b4; isolated codex/parity-exit-guard-12h. Parent C008 remains active. No UI, provider or runtime launches.

Failed-first actual runner: 15 cases, 5 pass / 10 fail; raw output in evidence/C028-parity-before.txt. Disposable child scripts prove false green after exit1 and controlled signal/spawn failures.

Plan: require successful process plus positive supported evidence; retain raw output and failure diagnostics. Paper structured results[].ok and opaque compound summary remain supported. Observational gaps output cannot establish green: converting that probe into behavioral assertions is a separate outstanding matrix task.

Validation and final combined visual/root freshness pending.
