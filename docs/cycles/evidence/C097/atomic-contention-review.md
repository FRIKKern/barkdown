# Windows atomic-write test repair

[Hosted Desktop 37604434402](hosted-desktop-11.json) failed at 58da49a4 in the controlled cooperating-writer retry case. The [raw failure](hosted-desktop-11.log) reports the first injected EBUSY after 631 ms. Source inspection identifies the elapsed retry-budget branch: Windows retries remain limited to five attempts and 120 ms. The hosted log does not measure individual filesystem calls.

The original case runs a real nested writer, including candidate preparation, inside its first rename. A controlled 150 ms delay reproduces the same refusal: [before](atomic-contention-before-01/result.json), [harness](atomic-contention-before.mjs). The production deadline is correct; lease exclusion should not depend on how quickly that nested candidate reaches the lease.

The repair makes only that test's performance clock deterministic. Real candidate files, leases, nested-writer refusal and the final revision assertions remain. A separate case advances the clock beyond the Windows budget and requires one failed rename, unchanged authoritative bytes/revision, retained unacknowledged candidate and released lease. On POSIX it checks immediate refusal without entering the retry clock. Production atomic-write.js is unchanged.

The first adjacent run exposed an extra platform skip introduced by the initial deadline test: [retained failure](atomic-contention-after-01/result.json). The final case has meaningful assertions on both platforms, preserving the seven existing Windows-only skip sites; no skip gate was weakened. The [final controlled slow-contender proof](atomic-contention-after-02/result.json) passes in 532 ms and all 47 atomic-write/lease/skip checks pass in 5.473 s. POSIX execution itself was not performed on this Windows host.

The [remaining Desktop plan](atomic-desktop-tail-plan.json) resumes immediately after atomic-write in the actual app test script. All65 commands [pass](atomic-desktop-tail-01/result.json), with 494.955s summed step time. New hosted checks remain required. Prior hosted passes do not establish current-head success. Test-only edits do not alter the runtime source captured at b4e85d7f; the new export ownership capture has its own explicit review.

[Root verification19](verify-19/result.json) passes in43.664s. The successful native coordinator and crash/relaunch continuation retains [17 inspected views](atomic-native-views/manifest.json); the [review](review-export-link.json) distinguishes synthetic transport and existing light-theme regression coverage.
