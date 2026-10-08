# Windows runtime preparation review — 8 October 2026

The [fresh build](release-build-01/result.json) uses the unchanged pinned Barkpark checkout, a private production build, selected Elixir 1.20.1/OTP28 and Visual Studio x64 tools. It carries ERTS16.4, 4,510 payload files and 175,758,067 bytes before the Barkdown stamp. The [stamp](release-build-01/barkdown-release.json) records lock, builder and Mix-driver hashes. [Tested source](release-tested-source.json) binds the new scripts and root check command to the native proof. Output links are refused; no checkout source or real library was changed.

Reviewed the build log and [native result](release-native-04/result.json), plus server/database logs: actual migrations, clean seed and real Paper operations complete from a fresh spaced relocation with only Windows system directories in PATH. The listener is measured as IPv4 loopback; write without credentials refuses. Content and revision match after server restart. The owned server and private database stop. The harness's losing shutdown timer is now cleared, so a passed run exits without a lingering timer.

Retained preparation attempts establish the corrections:

- [Preparation01](release-preparation-01/observation.json): PowerShell promoted a compiler warning to a launcher failure; the child exit was unproven. Its partial log remains. Node file-backed capture retained the actual exit for [preparation02](release-preparation-02/result.json).
- [Relocation01](release-relocation-01/result.json): carried Erlang and native module loading work from a spaced path, before the application started.
- [Native01](release-native-01/result.json): migrations and seed passed; the generated batch argument loop broke a quoted extra script path. The environment-based bootstrap avoids that argument loop. Original harness and logs remain.
- [Native02](release-native-02/result.json): the harness incorrectly expected anonymous published reads to refuse. Upstream `optional_token.ex` explicitly allows those reads; the harness was corrected and a separate anonymous mutation refusal asserted. Original harness remains.
- [Native03](release-native-03/result.json): corrected private preparation passed. [Native04](release-native-04/result.json) repeats that behavior through the repository builder and reusable native harness.

This is engineering compatibility proof, not a Windows app or installer. Complete Windows notices, app process ownership/recovery, older PostgreSQL profile upgrades, private API confidentiality and clean-machine install/update/uninstall remain open. Explicit loopback bootstrap overrides upstream's all-interface production default. No visual behavior changed: the current Windows app capture still represents its source runtime, not this release. Migration effort stays about 75% on its existing six-row basis; packaging is outside that estimate.
