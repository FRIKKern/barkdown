[![Barkdown roadmap: accepted profile isolation, current Paper migration, then recovery, optional sync and installation.](docs/images/roadmap.svg)](docs/PLAN.md)

# Barkdown

Barkdown is an experiment in what Barkpark can do, and a tool for figuring out what Barkpark should become.

We’re building a notes-and-agents app inspired by T3 Chat, Notion and ChatGPT, taking the parts we love from each. We’re doing this for fun and learning, with no plans to make money from it. The aim is an excellent app shaped by our taste and Barkpark.

The Barkpark capabilities we’re exploring:

- Authentication
- Local/remote sync, with offline-first use
- Media
- Multiplayer, sharing and access
- Document and spreadsheet editors

![Barkdown: a conversation beside a Paper document in dark mode.](docs/images/status/paper-dark.071fcd37.png)

## What we’re working on

One dependable Paper note engine. [Human note creation, editing, search and restart work](docs/visual/paper-notes/README.md); next is bringing agents through that same path with safe Undo. Migration, recovery and portability follow. Sync, multiplayer and spreadsheets are part of the wider exploration, not completed app features.

[Current work](docs/NEXT-AGENT.md) · [Plan](docs/PLAN.md) · [Verified results](docs/VALIDATION.md) · [Screenshots & recordings](docs/visual/README.md)

## Run it

Windows source prototype. Node 22.13+ and a desktop session:

```sh
npm ci
npm --prefix app ci
npm run desktop
```

Use your Claude Code or Codex login, or an API key in Settings. Paper needs a connected Barkpark; [local setup](docs/LOCAL-BARKPARK.md) requires a built checkout.

[Contributing](CONTRIBUTING.md) · [Agent instructions](AGENTS.md) · [Docs](docs/README.md) · [Capture source](docs/images/status/manifest.json) · [Third-party notices](THIRD-PARTY.md)
