# C106 — Windows installer engineering

Build an actual unsigned x64 NSIS installer from merged Barkdown main and an explicitly selected pinned Windows runtime. The package must carry its runtime and preserve data by default; build and payload inspection are engineering proof. Clean-machine installation and A5 remain separate.

Affected boundaries: package producer, runtime selection, NSIS configuration, output refusal and payload identity. During work: wrong pin/architecture, existing/linked destinations, source preservation and actual resources. Ready checkpoint: real NSIS build, artifact/payload inspection, relevant regression/root verification and applicable visual review before publishing code/evidence. No execution of the installer on this developer host or release/feed publication.

Initial setup89864 is terminal0: locked root/app npm ci pass, Chromium exists and locks are unchanged. App audit reports7moderate/2high advisories; review their scope before distribution. Read actual owner modules/tests before behavior edits. The prior retained runtime includes an unaccepted native lifecycle prototype; do not adopt it silently. Ordinary CRT prerequisites, complete notices and clean-machine access remain open.

Current G2 work is separately published in PR78/root254ea13f and sourcePR23109/1136595a5. Its repaired hosted shape job passes; source parity38475695616, spec38475695470 and client Desktop38476317767 remain live, while client Verify38476317734 succeeds. Preserve these runs. C105 serverPR22954/rootPR77 remain unmerged; migration-manifest conflict is assigned to media integration. Neither checkpoint accepts physical cleanup, real-library/Mac transfer or A2/A3/A5.

[Entry and inherited cycle](evidence/C106/entry-01/entry.json) retain the incoming main handoff without treating it as current instructions. Migration estimate reviewed unchanged495/(495+156),46/156/980, low confidence; P5 is outside that basis. Main+three Barkdown lanes fits the branch budget; historical/locked checkouts/builds and originals remain. Next hygiene review: installer publication/integration; no destructive cleanup.

Current producer/refusal implementation: seven controls pass, and the actual6067-file runtime matches its reviewed inventory. Root check now invokes these controls. Commit implementation before artifact proof. Actual NSIS build/resources/payload inspection remain next; no installed-machine acceptance.
