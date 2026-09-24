[![Barkdown roadmap: accepted profile isolation, current Paper migration, then recovery, optional sync and installation.](docs/images/roadmap.svg)](docs/PLAN.md)

# Barkdown

Notes and agents, side by side. Built on Barkpark’s Paper editor.

![Barkdown: a conversation beside a Paper document in dark mode.](docs/images/status/paper-dark.071fcd37.png)

Your Pages, your order. Full side chats. A working folder for each conversation.

[See it in action](docs/visual/paper-notes/README.md) · [Screenshots & recordings](docs/visual/README.md) · [Capture source](docs/images/status/manifest.json)

## Right now

Windows source prototype. Profile isolation works; moving every note to Paper is underway. Recovery, portability, optional sync and an installer follow.

[Current work](docs/NEXT-AGENT.md) · [Plan](docs/PLAN.md) · [What’s verified](docs/VALIDATION.md)

## Run it

Node 22.13+ and a desktop session:

```sh
npm ci
npm --prefix app ci
npm run desktop
```

Use your Claude Code or Codex login, or an API key in Settings. Paper needs a connected Barkpark; [local setup](docs/LOCAL-BARKPARK.md) requires a built checkout.

## Build with us

[Contributing](CONTRIBUTING.md) · [Agent instructions](AGENTS.md) · [App](app/README.md) · [Docs](docs/README.md)

The roadmap follows the plan and current cycle; `npm run build` refreshes it. Dates arrive when we have them.

Private development repository. [Third-party notices](THIRD-PARTY.md).
