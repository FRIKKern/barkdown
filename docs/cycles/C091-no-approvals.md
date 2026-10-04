# C091 — No approvals by default

**Why.** The owner, testing the app on 2026-10-04: the approval card interrupted every tool call ("getting spammed with this approval thing"). The ask: skip permissions by default, with a toggle to turn asking back on.

```
 Claude Code canUseTool ─┐
 API loop write_file ────┼─► requestApproval (main/providers/runs.js) ─► policy: settings.approvals
 goal worker (relayed) ──┘                                                 none (default) → approved, no card
                                                                           ask            → the card, as before
```

**What changed.**

- `approvals` is an app setting: `none` (the default, also for existing profiles that never set it) or `ask`.
- The main process hands the run registry a policy that is asked on every request, so switching it takes effect in a run already in flight. A process without a policy (the goal worker) emits the request and the main process decides. If the settings cannot be read, the assistant asks.
- A chip under the composer shows the state ("No approvals" in the warning colour, or "Asks first") and switches it. Turning approvals off answers the cards already waiting, in every chat.
- Settings › Assistant has the same choice.

**What did not change.** The browser's pauses on purchases, messages, passwords, deletions and account changes (D-browser-pauses) are a separate layer with their own setting in Settings › Browser. Codex keeps its own sandbox and approval policy; it never showed these cards. Goal workers still cannot start workers, and a run still may not launch another browser.

**What "no approvals" allows that asking did not.** With Claude Code: file writes and edits, shell commands, writes outside the chat's working folder, and any connected tool (the owner's screenshot was a Claude Docs update), all without a card.

## Evidence

- `app/tests/approval-policy.test.mjs`: without a policy the person is asked; a policy that skips approves with no card and is asked each time; a policy that fails asks.
- Probe in the real app (2026-10-04): default → approved, zero cards; chip clicked → waits, one card; clicked again → approved, zero cards. Settings › Assistant shows the row.
- Journey 76/76.

## Limits

- No tour drives a real provider run through a tool call in each state; the proof is at the door all approvals pass, in the real app's main process.
- The default changes behaviour for every existing profile on its next launch.

## Task board

`task-87af991e7d957c39`, worker `claude-barkdown-c091`.
