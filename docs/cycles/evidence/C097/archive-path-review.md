# Profile archive path validation

Source review at79e66206 found slash-only traversal rejection and an unchecked profile-prefix assumption. Both [disposable import reproductions](archive-path-before-01/result.json) fail their expected-refusal assertion: the original importer accepts backslash traversal and a store path whose first eight characters are not profile/. Every source and destination remains inside the test’s temporary root; no real content is touched.

The repair validates every entry before payload reads or profile creation: canonical portable paths, database/media/profile sections, the existing exported store allowlist, excluded ownership keys and duplicate paths (case-folded on Windows). It rejects native separators, drive/stream syntax, traversal, reserved device names and trailing dot/space aliases. It adds no endpoint or recovery acknowledgement.

[Both original regressions pass](archive-path-after-01/result.json) in0.197s. [Adjacent checks](archive-adjacent-01/result.json) pass31 tests in5.848s, including23 malformed-manifest variants refused before profile creation/restore and a valid nested Unicode attachment copied byte-for-byte. Existing tamper/version/refusal and navigation re-ownership checks pass. These use a stub restore; the native two-installation journey is tracked separately.

This is manifest path validation, not a complete adversarial archive audit. It does not solve filesystem substitution races, historic media reconciliation, authenticity, actual Mac transfer or clean-machine installation. Native, visual and root closeout remain pending in the current cycle.
