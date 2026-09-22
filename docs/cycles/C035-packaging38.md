# C035 — Electron38 packaging resource proof

Base76b07d3 on isolated codex/packaging38-12h. Preserve exact Electron38.8.6 lock and all integration changes. C031 exposed inherited packaging omissions independently of its blocked43/44 upgrades: shared modules absent from ASAR; external PowerShell cannot execute a virtual ASAR path.

Bounded plan: include shared/**; unpack exactly goal-worker-host.ps1, local-barkpark-launch.ps1 and local-barkpark-boot.exs; fixed-name resolver maps only direct app.asar parent of main; route native launcher resources through it. Preserve current app/package scripts and lock. Add resource regressions and packaged-executable fixture option. Build actual38 distribution, compare bytes, invoke packaged PowerShell verifier; wait named UI grant for actual packaged terminal descendants/switch/crash/no replay. Source commit precedes native evidence. Root owns final combined/global approval; no P5 clean-machine, installed runtime or security-upgrade claim.

State: planning complete, offline preparation next. No UI/runtime owned. Original failed upgrades remain intact; no code consumed from them except reviewed generic packaging fixes. Existing C008 coordinator record archived as a snapshot, not marked complete.

Offline checkpoint: clean root/app npm ci13037 and Playwright Chromium setup pass; root build passes. Focused external-resource/goal-process/worker/terminal Node checks65266 pass21/21, local-barkpark headless checks pass. Electron38 distribution14551 is still building. One resource check was run before app.asar existed; retained package-resources-premature.txt records the sequencing error, not a completed-package regression. Both lockfiles remain unchanged. No UI/runtime launched.

Package14551 exited0 with Electron38.8.6. Completed archive checks pass all five shared JavaScript modules and all three unpacked native resource bytes; actual PowerShell -File verifier loads and returns true for an absent synthetic Job. This is not native descendant termination proof. Initial cycle schema check caught omitted evidence/review fields; corrected before source freeze. Source ready for review and queued packaged native grant.
