# Workspace draft quit repair

The renderer now waits for outstanding workspace writes, then saves the exact current view before answering quit. Disk refusal, ownership changes and late edits keep the window open. It verifies Paper receipts again after the workspace await. Chat composition refuses before the input freeze can end it.

Paused preparation uses an actual owned workspace readback instead of a new write through closed admission. The comparison includes conversation drafts, images, tabs, organization and navigation; provider-owned transcripts and bookkeeping are excluded for profile views. Missing `closedTargets` is normalized to the same empty array used at load. Legacy views still compare their transcript content.

Original diagnostic failures remain in [the review](quit-workspace-review.md). First targeted checks pass in [unit01](workspace-quit-unit-01/result.json): six workspace, six handshake, 55 Paper-host and five preparation cases. The first [native rehearsal](workspace-quit-native-01/result.json) passes: an immediate draft survives quit/restart; a real disposable store obstruction refuses Windows close and preserves the visible draft; restored storage accepts retry and restart with the latest words. The existing missing/corrupt-workspace journey also passes after restoring its disposable store before requesting verified quit.

Validation remains in progress. Native dialog requests are intercepted, not visually rendered. Native captures use dark mode; the existing temporary warning can cover part of the composer controls until it expires. Final capture also checks the unobstructed narrow state. No real library, provider or Mac transfer is exercised. No full shutdown/installer acceptance claim.

[Second unit pass](workspace-quit-unit-02/result.json) covers final owner binding: six workspace, six handshake, 55 Paper-host and five preparation cases. [55 adjacent checks](workspace-quit-adjacent-01/result.json) pass in 19.967s. [Native02](workspace-quit-native-02/result.json) passes in 11.493s, with the existing preservation journey passing in 5.469s. Final post-commit native and clean-frozen replay remain next.
