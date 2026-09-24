# C059 — Saved Paper navigation

Accepted locally on codex/paper-library, draft PR33; evidence push follows. Minimum run end2026-09-24 10:18:54 UTC. No deployment or real-library cutover.

Implemented at385d072: catalog, saved tabs/favorites, owner-qualified human Pages, links and provider activity carry an opaque durable library owner. Unknown historical references are retained, never guessed from the current catalog. Foreign/unknown targets refuse before Paper reads; returning to the original connection restores access. Typed summaries do not borrow another source. Direct ancestor Pages navigate back correctly; importing a local copy mounts its own controller and retains the original.

## Validation checkpoint

- Six focused actual IPC/provider/ancestor tests and Pages checks pass. The first full desktop failed SDK initialization ordering; fixed and rerun passed, but later UI changes still need the final rebuilt suite.
- Expanded native385d072 passes A/B same-slug refusal, human organization preservation, Retry and two actual restarts, native child-link → parent Page and separate imported-copy controller. [Gallery](../visual/paper-navigation/runs/2026-09-24T08-28-41-875Z/README.md): all9 stills and45 decoded GIF frames inspected;12 original hashes verified. Narrow light/dark notices fit. All owned capture services stopped.
- Full corrected local parity385d072 passes20/20, including tables11/11, gaps13/13 and tablehead6/6. [Logs](evidence/C059/parity-385d072/isolated-run.log).
- C058 Linux35971541340 failed18/20: gaps used server-less setup; tables retained cell selection. Both fixtures corrected without weakening exact content assertions. Earlier local68b23dc was19/20 because linkpreview omitted owner; shared explicit catalog selection now passes. These original failure logs remain retained. New Linux pending push.

The retained-evidence regression passes at5bc6144 after exercising explicit original-library Retry: HTTP/MCP CLI restart/Undo, refusal and title-draft preservation. All11 stills/58 decoded frames reviewed. Open-buffer regression also passes13 zero-request refusals, retained human words/Retry/Undo/CLI/restart; all9 stills/48 decoded frames reviewed. Final rebuilt `npm run test:desktop` passes at5bc6144 (Windows conditional provider test skip retained in log).

## Closeout

Final live/standard captures at a11621d pass. Actual review:5 live stills/37 GIF frames (real Claude, tablehead6/6),40 standard stills/40 differences/40 GIF frames, unchanged pixels/geometry. Explicit immutable approval recorded; `npm run verify` passes. [Closing review](evidence/C059/review.json) maps commands, sources and limitations. C058 Linux18/20 is preserved; new exact-head Linux remains pending push.

## Next action

Push this evidence checkpoint and inspect exact-head CI. Archive C059 JSON before planning trusted managed-local Archive classification as C060. Keep human Pages unchanged; no migration authority selection.

One delivery branch/open draft PR33. Main is merged PR32d126875; upstream30c007 is unchanged.43 locked historical worktrees retain evidence; next hygiene review must preserve unique content before retirement. Legacy Markdown import limitations remain; no migration, physical database identity, title support or portability completion claim.
