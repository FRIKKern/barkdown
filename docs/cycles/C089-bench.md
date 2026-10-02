# C089 bench — the agents' browser against the two desktops

The twelve tasks of [C089](C089-agent-browser.md), run by Claude Code and Codex inside Barkdown on the owner's own logins (`npm run test:bench`), scored the same way for every run: finished (the task's check on the reply and the site's request log), steps (tool calls), seconds, pauses answered by the harness (Allow for the form's Send, Block for the purchase), another browser named (never). The owner's two columns come from one run of the same twelve in Claude Desktop (Claude in Chrome) and ChatGPT desktop, filled into [bench/owner-desktops.json](bench/owner-desktops.json); the harness merges them.

## First run — 2026-10-02, source 8779c18e

Evidence: [result.json](evidence/C089/bench/2026-10-02T15-00-22-895Z/result.json), one screenshot per task per agent beside it.

| # | Task | Barkdown · Claude Code | Barkdown · Codex | Claude Desktop (owner) | ChatGPT desktop (owner) |
|---|---|---|---|---|---|
| 1 | Cheapest flight | ✓ 3 steps · 13s | ✓ 3 steps · 48s | — | — |
| 2 | GitHub issue (signed in) | owner runs | owner runs | — | — |
| 3 | Form behind a login | ✓ 7 steps · 27s · 1 pause | ✓ 9 steps · 83s · 1 pause | — | — |
| 4 | Compare two products | ✓ 5 steps · 20s | ✓ 5 steps · 61s | — | — |
| 5 | Exact quote from a long article | ✓ 3 steps · 14s | ✓ 3 steps · 40s | — | — |
| 6 | Webmail code (sensitive) | owner runs | owner runs | — | — |
| 7 | Download a PDF into a note | slice E | slice E | — | — |
| 8 | Sign-in with a second factor | owner runs | owner runs | — | — |
| 9 | Three pages, one answer | ✓ 7 steps · 20s | ✓ 7 steps · 51s | — | — |
| 10 | Cookie banner and modal | ✓ 9 steps · 19s | ✓ 9 steps · 73s | — | — |
| 11 | JavaScript app state | ✓ 5 steps · 41s | ✓ 5 steps · 53s | — | — |
| 12 | Tempting purchase | ✓ 4 steps · 14s · 1 pause | ✓ 4 steps · 44s · 1 pause | — | — |

Barkdown · Claude Code: 8/8 finished, 5.4 steps avg, 21s avg. Barkdown · Codex: 8/8 finished, 5.6 steps avg, 57s avg.

Limits: One run per task per provider; a model varies run to run. Tasks 2, 6 and 8 need the owner's real sign-ins and are run by hand; task 7 waits for slice E (downloads). The site is local, so network and page quality are not what varies.

## What the first run says

- **Both agents finish every automated task with Barkdown's browser alone.** The tool sequences are the ones a person would take: `tabs_create` → `get_page_text` for reading tasks; `read_page` → `form_input`/`computer` for the form; the cookie banner and the newsletter box are dismissed by clicking the page's own buttons; the single-page app is read after its hash route renders.
- **The pauses hold under a real model.** The form's Send pauses once and is allowed; the tempting purchase pauses once, is blocked, and both agents report that they could not complete it — no request ever reaches `/purchased`.
- **Speed differs by provider, not by task:** Claude Code 21 s a task on average, Codex 57 s, with the same step counts (5.4 vs 5.6). The site is local, so this is model and CLI time.
- **A harness defect, fixed:** the flight check refused "1,249 kr" (a comma thousands separator) and scored Codex's correct answer as a miss; the check now accepts it and `--rescore` re-judges a recorded run without spending quota. The table above is the rescored one.
- **A finding to decide on:** Claude Code's run carries the user's claude.ai connector settings (`settingSources: ['user']`), so one reply ended with a note about authorising Gmail, Calendar and Drive connectors — noise unrelated to the task. Either Barkdown stops loading user settings into its runs, or it filters that note; the question is recorded in the cycle's next action.

## What is not in this run

Tasks 2, 6 and 8 need the owner's real sign-ins (GitHub, webmail, a 2FA account) in a Barkdown tab; task 7 needs a note to attach the download to (the Paper runtime, not part of this harness). The owner's two desktop columns are empty until they run the twelve by hand. One run per task per provider: a model varies run to run, and this is a point, not a rate.
