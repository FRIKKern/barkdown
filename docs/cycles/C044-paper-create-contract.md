# C044 — Safe Paper creation

Completed at the isolated contract scope on `codex/p2-migration`, source `b1cd732`; not merged. Upstream implementation `15bfe254a`, test/documentation tip `844ecd321`, is pushed as [draft PR #20020](https://github.com/FRIKKern/barkpark/pull/20020), stacked on `codex/canvas-block-identity` (`bf23f773`). That dependency is not upstream main integration.

The [baseline probe](evidence/C044/contract-probe.json) reproduced published-content replacement through generic createIfNotExists + publish and two distinct create receipts for one concurrently created draft ID. The new `POST /v1/plugins/bulldocs/papers/:slug/create` accepts native blocks, retains auth/scope/publish checks, refuses existing published/draft targets, and only inserts. Ordinary ingest remains upsert. Existing generic writers can still create a draft concurrently; the new route is not a namespace reservation or migration cutover.

## Verified evidence

- [Real HTTP contract](evidence/C044/create-contract-1790193904428.json): full published and draft documents remained unchanged; three six-caller races each had one winner and five refusals; winning structured content matched. A forwarding proxy destroyed the response after commit, then scoped readback recovered exact content with zero create replays. Auth, draft namespace, HTML-only and wall refusals passed. All private runtimes stopped; real libraries and CLI settings were untouched.
- Upstream isolated Windows build passed. Controller, existing ingest and scope suites passed **63 tests** against temporary PostgreSQL. The initial draft assertion compared a pre-history-write return struct; fixed to compare database snapshots before/after refusal. This changed the test, not persistence. Retained launcher/logs/hashes: [results](evidence/C044/results.json).
- Root `npm run verify` passed. Live Paper at `b1cd732` / `15bfe254a` includes a real Claude edit and saved revision; five stills and all 37 decoded GIF frames inspected. [Manifest](../images/status/history/2026-09-23T20-08-33-540Z.json). Fresh deterministic capture has 40 frames and zero pixel/geometry differences; all eight GIF sequences including narrow layouts inspected and [approved](../visual/reviews/approval-859308019d745381a698c4a3f5f420b56bf52fa4d6db8212dc76e7e2bcf760be.json). UI tours are regression evidence, not migration proof.

The first contention fixture reused near-identical topics across rounds and correctly hit deduplication. Distinct topics fixed the fixture without bypassing the wall. Ambient PATH selected obsolete Elixir initially; that owned process was stopped and the build used Scoop. A temporary ExUnit launcher quoting error stopped its private cluster before retry. No shared service was stopped.

## Remaining work and ownership

C045 should implement a durable staging plan and readback reconciliation using this explicit route, with source/profile/target identity, exact structured comparison and process-interruption tests. Publishing metadata must be supplied explicitly; do not invent tags or bypass policy. Media, internal links, navigation activation, rollback and legacy retirement remain unproven. No real-library migration, deployment or merge.

Upstream task `task-0974164b66eea275`, worker `codex-barkdown-c044`, remains held for PR review; inspect its current epoch before renewal/stamping. Worktree: `C:/Users/Frikk/.codex/worktrees/barkpark-paper-create`. One Barkdown delivery branch remains active. The existing two-hour goal/heartbeat continues through at least **2026-09-23 21:43:38 UTC**; this milestone does not end the run.

Truth review covered README, app guide, PLAN/plan.json, NEXT-AGENT, VALIDATION, architecture, decisions and visual area READMEs. P2 remains active. G1 PR #19579 was rechecked open with conflicts/failing checks at `a5440345c`; G2 issue #4 remains open. Upstream doc-budget checks expose inherited API-guide/table-contract overages; the touched plugin contract was compressed under its existing cap. Windows Git Bash anchor checks report unresolved paths and are not claimed passing. Upstream required CI remains a separate review gate.
