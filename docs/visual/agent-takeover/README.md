# Agent editing and human takeover

The combined [E002 live review](runs/2026-09-21T23-40-28-032Z/README.md) passes all eight recorded scenarios on source `ae49f97` with Paper `bb3bd299d`. Acknowledged edits survive immediate human typing, IME and pointer takeover. First receipt insertion preserves document geometry.

![Actual agent intent, selection, writing and receipt.](runs/2026-09-21T23-40-28-032Z/receipt-motion.gif)

Keep the [before-fix diagnosis](before-fix/README.md): it records the original acknowledged-text loss. The current evidence uses real Electron, Paper and revision-checked operations; it does not imply a live model turn or full editor completion. E003 is separately improving selection fidelity for marks, links, lists and tables.
