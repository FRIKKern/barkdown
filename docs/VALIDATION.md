# Handoff validation

This records verification of the **concept and delivery package**. No desktop runtime, provider, live filesystem adapter, or connected Barkpark mutation is exercised by these tests.

## Local environment and commands

- Windows host; Node `22.13.1`; npm `11.5.2`.
- Locked Playwright `1.62.1` with its installed Chromium, rather than a machine-specific Edge requirement.
- Exact dependencies in `package-lock.json`; installation reported zero known vulnerabilities at handoff.
- `npm run verify` builds the portable pages, checks the design types and document links, then runs the five browser-check files.
- GitHub Actions repeats verification on Ubuntu with Node 22 and Playwright Chromium. Its result belongs to the actual repository commit; local results are not a claim that remote CI already passed.

## Checks

| Suite | Evidence |
|---|---|
| Source and handoff checks | Proposed TypeScript contracts compile; both fragments parse; 24 requirements / 19 P0; local documentation links resolve; immutable source paths exist; artifact hashes match. |
| `check-worktabs.cjs` | Tab types, side-chat drafts/replies, manual editing, document paths, per-chat restoration, direct document mode, pins, URL validation, review marker, focus pause, deliberate tab closure, background draft preservation, narrow return to chat. |
| `check-project-editor.cjs` | App-wide sidebar; no global folder title/picker; composer-attached folder menu; project editor, file drafts, demo save, folder chat, inherited side-chat context, composer drafts, pin restoration, 60% return, run ownership, exact file activity. |
| `check-upgrades.cjs` | Adjustable split (drag, keyboard clamp, reset), quick open across tabs/documents/chats, Alt shortcuts, Enter and Shift+Enter in the composer, middle-click close, working indicator lifecycle, unsaved project marker. |
| `check-editor-study.cjs` | Direct document edit, selected text, attached Types menu, menu within viewport, actual type change preserving text, Escape, edits surviving document navigation. |
| `check-prd.cjs` | Four embedded images load, internal anchors exist, image/graph zoom, Escape, 24 requirements and priority filters, pane modes, phase accordions, narrow layout, print-to-PDF. |
| `check-previews.cjs` | All three committed standalone pages load and primary interactions work with zero runtime errors and zero HTTP(S) requests. |

Current shell and project editor checks cover widths 1024, 736, 390, and 320px without page overflow. The HTML plan is checked at desktop and 390px. These are not a complete accessibility or every-device certification.

Raw local outputs and screenshots are generated into ignored `test-results/`. A concise handoff result is committed in [validation.json](../evidence/validation.json). [artifact-manifest.json](../evidence/artifact-manifest.json) ties the generated delivery to its source bytes.

## Desktop prototype checks (`app/`)

- `cd app && npm test` runs `tests/agent.test.mjs` (agent loop with a scripted Claude client: pending proposals, approval-gated writes, path confinement, cancellation, offline fallback, markdown round trip) and `tests/run.mjs` (Playwright driving the real Electron window against a throwaway userData folder and git repository: seeded library, offline run opening tabs, autosave with revisions, slash commands and the attached Types menu, direct document mode and linked paths, quick open, working folder, expanded project editor, file save to disk, review diff, webview, pins, per-chat workspaces, persistence across reload, no renderer errors). Screenshots land in `app/test-results/`.
- Verified on the Windows host with Electron 38.8.6 and Playwright 1.62.1. `tests/mcp.test.mjs` drives the document MCP server with a real MCP client. `npm run test:live` ran one turn each on Claude Code (Claude Agent SDK, local `claude` login) and Codex (Codex SDK 0.155 with its bundled CLI, local `codex` login): both read a document through the MCP server and recorded a proposal. A Claude Code turn was also driven inside the real Electron window and its proposal appeared in the document tab. Image attachments were exercised live through `tests/image.live.mjs`: a generated red PNG sent as a streamed user message to Claude Code and as a `local_image` input to Codex, both replying "Red". `tests/attachments.test.mjs` covers the image-block builder (readable files only, image ahead of text, stand-in text when the prompt is empty). The e2e run pastes an image into the composer, checks the thumbnail, the saved file, the rendered message and the lightbox. The raw API-key loop was not exercised live (no key present) and is covered by the scripted client.
- Live paper editing (`cd app && npm run test:paper`, 9 checks) ran against the connected server on the scratch paper `barkdown-editor-test`: the vendored `<bp-paper-canvas>` mounted the server blocks, a typed edit advanced the revision and landed on the server, an external write forced a 412 that surfaced as a conflict card, re-applying kept both edits, and the external block arrived through the echo. `tests/paper-proposal.live.mjs` (6 checks) proved an MCP proposal on a paper shows in the tab and lands as a strong-marked block when kept.
- Editor parity probes (`app/tests/editor.live.mjs` and `app/tests/editor-code.live.mjs`, live): Enter-split batches saved through the ops rewrite, markdown heading and list shortcuts with Tab and Shift+Tab nesting, the divider and code-fence shorthands, keyboard-selection format bubble with strikethrough, Ctrl+U underline landing as a PortableDoc `underline` wrapper, Ctrl+Shift+2 and Ctrl+Shift+0 turning a block into a heading and back, Ctrl+Shift+Up move, Ctrl+D duplicate, hover gutter with block menu, pointer drag with a drop line, slash menu at top level and inside an empty list item, Ctrl+K link row, and code-island typing plus ArrowDown and ArrowUp exits, all landing on the server with matching block kinds (18 steps, no renderer errors). The Notion-style skin (`app/renderer/paper-notion.css`) was checked visually in light and dark through `app/tests/paper-shot.mjs`, with the hover gutter measured to sit inside the pane beside the hovered block. The op rewrite for older servers (`app/shared/ops.js`: drop redundant moves, or express a reorder as remove plus re-insert) is covered by `app/tests/opsrewrite.test.mjs`, which replays eight batch shapes against an emulation of the server op semantics and checks the final order matches what the canvas intended. The Barkpark paper-editor unit suite passes except `__save_ack_mounted.test.mjs`, which fails identically on untouched main.
- The Barkpark adapter was exercised read-only against the connected `bp` server: paper listing with titles derived from the first heading, single paper read (HTML body), backlinks and history endpoints answered. Writes were not exercised and are disabled by default.

## Still unverified

Real Paper round trips, backend authorization, cross-environment runtime behavior, actual file saves/conflicts, production restart recovery, browser isolation, live search/media/graph access, provider cancellation, undo receipts, packaged application updates, multi-user editing, screen readers, IME, and 200% zoom need production integration evidence. See [acceptance scenarios](ACCEPTANCE.md).
