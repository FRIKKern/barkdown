# Barkdown

Barkdown is an experiment in what Barkpark can do, and a tool for figuring out what Barkpark should become.

We’re building a notes-and-agents app inspired by T3 Chat, Notion and ChatGPT, taking the parts we love from each. We’re doing this for fun and learning, with no plans to make money from it. The aim is an excellent app shaped by our taste and Barkpark.

## Where we are · September 26, 2026

**Migration effort estimate: about 45% · plausible scenarios 15–75% · very low confidence.** This first provisional estimate weights demonstrated work against expected work left; it is not a safety rating or a whole-project percentage. The wide range comes mainly from unproven writer coverage and recovery. [Estimates, calculation and next calibration](docs/PLAN.md#migration-effort-estimate).

**Working today:** the source prototype supports [writing, searching and restarting](docs/visual/paper-notes/README.md), [agent edits with Undo](docs/visual/agent-notes/README.md), and [deleted-note recovery](docs/visual/paper-deletions/README.md). We’re working toward one dependable Paper note engine; existing libraries have not switched yet.

**Recent progress:** we proved a read-only library comparison, improved navigation ownership, and tested the controller intended to keep writes out during migration. That controller is not integrated. Its merge awaits a deployment decision; see the [six migration checkpoints](docs/ROADMAP.md#inside-migration).

**Next result:** demonstrate that real note and media writes cannot slip through while a library is switching. Safe switching, restart and rollback still need proof before retiring the old editor.

**Why timing is uncertain:** a tested controller does not yet prove coverage of every writer. Best plausible path: existing writers fit the controller and recovery checks pass. Adverse path: a bypass or recovery gap requires changes across the app and server, followed by another full rehearsal. We cannot responsibly bound completion time until that integration is exercised; the deployment decision is separate waiting time.

We report delivered results and reduced uncertainty, not equal-sized checkboxes. Small steps can finish quickly while one safety boundary takes several iterations. This overview changes when the evidence, obstacle or outlook changes; details stay in the linked records. Recovery and portability follow migration; sync and installation remain later work.

[Current work](docs/NEXT-AGENT.md) · [Plan](docs/PLAN.md) · [Verified results](docs/VALIDATION.md) · [Screenshots & recordings](docs/visual/README.md)

[![Barkdown roadmap: accepted profile isolation, current Paper migration, then recovery, optional sync and installation.](docs/images/roadmap.svg)](docs/ROADMAP.md)

![A working notebook with a checklist, table and callout: an agent rewrites the opening, Undo restores it, and a person checks a task, edits a cell and finds a note.](docs/visual/agent-notes/runs/2026-09-24T23-33-22-364Z-notebook/readme-notebook.gif)

A notebook in motion: write together, check things off, find your next idea. Real app, scripted agent responses. [Recording details](docs/visual/agent-notes/README.md#readme-demo).

<details>
<summary>Still view</summary>

![Barkdown: a conversation beside a Paper document in dark mode.](docs/images/status/paper-dark.6cd89f08.png)

</details>

The Barkpark capabilities we’re exploring:

- Authentication
- Local/remote sync, with offline-first use
- Media
- Multiplayer, sharing and access
- Document and spreadsheet editors

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

We believe agent chat apps are settling into a standard that's hard to beat. A navigation sidebar, chat and browser give each part of the work a place.

The sidebar should use a conventional file tree, like File Explorer or Finder. Organize documents, spreadsheets, media and custom Barkpark document types into folders. Share a file, a folder or an entire workspace. Sync it to a private or public cloud, choose who has access, and revoke access when needed.

People should also be able to chat and collaborate with each other. Groups can invite agents into the conversation and work in the same browser window. Share your session, join someone else's, or connect to a session on a remote server.

The browser should give us a clear view of what an agent is working on. We should see the documents, files and pages it uses, understand what it intends to do, and follow changes as they happen. We believe this view into the agent's work will become a central part of how people use AI.

Connections should be as direct and secure as possible, without unnecessary middlemen or middleware.

AI and collaboration should remain optional. Barkdown should also be worth using simply for notes and browsing, fully offline. We also want it to offer an elegant, efficient way to host your app or website.
