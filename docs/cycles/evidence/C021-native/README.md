# Native rollback process proof

Source `054e5f1` (clean app tree), Windows; node --test app/tests/profile-native-preflight.test.mjs passed all five groups.

[Normal stop](stopped.json) and [forced supervisor crash](crashed.json) each launched a real owned worker, child and grandchild inside a second profile with no local database. Rollback refused while native verification was false and all three PIDs were alive; exact authority-journal bytes stayed unchanged in active state. After explicit owned stop or forced supervisor death, the native verifier established zero descendants, rollback retained the edited profile and original workspace bytes remained unchanged. Fixtures are retained at the absolute paths in the reports.

This is native process integration proof, not UI proof or whole-P1 acceptance. Actual Electron refusal/retry, final deterministic/live images and root verification are still pending. The test never stopped unknown processes or touched a person's library.
