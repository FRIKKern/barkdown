# Actual checkout releases before failed rendition deletion

The real full-application caller changes the mediaAsset document, then returns success after Windows refuses rendition-directory removal. A trusted hold reaches held/zero after the Content update and remains there across the deletion attempt. The helper discards its actual File.rm_rf error.

Four checkpoints pass in 54,651ms of owned lifecycle; the fixture body takes 4,245ms. Actual scoped Media.upload, Assets and Checkout create the file/document and revisions through the running plugins/Repo/PubSub. Private observers record the post-Content barrier and rm_rf result while preserving original return behavior. The native lock denies deletion but permits reads.

The observed error is :eexist at the owned directory. Residual children: z-locked.bin. No sibling-removal order is assumed. Native original and locked-child identities/bytes remain exact; the media row is unchanged. Returned and persisted rev agree and the holder clears; current_revision_id values are retained separately without claiming whole-struct equality. All owned services stop; original files, residual cache, database and journals remain. Runtime 6193 files, five source owners,205 entry originals and the pinned PowerShell cache remain exact.

[Author review](review.json), [actual return](result.json), [rm_rf result](rm-result.json), [process/counter/native proof](process.json) and [post-shutdown observations](post-shutdown-observations.json) retain the measured facts. Failed preparation526, root-casing529 and unsupported error-path assertion531 are retained alongside their fixture-only corrections. Fresh534 completes the skipped live assertions.

This is a synthetic direct caller proof with the real full application and an explicit admin flag, not HTTP authorization coverage, a production repair, atomic checkout/cache settlement, source/runtime adoption or stage acceptance. Source PR23205 stays frozen. Generic SVG404 and conservative warm-error recovery policy remain unresolved. Original ordinary caller contracts and bounded admission/physical-settlement design are next.
