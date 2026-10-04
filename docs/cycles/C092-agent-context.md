# C092 — The agent's context: issues #67 to #73

**Why.** On 2026-10-04 the owner asked the agent inside Barkdown what it was loaded with and to write a paper about it. The agent had no library to write in, made the paper in Claude Docs instead, and filed seven issues. Four of them trace to one cause: the owner's profile had Barkpark stored as off, so there was no library and no `create_document`.

```
 owner's profile: barkpark { enabled: false }  ──►  no library  ──►  no create_document (#70)
        (stored by an unrelated settings save)                    └─►  agent makes a Claude Docs doc (#71)
                                                                  └─►  its link opens at a sign-in page (#74)
 claude.ai connectors in every run  ──►  extra context (#67), a repeated notice (#68), tools that drop and return (#69)
```

## What was measured (Agent SDK, the owner's login, Claude Code 2.1.289, Opus 5.5)

| Run | Input tokens |
|---|---|
| One turn, no MCP server at all | 16,654 |
| One turn, claude.ai connectors still connecting | 16,977 |
| Second turn, no connectors | 16,823 |
| Second turn, connectors connected (46 tools, all deferred) | 19,730 |

- The floor is Claude Code's own prompt and built-in tools, about 16.7K. Barkdown cannot shrink it, so #67's "under 10K" is not reachable.
- The issue's 36K is two turns added together (16,977 + 19,730 = 36,707).
- The connectors cost about 2.9K a turn, not 15 to 18K: their tool schemas are already loaded on demand. The cost is Claude Docs' instructions, the tool names and the sign-in notice.

## What changed

| Issue | Change |
|---|---|
| #67, #68 (notice), #69 | `strictMcpConfig: true` in `providers/claude.js`: a run carries Barkdown's two servers and nothing else. `settingSources: []` (C089 F2) was believed to do this and did not: all four connectors were still listed. No connector, no notice, no tools that drop out and come back. |
| #68 (alias) | `propose_document_edit` says what it is: the old name of `edit_document`, kept for a resumed chat, applying the edit directly. |
| #70, #71 | Every provider's instructions say: documents, papers and notes go in the Barkdown library with `create_document`; a paper is a document in this library; no other document service unless asked; with no library, say so and ask. `create_document` already existed and appears whenever the profile has a library. |
| #72 | A profile whose Barkpark block is all off and empty, and that the person never saved from Settings › Barkpark, counts as never configured and gets the carried runtime by default. Saving Barkpark's settings marks the choice as decided. When there is no connection the agent's context and the flag file carry the reason: failed to start (with the message), still starting, turned off, no runtime in this copy, or not set up. macOS has had the runtime since C086; the issue's premise that the sidecar was Windows-only was out of date. |
| #73 | When the chat's working folder has `AGENTS.md` or `CLAUDE.md` at its root, the run's context points at it. A pointer, not a load. |

## Evidence

- `app/tests/agent-library.live.mjs` (real Claude on the owner's login; not in the chain because it spends quota), `evidence/C092/live/2026-10-04T11-15-51-027Z-agent-library/`: the library is up by default on a profile stored as empty and off; "create a paper" used `create_document`; the paper opened beside the chat; asked for `mcp__claude_ai` tools the agent answered NONE; no approval card.
- Probe in the real app: stored-empty-off → connected; decided-off → not connected, reason "turned off in Settings › Barkpark".
- The app's test chain passes, apart from the profile tour's website wait under machine load, which passes alone.

## Limits

- Gmail and the other claude.ai connectors are not available in a Barkdown chat at all now. If they are wanted, that is a setting to add; it was not built.
- The owner's own profile has not been restarted on this build.
- Codex and the API loop carry the same library rule but were not run for real here.
- A profile someone turned off before this change and never touched in Settings › Barkpark will have its library turned on once.
- An earlier failed run of the test left `evidence/C092/live/2026-10-04T11-12-46-772Z-agent-library/` (the test's own assertion was wrong); it is kept as the record of that failed run.

## Task board

`bp -s Guerrilla task list` → "C092 Agent context", worker `claude-barkdown-c092`.

## Delivery

Delivered in [v0.6.0-nightly.20261004.3](https://github.com/FRIKKern/barkdown/releases/tag/v0.6.0-nightly.20261004.3), chain receipt on `ddda96ae`. Issues #67 to #73 closed; #67, #70 and #72 rewritten with the measured facts.
