---
name: plan-followup
description: Follow up the Barkdown editor plan — pick the next open issue from docs/PLAN.md, work it Barkpark-first (schema, render, contract, canvas) then as a red-first live row in Barkdown against the local Barkpark, commit and push both repos, close the issue with the run's numbers. Use this whenever the user says to continue, get going, do the next task, work the plan, pick up where we left off, or names an issue number or a parity row (tables, opaque set, highlight, images, IME, profiles, sync) — even if they don't mention the plan by name.
---

# Plan follow-up

The plan is [docs/PLAN.md](../../../docs/PLAN.md): an ordered sequence, one GitHub issue per task on `FRIKKern/barkdown`, grouped into milestones. The standing goal it serves is [docs/EDITOR-PARITY.md](../../../docs/EDITOR-PARITY.md) (the Barkpark canvas becomes as good as Tiptap, then replaces Barkdown's Tiptap tab) and the sizing is [docs/TIPTAP-REVIEW.md](../../../docs/TIPTAP-REVIEW.md). Read those three once per session; they are short and they are the contract.

## 1. Find the next task

Run `node .claude/skills/plan-followup/scripts/next.mjs`. It prints the open issues in plan order with their milestone and estimate, then checks the environment (local Barkpark answering on `:4000`, `bp` pointed at `local`, both trees clean and tracking their remotes). Take the lowest open sequence number unless the user named one. If the environment check fails, fix that first (section 4) — a row cannot go green against a server that is not there.

Read the issue with `gh issue view <n>`. Its **Acceptance** line names the live row or test that ends the task; everything else is in service of that line.

## 2. Work it in the order that keeps the truth in one place

Barkpark is the single source of editor truth; Barkdown consumes it. So a task that adds or changes a block, mark or attribute goes:

1. **Barkpark first**, in the sibling checkout `../barkpark-editor` on branch `barkdown/editor-quality`: the PortableDoc schema (`api/lib/barkpark/portable_doc/`), the reader render (view and edit are one producer — doctrine rule 3), the ops contract (`docs/contracts/`), and a unit test in `api/assets/paper-editor/src` (mounted tests use the jsdom harness in `canvas/__flush_pending.test.mjs`; mirror it).
2. **Then the canvas** (`api/assets/paper-editor/src/canvas/`). Where Tiptap ships an open-source extension for the thing (highlight, find-and-replace, emoji, sub/superscript, text-align, file-handler…) load it rather than writing it — the canvas *is* Tiptap. Rebuild with `npm run build` in `api/assets/paper-editor`; until issue #2 lands, copy `api/priv/static/assets/bp-paper-editor.bundle.js` and `.css` into `app/renderer/vendor/`.
3. **Then the Barkdown row**: a live test in `app/tests/editor-<topic>.live.mjs`, written red first, modelled on `editor-tables.live.mjs` and `editor-multiblock.live.mjs`. A row is green only when the canvas does the thing **and the server holds the same result** — compare both after the tab says "Saved", and re-read the server 3 s later on a mismatch so the evidence says "late" or "lost". Green three consecutive runs before calling it done; the ops pipeline has had races.

Why the order: a canvas change without its server half looks green in the editor and silently diverges on the server, which is the exact failure the matrix exists to catch. And a Barkdown-only fix to a Barkpark problem drifts the moment the bundle is rebuilt.

Some things worth knowing before they cost an hour:

- Select spanning ranges through ProseMirror (`setTextSelection({from, to})` inside `page.evaluate`) rather than Shift+Arrow; keyboard selection extension is unreliable in a headless Electron window and produced false reds twice.
- A current Barkpark runs a publish wall on new papers: register `tag` documents and publish with a `description` and weighted `tags`, as the two green suites do. Pipe stdin to `bp` only when there is input (`stdio: ['ignore','pipe','pipe']` otherwise) or it errors with "piped stdin is unused".
- Barkpark vetoes any write that would leave a published paper with no content block. That is policy; the row should expect the tab to say so and the next edit to save.
- Barkpark's unit sweep has two failures that predate this work (`__save_ack_mounted`, `__press_answer_watchdog`). Verify a new failure against the stashed tree before chasing it.

## 3. Finish

1. Update the row in `docs/EDITOR-PARITY.md`: the score, what was fixed where, anything intermittent with its evidence. Add a row when the task reveals a behaviour the Tiptap tab has that the matrix lacks; never remove a row to make it greener.
2. If the task changed anything an author sees, commit that change, then `cd app && npm run shots` and commit the pictures with their manifest: `npm run check` at the root refuses a README whose status screenshots are older than the last commit to `app/renderer`, `app/main` or `app/shared` (the script needs the local Barkpark, `bp use local`, and a provider login for the assistant turn; it falls back to Codex, then to a seeded transcript it flags in the manifest).
3. Commit Barkpark first (`git -C ../barkpark-editor`), push `barkdown/editor-quality`; note the commit hash. Then commit Barkdown (test, vendored bundle, docs, `app/README.md`'s vendoring note with the new hash), push `codex/electron-prototype`. Messages in the repo's voice: a first line that says what changed for the author, then why, then the numbers (`8/11 -> 11/11, three runs`). End with the attribution line the session reminder gives.
4. Close the issue: `gh issue close <n> --comment "<row> <score>, <runs> runs; Barkpark <hash>, Barkdown <hash>"`.
5. Tell the user in a few lines: what went green, what was found, what is next in the sequence. Flag anything that needs them — a Barkpark PR to merge, a decision (heading levels, quote block), a switch of `bp` back to cloud.

## 3b. Landing a Barkpark PR

Barkpark's `main` is protected by four required checks — **Elixir gate, PR references an active task, Cloud gate, Console gate** — and nothing else; the security gates are red on `main` itself and are not required, so do not chase them. The task gate wants exactly one `Task: <doc_id>` line at column 0 of the PR body, naming a task on the **Guerrilla ledger** (`https://guerrilla.barkpark.cloud`) that someone has *claimed*. Use the script, which walks the traps in order and stops at the one it cannot clear:

```sh
node .claude/skills/plan-followup/scripts/barkpark-pr.mjs create --pr <n> \
  --task-title "…" --task-description "…" \
  --tags js-correctness:90:"why",robustness:60:"why" \
  --criterion "<measurable>" --criterion "MERGE-GATED: PR merged to main"
node .claude/skills/plan-followup/scripts/barkpark-pr.mjs status --pr <n>
```

What it knows so you don't have to: bp's Guerrilla entry can carry a token with `auth_tier: "none"` (every task write then says "caller is not a member of this workspace") and the cure is re-minting it from the cloud session with the interactive picker fed on stdin — which still needs the user's `bp login` if the cloud session is gone; a task publishes only with a real description and 1–12 *registered* weighted tags with distinct strengths; a claim needs a worker id and refuses a row without acceptance criteria; `gh pr edit` fails on this repo (classic-projects deprecation) so body edits go through `gh api -X PATCH`. First merge main into the branch and rebuild the bundle (`npm run build` in `api/assets/paper-editor`; CI checks bundle freshness), and remember `__save_ack_mounted` is flaky on Windows — CI is its judge.

## 4. Environment

- Local Barkpark: `powershell -File ../barkpark/scripts/setup-windows.ps1 status` (Postgres on `:5432`, Phoenix on `:4000`, seed `demo`, token `barkpark-dev-token`). If it is down, start Postgres with `pg_ctl` from the Scoop install and Phoenix with `mix phx.server` in `../barkpark/api` — inside a Visual Studio `vcvars64` environment, because `argon2_elixir` needs `nmake`. If migrations hang or Phoenix stops answering, look for `error 487` (and a worker "terminated by exception 0xC0000142") in the cluster's `pg.log`: Postgres on Windows failing to spawn backends, worst under load (do not run `mix test`, the unit sweep and the live rows at once). A wedged postmaster ignores `pg_ctl stop`, so kill every `postgres.exe` by PID, delete `data/postmaster.pid`, and `pg_ctl start` with a *new* log file name (the old one stays locked); recovery replays the WAL and Phoenix reconnects on its own.
- **The server the live rows hit must be the editor branch** when the task touched the server side (schema, reader, BPML): `../barkpark` (main) is what `setup-windows.ps1` runs, and its Phoenix will not know a new inline type. Run the editor worktree instead: it shares deps through a junction (`mklink /J ..arkpark-editorapideps ..arkparkapideps`; `mix.lock` is identical) and starts from a copy of `../barkpark/api/_build` (`robocopy /E`; the app recompiles once, deps do not). A second wrapper, `bp-mix-editor.cmd`, is the same `vcvars64` wrapper with `cd /d …arkpark-editorapi`; `MIX_ENV=test <wrapper> test <files>` runs the targeted ExUnit files there in seconds (the whole `mix test` is CI's job). Stop the main-checkout Phoenix first (free `:4000`), then `PORT=4000 <wrapper> phx.server`.
- Phoenix boot is when Postgres wedges most (the pool's ten backends spawn at once; the cluster logs `0xC0000142` then `error 487` and the app dies "killed"). Recover the cluster (Stop-Process each `postgres` by id, delete `postmaster.pid` with `[IO.File]::Delete` — `Remove-Item` is blocked in the sandbox — `pg_ctl start` with a NEW log filename) and start Phoenix again; once it is up it stays up through the rows.
- The publish wall's dedup gate scores **title + tag-name tokens** (Jaccard ≥ 0.55 with ≥ 3 shared refuses). A fixture titled "X probe" with tags `barkdown`+`scratch` shares three tokens with the tables probe and needs at least two title words of its own ("Highlight mark round trip" passes; "Highlight probe" does not). The body is not scored.
- `bp use local` for the live suites (they use `viaCli`); `bp use gyldendal-2` returns the CLI to cloud — say so when you leave it on `local`.
- The `gh` account must be `FRIKKern` (the repos' owner); `gh auth switch --user FRIKKern` if `gh` or `git push` reports "repository not found".
- Keep green while you work: `cd app && npm run test:tables && npm run test:multiblock`.
