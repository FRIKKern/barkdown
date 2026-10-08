# Barkdown

Barkdown is an experiment in what Barkpark can do, and a tool for figuring out what Barkpark should become.

Weâ€™re building a notes-and-agents app inspired by T3 Chat, Notion and ChatGPT, taking the parts we love from each. Weâ€™re doing this for fun and learning, with no plans to make money from it. The aim is an excellent app shaped by our taste and Barkpark.

## Where we are Â· October 8, 2026

**Windows is back on the current source.** The Mac work through C096 is synchronized, and [C097](docs/cycles/evidence/C097/README.md) now proves the disposable-profile journey on Windows: switch to Paper, edit, restart, roll back, resume after a forced exit, and export/import between two installations.

- **Usable from source:** isolated profiles, real Paper notes, guarded agent Undo, work tabs, browser tools and a PowerShell terminal. Windows fixes cover installed provider discovery, browser import, narrow Settings, runtime child cleanup and [honest catalog command failures](docs/cycles/evidence/C097/catalog-control-review.md).
- **Mac delivery:** packaged nightlies carry the runtime and use installed agent tools. The [release guide](docs/RELEASE.md) records signing and updater limits.
- **Still open:** a real library, actual Mac-to-Windows transfer, optional sync, and clean Windows installation. No Mac export is available on this machine. [Private Paper capture30](docs/cycles/evidence/C097/review-export-count.json) completed one real Claude Code read/edit turn; broader provider continuity and Codex success remain unverified.
- **Next:** [PR75](https://github.com/FRIKKern/barkdown/pull/75) is merged. Windows installation comes first, then remaining data safety. The [fresh Windows app directory](docs/cycles/evidence/C098/reader-package-review.md) carries its runtime and reader, with save/search/restart/crash recovery proof and reviewed visuals. [Font/player attribution](docs/cycles/evidence/C098/font-player-review.md) now matches pinned bytes. GitHub currently blocks hosted checks before startup for account billing; the earlier launcher timeout also remains open. Complete notices, runtime prerequisites and clean install/update/uninstall are next. [Current handoff](docs/NEXT-AGENT.md).

**Migration estimate, reviewed October 8:** about 75% by estimated effort for the six migration checkpoints, plausible range 30â€“90%, low confidence. Windows proof now includes killed transaction and upload recovery, including refusal to reopen an unreconciled orphan; real-library and broader media/writer risks keep the conservative weights unchanged. This is not a whole-project completion percentage or an acceptance score. [Basis and scenarios](docs/PLAN.md#migration-effort-estimate).

The [carried Windows runtime](docs/cycles/evidence/C098/engineering-acceptance-review.md) runs the bounded Paper/reader journey, and the [packaged terminal repair](docs/cycles/evidence/C098/terminal-package-review.md) proves the absolute PowerShell fallback, restart and normal quit. Full Windows Desktop and repository checks pass locally; PR76 awaits merge authorization. [VC prerequisite preparation](docs/cycles/evidence/C098/crt-symbol-review.md) accounts for all 1553 current static imports from the three missing DLLs. [Compiler records](docs/cycles/evidence/C098/crt-compiler-review.md) now match four exact carried files; full runtime compatibility remains open. [ICU notice binding](docs/cycles/evidence/C098/icu-binding-review.md) reduces the PostgreSQL file-attribution gaps to four. [Publisher notice binding](docs/cycles/evidence/C098/winpthreads-binding-review.md) now preserves nine additional original texts while keeping the source revision gap explicit. The [runtime notice audit](docs/cycles/evidence/C098/reader-binding-review.md) now retains nineteen reader originals alongside all previous notices, with remaining coverage gaps explicit. Complete notices, prerequisite deployment and clean installation are still required. [Reader build repair](docs/cycles/evidence/C098/reader-vcs-repair-review.md) makes future WASM builds identical across different parent Git revisions; the existing tested package is unchanged.

[Current work](docs/NEXT-AGENT.md) Â· [Plan](docs/PLAN.md) Â· [Verified results](docs/VALIDATION.md) Â· [Screenshots & recordings](docs/visual/README.md)

[![Barkdown roadmap: profiles accepted, Paper migration in progress, recovery and portability rehearsed on Mac and Windows, optional sync and installation, and the agent's browser now building.](docs/images/roadmap.svg)](docs/ROADMAP.md)

![A working notebook with a checklist, table and callout: an agent rewrites the opening, Undo restores it, and a person checks a task, edits a cell and finds a note.](docs/visual/agent-notes/runs/2026-09-24T23-33-22-364Z-notebook/readme-notebook.gif)

A notebook in motion: write together, check things off, find your next idea. Real app, scripted agent responses; this earlier note-editing demo remains applicable. The current still uses a live private Paper server; its [manifest](docs/images/status/manifest.json) identifies whether the conversation is real or a sample. [Recording details](docs/visual/agent-notes/README.md#readme-demo).

<details>
<summary>Still view</summary>

![Barkdown: a conversation beside a Paper document in dark mode.](docs/images/status/paper-dark.9df70848.png)

</details>

The Barkpark capabilities weâ€™re exploring:

- Authentication
- Local/remote sync, with offline-first use
- Media
- Multiplayer, sharing and access
- Document and spreadsheet editors

## Run it

Source prototype on macOS and Windows. Node 22.13+ and a desktop session:

```sh
npm ci
npm --prefix app ci
(cd app && npx install-electron --no)   # Electron 42+ fetches its binary on demand
npm run desktop
```

Use your Claude Code or Codex login, or an API key in Settings. Paper needs a connected Barkpark; [local setup](docs/LOCAL-BARKPARK.md) requires a built checkout.

Or install the macOS disk image instead: the [latest nightly release](https://github.com/FRIKKern/barkdown/releases) carries `Barkdown-<version>-arm64.dmg` (175 MB) with the server, Erlang and Postgres inside, `SHA256SUMS`, and the test receipts it was cut with; `node scripts/build-mac-app.mjs --dmg` builds the same image here. It is signed ad hoc, so open it with right-click â€º Open; [what is proven and what is not](docs/cycles/C086-packaged-runtime.md), [how releases are cut](docs/RELEASE.md).

[Contributing](CONTRIBUTING.md) Â· [Agent instructions](AGENTS.md) Â· [Docs](docs/README.md) Â· [Capture source](docs/images/status/manifest.json) Â· [Third-party notices](THIRD-PARTY.md)

## Dreams for Barkdown

We believe agent chat apps are settling into a standard that's hard to beat. A navigation sidebar, chat and browser give each part of the work a place.

The sidebar should use a conventional file tree, like File Explorer or Finder. Organize documents, spreadsheets, media and custom Barkpark document types into folders. Share a file, a folder or an entire workspace. Sync it to a private or public cloud, choose who has access, and revoke access when needed.

People should also be able to chat and collaborate with each other. Groups can invite agents into the conversation and work in the same browser window. Share your session, join someone else's, or connect to a session on a remote server.

The browser should give us a clear view of what an agent is working on. We should see the documents, files and pages it uses, understand what it intends to do, and follow changes as they happen. We believe this view into the agent's work will become a central part of how people use AI.

Connections should be as direct and secure as possible, without unnecessary middlemen or middleware.

AI and collaboration should remain optional. Barkdown should also be worth using simply for notes and browsing, fully offline. We also want it to offer an elegant, efficient way to host your app or website.
