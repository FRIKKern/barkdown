# Archived npm code correspondence

15 October 2026: all **5,887 npm files across 134 package roots** in the actual
NSIS05 application archive now have one consistent locked installed-source
candidate for each package. **5,754 files match directly**. The actual installed
app-builder-lib26.15.3 helper reproduces the other **133 package manifests**
byte for byte. This is a read-only proof; the 49,374,074-byte ASAR remains
SHA2564038182a43da8a9acd70f94f0be64c815acbf0e6c57cfe86c2e8822b51869635.

[Corpus](corpus.json) retains the first133 raw mismatches rather than silently
normalizing them. [Structural comparison](manifest-differences.json) finds only
eight removed field classes: bugs, contributors, eslintConfig, gitHead,
keywords, nyc, scripts and xo. No added/changed value or retained-property
ordering difference is hidden. [Actual-helper proof](transformer-proof.json)
binds the real installed helper hash and lock entry, uses its default script/
keyword removal options, and compares every transformed byte. A per-package
candidate must explain all archived files together; per-file mixing is refused.

Contributor metadata was removed from 43 manifests. All matching source
metadata variants remain unchanged and are retained privately; the
[catalogue](contributor-metadata.json) records their exact paths and hashes.
Their presence/removal is an attribution-review input, not permission to omit
notices. No copyright or replacement license text was invented.

The archived npm namespace contains no unowned file or followed link in this
measurement. All observed source files, the lock and the original archive
remain byte-exact. The source lock also matches the installer producer revision.
Recorded producers require the owner’s retained NSIS extraction and installed
source tree; they do not execute the archived application or installer.

This proves correspondence to installed source files and an installed packaging
helper. It does **not** verify every publisher tarball, reproduce a complete
build/source offer, settle embedded/native/vendor licensing or establish A5.
Lazy-val’s standalone original, full notices/source/relinking, CRT minimum and
permitted clean install/update/rollback/uninstall remain open. Installer, app,
runtime, dependency and capture-map inputs are unchanged; no model call, real
library, binary publication, host-policy change or deployment is involved.
