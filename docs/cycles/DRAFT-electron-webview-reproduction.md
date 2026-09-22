# Restarting the Electron webview investigation

Offline preparation, 22 September 2026; app code inspected at `3ce6b21`. No runtime, version installation or behavior change was made. Both upgrades remain blocked; this plan does not supersede the original evidence.

## Established controls

| Original source / retained evidence | Observation and limit |
| --- | --- |
| [44 comparison, 57ee09c](https://github.com/FRIKKern/barkdown/blob/57ee09c/docs/cycles/evidence/C031-electron44/webview-regression-comparison.json) | Exact fixture/app source `6b60be4` and installed dependencies: 44.4.3 crashes returning B→A, native exit `-1073741819` (`0xC0000005`); replacing only the executable with 38.8.6 passes website storage/cookies and selected-B restart. Fresh disposable user data for each. This isolates an executable-dependent regression in these runs, not its cause. |
| [43 minimal summary, 010c1b0](https://github.com/FRIKKern/barkdown/blob/010c1b0/docs/cycles/evidence/C031-electron43/minimal-summary.json) | A/B/A persistent guests pass on 43.7.3 with immediate duplicate navigation, delayed navigation/hide-show, and template creation; matching 38 template control passes. This does not reproduce the actual app. |
| [43 handoff, 010c1b0](https://github.com/FRIKKern/barkdown/blob/010c1b0/docs/cycles/C031-electron43-contingency.md) | Actual app `09a3258` crashes returning A. Diagnostic `0005812` with `--disable-gpu` also crashes with the same native code. The flag is not a fix; this does not identify or exclude a graphics cause. |

## Next bounded reduction

After a named UI grant, retain one frozen diagnostic source and explicit executable paths/hashes. First repeat its 38 control and 43 failure with fresh roots. Original actual fixture accepts `BARKDOWN_PROFILE_TEST_EXE`; its GPU diagnostic is `BARKDOWN_PROFILE_DIAGNOSTIC_GPU_OFF=1`. The minimal fixture accepts `BARKDOWN_REPRO_EXE`, `BARKDOWN_REPRO_TEMPLATE=1`, and `BARKDOWN_REPRO_DELAY=50`. Run each from its original lane's `app` directory using `node tests/profile-ui.live.mjs` or `node tests/webview-runtime-repro.live.mjs`; never silently substitute the integrated fixture or install a new version.

Then extend the passing minimal shell one factor at a time:

1. Add the actual main-owned selected-profile transition and awaited renderer reload. Record requested partition, effective partition, selected UUID/generation, host/guest webContents IDs and destruction/attachment/navigation timestamps. Actual [main attachment](../../app/main/main.js) overwrites both preferences and params from selected profile; the minimal shell merely copies the requested partition. A mismatch is a hypothesis, not an observed fact.
2. Add the real [website controller](../../app/renderer/src/tabs/website.js), including initial src, dom-ready-dependent loadURL, title/tab persistence callbacks and destruction. Then add [work-tab](../../app/renderer/src/index.js) hide/mount/show behavior. Simple duplicate navigation and hiding alone already passed; avoid repeating that as a sufficient reduction.
3. Only if still passing, add actual preload/state restoration and shell styling independently. Keep guest sandbox, context isolation, node integration and permission restrictions identical. Do not weaken them to obtain green evidence.

For every delta preserve both pass and fail reports, request logs, crash events/dumps if available, screenshot and owned-process stop result. Require A/B/A storage **and cookie** separation and no guest crash; minimal tests previously covered localStorage only. Stop at the smallest failing delta, then repeat that exact source with 38 and 43. A passing reduction is not permission to consume an upgrade: full desktop, Paper, packaged execution and visual/live/root gates remain necessary.

## Release boundary

The retained dependency audit reports Electron advisories; candidate 43/44 audits reported zero findings at that time. Neither a zero audit nor the functioning 38 fallback establishes release safety. Reassess advisory applicability and current supported versions separately before release; do not declare any advisory unreachable from this crash investigation. Keep the regression and security gates independently open, preserve the existing lock, and retain the original blocked handoffs. P1 and authentication-policy acceptance are unchanged.
