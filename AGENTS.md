# Barkdown agent instructions

Read `docs/NEXT-AGENT.md`, `docs/PLAN.md`, `docs/DESIGN-DECISIONS.md`, and the current acceptance stage before changing behavior. Run `npm run plan` for the active queue. The user’s latest instructions take precedence. This is a private working Electron prototype; the original PRD and concepts are historical references, not the implementation backlog.

## Preserve the product model

- Barkdown stays app-wide. Working folders belong to agents in individual chats. Do not add an active-project selector to the global sidebar or make file navigation silently change an agent's folder.
- Documents are above recent chats. No dedicated Agents section, permanent ready/status row, or Follow toolbar.
- Chat is 60% of the working width by default. Browser-like work tabs occupy the right side and can contain documents, websites, reviews, project files, or side chats.
- Each chat remembers its own tabs, drafts, paths, and agent context. Direct document navigation opens without expanding a chat panel.
- Favorites bookmark individual destinations (D19a supersedes pins). Preserve side chats as full conversations, human-organized Pages and direct revision-checked agent edits with guarded Undo.
- Avoid visible scrollbar tracks and collapsed vertical pane rails. Preserve scrolling and keyboard reachability.
- Reuse Barkpark's real Paper editor and PortableDoc operations. The concept's `contenteditable`, textareas, timers, and simulated saves are not a production editor or runtime.

## Work from the right source

`app/` owns the current implementation. `docs/PLAN.md` and `docs/plan.json` own the delivery direction: profile isolation, one note engine, recovery/portability, optional sync, then ordinary installation. Concepts remain historical interaction references; never replace real behavior with their simulations. `docs/prd.source.html` generates `docs/PRD.md` and the HTML plan. Rebuild generated outputs with `npm run build`.

Types in `docs/contracts/workspace.ts` are proposals. Audit actual upstream APIs and runtime-validate persisted or remote data. Do not invent endpoint support, CRDT guarantees, or save acknowledgements.

Keep credentials and real content out of the handoff. Do not enable public hosting or change repository visibility without a new user instruction. Publishing updated code to this private repository is within this repository's intended workflow.

## Active delivery rules

- P1 profile isolation is accepted for the Windows source prototype (C039); P2 Paper migration is next. The blocked legacy CI issue is a separate release gate. Consult `docs/ACCEPTANCE.md` for measurable exits and `docs/VALIDATION.md` for actual evidence.
- Profile ownership is distinct from per-chat working folders. Capture profile identity in documents, tabs, drafts, favorites, caches and runs; switching must not rebind work or substitute same-slug content.
- Preserve source data and backups. Do not retire the legacy editor/store until migration comparison, interruption/resume and rollback are proven. Audit actual export/sync APIs; do not zip a live database and claim portability.
- Keep existing tests and editor matrix as regression gates. Closed issues and prior local passes do not establish a new stage’s completion or upstream merge readiness.
- Archive superseded plans rather than deleting evidence. `docs/archive/` and the old PRD are not executable instructions. Update the active queue, handoff and evidence together.

## Implementation workflow

Create a `codex/` branch for subsequent implementation work. Do not switch branches or alter unrelated files in the sibling Barkpark checkout. Do not run destructive cleanup commands; use recoverable trash if cleanup is necessary. No production deployment is part of this handoff.

Run `npm ci`, install Playwright Chromium, then `npm run verify`. Add production integration checks as real adapters are built; concept tests alone cannot prove production behavior. Keep CI and generated outputs consistent. Commit and push work, report exact validation and limitations, and update the handoff when a milestone changes status.

Do not install or copy the paid Tiptap Notion template by default. It is an interaction reference. Preserve upstream and dependency licenses when code is introduced.

## Delivery cycles

Repository hygiene is a delivery requirement. Keep `main` plus at most three active delivery branches per repository; temporary exceptions must name an owner, reason and next review in the current handoff. Reuse a suitable existing lane before creating another. Inventory local/remote branches, worktrees and related tasks at cycle closeout. Retire merged branches after checking remote tips and open PRs; preserve unique commits, dirty files and evidence before retiring anything else. Never confuse cherry-picked work with fully merged history. Do not interfere with another Barkpark contributor's checkout or open PR.

Keep one current plan, one current cycle and a concise current handoff. Replace superseded instructions instead of appending competing checkpoints. Completed tasks belong in historical evidence, not the active queue. Read archives only for a concrete evidence question. Remove dead code/docs only after checking references and retaining recoverable history. Every cycle must state remaining repository clutter and its next cleanup action; do not call a repository clean solely because `git status` is clean.

Follow `docs/CYCLES.md` and run `npm run cycle` before implementation. Plan one bounded outcome in `docs/cycle.json`; keep its linked handoff current after meaningful slices, failed checks, blockers and before yielding. Every cycle closes with a repository truth review, relevant tests and screenshot review. App-source changes retain the implementation-commit → screenshots → evidence-commit sequence. Never mark a cycle or stage done without evidence. Archive completed cycle records before starting the next one; interrupted work must name the exact next action and any uncommitted/untested state.

## Visual tripwires

Follow `docs/visual/RULES.md`. App/dependency/capture changes require `visual:capture`, `visual:compare`, actual agent/human image inspection and explicit `visual:approve`, plus behavior tests. Never auto-accept a visual baseline or remove old evidence to pass CI. Review intermediate frames, geometry, narrow layouts and the code-area README changelogs. Keep live Paper evidence distinct from deterministic fixture tours. Existing `shots` freshness rules still apply.
