# Working on Barkdown

Start with the [active plan](docs/PLAN.md), [agent instructions](AGENTS.md) and [accepted decisions](docs/DESIGN-DECISIONS.md). P1 is accepted; P2 moves ordinary notes onto the Paper engine. The [handoff](docs/NEXT-AGENT.md) identifies the relevant source files and first proof to build.

## Prepare the workspace

Use Node 22.13+ and a desktop session. Windows is the current local-runtime target. These installation commands are for initial setup or dependency repair; reuse healthy locked installs otherwise. Follow the [toolchain and integration preflight](docs/CYCLES.md#preflight-and-integration-first) before expensive checks.

```sh
npm ci
npx playwright install chromium
npm --prefix app ci
npm run plan
npm run desktop
```

The desktop runs with existing Claude Code/Codex logins or an API key configured in Settings. Paper editing requires a connected Barkpark. Managed local startup additionally requires a built Barkpark checkout and the Windows toolchain: [runtime setup](docs/LOCAL-BARKPARK.md). No production data or provider login is required for the default scripted regression suite.

## Choose a slice, keep its evidence

1. Pick the next unblocked stage with `npm run plan`, or follow the user's explicit scope. Read its acceptance scenarios before implementation.
2. Work on a `codex/` branch. Keep unrelated working changes intact. Use isolated user-data folders and owned runtimes for persistence tests.
3. Change the actual owner: desktop/profile behavior here; PortableDoc, schema, reader and shared editor contracts in Barkpark with upstream review and gates. Audit APIs instead of guessing them.
4. Run the checks relevant to the change and record results and limitations. Update the handoff and queue when stage status changes; do not infer completion from an issue count.
5. Commit and push the implementation and required generated evidence. A source branch is not a merged release.

## Choose the right check

| Command, from repository root | What it proves |
|---|---|
| `npm run verify` | Roadmap integrity, documentation links, types, generated sources, screenshot provenance and historical concept tests |
| `npm run test:desktop` | Builds the renderer, then runs desktop unit and Electron regression suites |
| `npm --prefix app run test:local` | Real isolated Windows database/runtime startup, recovery, Paper save and restart; requires the built checkout |
| `npm --prefix app run test:parity` | Live editor/server comparisons; requires a deliberately selected test Barkpark and CLI target |

Documentation-only changes do not require a live provider run. Mocked orchestration is not proof of real storage, cloud sync or cross-machine portability. Keep failing cases visible with their tested baseline.

For changes under `app/main`, `app/renderer` or `app/shared`: commit the code, run `npm --prefix app run shots`, then commit the updated screenshots, manifest and README links. Do not alter old screenshots to imply a new capability; the gallery shows the actual app. Edit `docs/prd.source.html` rather than generated `docs/PRD.md`/`preview/prd.html`, then run `npm run build`.

## Preserve the product and the data

Profiles own library/account data; working folders belong to individual chats. Switching views must not rebind runs. People organize Pages. Side chats are full saved conversations. Direct agent document edits retain revision checks, human takeover and guarded Undo.

Migration needs a recoverable source, stable identity mapping, comparison and interruption/rollback proof before the old editor/store is retired. Never silently switch the CLI server, stop shared services, kill unrelated processes, commit credentials, change repository visibility or deploy production as part of routine work.

Original material remains private; preserve [third-party notices](THIRD-PARTY.md). Historical plans remain in [the archive](docs/archive/README.md), not the active queue.

## Work in delivery cycles

Follow [the cycle protocol](docs/CYCLES.md), the single workflow reference for outcome budgets, proportionate validation, concise handoffs and repository truth. Run `npm run cycle` to find the current bounded goal, acceptance and handoff. Checkpoint during work and before yielding; close with tests, a repository truth pass and screenshot review. Root verification checks cycle structure, but cannot certify prose or replace real integration proof.

## Review what the code looks like

Use the [visual health pages](docs/visual/README.md) and [capture/review rules](docs/visual/RULES.md). Run `npm run visual:capture`, `npm run visual:compare`, inspect the actual report images, then explicitly approve. `npm run check:visual` rejects stale source fingerprints or altered evidence. New visible journeys require corresponding motion evidence and behavior checks; CI never blesses differences automatically.
