# C091 — No approvals by default, and one chip for the assistant

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
- A chip under the composer shows the state ("No approvals" with a check, or "Asks first" with a lock) and switches it. It is drawn like the chips beside it: no approvals is the chosen default, not a warning (the first version used the warning colour and a triangle, and the owner had it changed). Turning approvals off answers the cards already waiting, in every chat.
- Settings › Assistant has the same choice.

**What did not change.** The browser's pauses on purchases, messages, passwords, deletions and account changes (D-browser-pauses) are a separate layer with their own setting in Settings › Browser. Codex keeps its own sandbox and approval policy; it never showed these cards. Goal workers still cannot start workers, and a run still may not launch another browser.

**What "no approvals" allows that asking did not.** With Claude Code: file writes and edits, shell commands, writes outside the chat's working folder, and any connected tool (the owner's screenshot was a Claude Docs update), all without a card.

## One chip for provider, model and effort

The owner's second ask the same afternoon: "Vendor + Model + Effort should only be one item on the chat bar, just let us select the model and the effort straight forward."

```
 before:  [✦ Claude Code] [▣ claude-opus-5-5 (default)] [◔ High (default)]     three chips, three menus
 after:   [✦ Opus 5.5 · High]                                                   one chip, one menu:

            ┌ Claude Code | Codex | API key ┐   provider; picking one redraws the menu in place
            │ MODEL                         │   that provider's models; picking one closes the menu
            │ ✓ Opus 5.5 (default) …        │
            │   Other model id…             │
            │ EFFORT                        │   pills; picking one closes the menu
            │ (Default) (Low) (Medium) …    │
            └ Sign-in help for Claude Code ─┘
```

- The chip names the model and the effort in force, defaults included, without the word "default"; its tooltip says which are defaults. When the provider is not signed in it says so, in the warning colour.
- Changing the provider resets the chat's model to that provider's default (it used to keep a model id from the other provider) and drops an effort level the new provider does not have.
- The model list gained Opus 5.5 and Sonnet 5.5; a Claude id the list does not know reads as a name (`claude-opus-5-5` was shown raw).
- Found on the way: several buttons used icon names the app does not carry and showed a fallback page icon. They use existing icons now.

## Evidence

- `app/tests/approval-policy.test.mjs`: without a policy the person is asked; a policy that skips approves with no card and is asked each time; a policy that fails asks.
- Probe in the real app (2026-10-04): default → approved, zero cards; chip clicked → waits, one card; clicked again → approved, zero cards. Settings › Assistant shows the row.
- Journey 76/76, including the single chip: a model and an effort chosen from the one menu, the provider switch keeping the menu open, the custom model dialog. The side-chat and sign-in tours pass with the cloned composer's chip.

## Limits

- No tour drives a real provider run through a tool call in each state; the proof is at the door all approvals pass, in the real app's main process.
- The default changes behaviour for every existing profile on its next launch.

## Task board

`task-87af991e7d957c39` (approvals) and its child for the single chip; worker `claude-barkdown-c091`.
