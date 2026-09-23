# C047 — Heading formatting and paragraph alignment

Starts from accepted C046, Barkdown 8abb615 / upstream 8d48ae661. Work stays on codex/p2-migration and the existing owned upstream checkout; no new branch, real-library access, cutover, merge or deployment.

The convenience converter currently flattens heading marks and ignores paragraph alignment. Upstream real Paper already carries marked heading content and center/right alignment. Audit those actual carriers, then implement and prove exact save/Undo/restart before admitting them through preflight. Keep unresolved internal links and deep levels whose display is clamped refused. Add external marked heading and aligned paragraph fixtures, including boundary/unknown metadata refusals.

## Acceptance and next action

Follow cycle.json. Preserve old prepared/staging plans: changed contracts must refuse rather than silently replay old targets. Native test expectations must compare every block and source/backup/workspace, not only rendered text. Root/desktop validation and fresh reviewed live/fixture evidence close the cycle.

Candidate implemented: rich headings retain native content carriers; center/right paragraphs and headings retain align. Deep displayed levels, unresolved internal links, unknown metadata, nested alignment and unsupported structures still refuse. The corpus now has 27 cases: 16 representation-preserved, three lossy, two unresolved and six rejected. Thirty migration unit checks plus production PortableDoc tests pass. Native harness expanded to sixteen cases, including heading breaks and literal LF inside a marked paragraph. No native result yet. Next: commit this source and run test:migration-editor:isolated against upstream 8d48ae661; inspect any failure before changing expectations. Upstream anchors validation from C046 is running under corrected bundled Python in owned session 14030; log C:/Users/Frikk/AppData/Local/Temp/c046-upstream-anchors-python.log. Keep its result in C046 evidence. Six-hour goal remains active through at least 04:17:20 UTC.

## First native checkpoint

Run 2026-09-23T23-07-55-168Z failed at paragraph-literal-break: native DOM normalization split one bold LF carrier into three equally bold carriers. Text/newline/marks survived; the harness demanded identical edited segmentation. Earlier rich/aligned heading and paragraph cases passed typing and exact saved Undo. The failed run is retained. The candidate assertion now compares the edited LF field by marked text runs with strict metadata and exact other blocks; initial/source/backup and saved Undo still require exact original carriers. Next: repeat the complete sixteen-case run and verify Undo/restart rather than inferring a pass. Private runtime pLApdv stopped.
