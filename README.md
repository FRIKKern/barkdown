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

## Dreams for Barkdown

We believe agent chat apps are settling into a standard that’s hard to beat: a left sidebar, a chat and a browser.

**The chat and shared browser together are the heart of the app.** People and agents can talk while working with the same websites, documents, files and tools. We can discuss an idea, try it out and see the result together, with the conversation right beside the work.

We want to see each other at work: cursors moving, text being selected, an idea taking shape. Those movements should help us read each other’s intentions and bring clarity and joy to working together.

Chat should bring people together, much like Slack—with humans, agents, or both in the same conversation. Share your own session, join someone else’s, or jump into a chat running on a remote server.

We want those connections to be as direct and secure as possible, without unnecessary middlemen or middleware.

How far can we go? What are the dangers ahead? Where will we land?
