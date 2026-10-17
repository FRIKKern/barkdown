# Locked publisher-package correspondence

All **5,887 carried npm files across 134 package roots** are accounted for against
133 cached publisher tarballs whose bytes match the committed lock integrities.
No package was downloaded, extracted to disk or executed.

- **5,752 files** match publisher members directly.
- **133 manifests**, including the nested fast-uri benchmark manifest, match the
  input and exact output of the already reviewed real packaging helper.
- **Two node-pty console binaries** match x64 publisher members at different paths.
  The publisher’s exact post-install script copies them into the packaged paths;
  it was inspected and was not executed.

[Raw comparison](raw-member-comparison.json) preserves the initial nested-manifest
difference and two missing-path results. [Classification](joined.json) explains
each with exact hashes; no unmatched code was silently normalized. The original
ASAR, dependency lock and cached archives remain unchanged. The corpus pass took
1,284ms and classification took 210ms; these are measured command times.

This narrows package provenance. Lock integrity is not a vendor signature or a
complete build/source reproduction. Compiled publisher binaries remain compiled
payloads. Original notices, vendor changes, corresponding source/relinking, CRT
minimum and permitted clean installation/update/rollback/uninstall remain open.
The missing lazy-val original is still unresolved; no substitute was invented.
No app, installer, runtime pin, visual baseline or acceptance stage changed.

The preceding installed-source checkpoint is published at 1020fb84, with
[branch-exact hosted Verify](prior-hosted.json). This new evidence requires its
own root and hosted closeout before publication is called validated.
