# C096 — The switch carries Paper notes already open

**Why.** Found in C095: the Paper switch refused a workspace that held a note made on the local runtime before the switch. Such a note's id is `drafts.<id>`, and `identity()` in `app/main/migration-workspace.js` accepted only `[\w-]`. Any profile with a Paper note in a tab, in Favorites or in Pages could not switch ("[comparison_workspace] Invalid destination identity"). The owner chose to fix it next (2026-10-05).

**The fix.** A Paper destination (a `barkpark`-source tab path, a `barkpark` favorite, a `bp:` or `bp:v1:<owner>:` Page key) accepts `drafts.<id>`, the form `migration-comparison.js` already accepts. Local note ids and conversation ids stay strict, and other dotted ids are still refused.

## Evidence

| What | Result | Where |
|---|---|---|
| Projection unit tests: drafts ids pass in tabs, favorites and both Page key forms; dotted local ids and other dotted ids still refused | 42 pass (5 new) | `app/tests/migration-workspace.test.mjs` |
| All migration unit tests | 173 pass | `node --test app/tests/migration-*.test.mjs` |
| Real app: a Paper note open in a tab, in Pages and in Favorites; `paper switch`; a person's restart; the note still open and readable | 3 checks pass; the same tour without the fix fails at the switch | `evidence/C096/live/` |

## Limits

- `migration-switch-ui.live.mjs` (the Settings path with legacy notes) needs a dev-built Barkpark checkout, which this Mac does not have; not run. The control tours and the new tour run the packaged runtime.
- Proven on this Mac from source; not Windows, not the packaged app.

## Task board

`task-40bc35d902c777e8` on Guerrilla, worker `claude-barkdown-c096`.

## Next

Delivered in [v0.6.0-nightly.20261005.2](https://github.com/FRIKKern/barkdown/releases/tag/v0.6.0-nightly.20261005.2), chain green on `de9d9418`. Next is the owner's call: `barkdown` on the system path, Windows, or C089's owner items.
