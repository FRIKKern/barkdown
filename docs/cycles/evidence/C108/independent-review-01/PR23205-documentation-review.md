# Independent non-author documentation review — Barkpark draft PR 23205

Reviewer: Claude (Fable 5.1), 2026-10-19. The PR's author is Codex. Read-only: the three documentation files the PR changes were read at its head `fce63d25ee134d11d9138ab369c3146e75b90f19`; every file they cite was checked for existence at that head through the GitHub contents API. No code was executed, no test replayed, nothing merged.

## What the documentation claims, and whether the records back it

| Claim (file) | Check | Result |
|---|---|---|
| `api/lib/barkpark/media/storage/README.md`: `Media.commit_pending_delete/2` is internal; HTTP delete still uses `Media.delete_file/2`; native cleanup is not enabled | Consistent with the PR body ("does not enable native cleanup, adopt HTTP pending deletion…") and with the C109 evidence README's closing limits | pass |
| Same: `LocalWrite.run/2` takes the preparation transaction's media-table lock before copy, byte write or delete; unresolved addresses refuse before I/O | The PR changes `api/lib/barkpark/media/storage/local_write.ex`, `blobstore/local.ex`, `managed_runtime/write_admission.ex` and adds `local_write_test.exs`, `local_write_live.exs`, `write_admission/physical_effect_test.exs` — the owners the claim names | pass (ownership); correctness not reviewed here |
| Same: link to the Windows release proof (`../../../../../docs/media/evidence/C109-windows-managed-blob/README.md`) | Five `..` from `api/lib/barkpark/media/storage/` reach the repository root; the target exists at the head | pass |
| `docs/media/evidence/C109-windows-managed-blob/README.md`: 63 owner/adjacent tests + 6 release cases in seven launches; 16 checkpoints in 153,903 ms; build 183,522 ms on OTP 28 / Elixir 1.20.1 | `provenance.json`, `native/result.json`, `native/source-inputs.json`, `build/result.json` exist at the head (2,010 / 4,930 / 1,422 / 1,124 bytes); `retained-failures/` and `gates/` exist. The numbers were not recomputed from those files in this review | pass (presence); figures taken on the author's record |
| Same: live entry points `media_pending_delete_live.exs`, `media_pending_delete_interrupt_live.exs`, `local_write_live.exs` in `api/test/barkpark/media/` | All three exist at the head (7,425 / 932 / 8,885 bytes) | pass |
| Same: limits — original-blob boundary only; renditions, caches, remote effects, full writer coverage, native cleanup, HTTP adoption and Barkdown's runtime pin remain separate; no real library/merge/deployment | Stated explicitly, in the same words as the PR body and the storage README | pass |
| `docs/cards/search-media.md`: links to `docs/search/INTELLIGENCE.md`, `docs/contracts/media-http-envelope.md`, `docs/media/IMAGE-TRANSFORMS.md`, `docs/media/SANITY-IMAGE-URLS.md`, `docs/media/DISCOVERY.md`, the storage owner README | All exist at the head | pass |
| Doc-tier headers (`human | canonical-for | budget`) on all three files | Present; the PR body reports the documentation budget/anchor gates pass locally and hosted technical CI is green (the Barkdown cycle record says the same) | pass, on the author's gate record |

## Findings

- No contradiction between the three documents, the PR body and Barkdown's C108/C109 handoff: every document states the same boundary (original-blob writes fenced by the pending-delete transaction's lock) and the same exclusions.
- Every file the documentation cites exists at the reviewed head; no dangling evidence link.
- The storage README is the one human-tier owner document for pending cleanup and says so (`canonical-for: media-pending-cleanup`); the card defers to it rather than restating it. That matches "one source for each claim".
- Two wording points a maintainer may want, neither blocking: "Managed delete reports filesystem errors" could name where (the receipt), and the evidence README's "All production input trees match" would read better with the comparison target named (it is in `provenance.json`).

## Limits

This is a documentation review, which is the gate the PR names. It does not establish correctness of the Elixir change, replay the Windows proof, or authorize integration or deployment — those remain the owner's decisions. The PR is still a draft at the time of review.
