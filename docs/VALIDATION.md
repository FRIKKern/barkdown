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
| `check-editor-study.cjs` | Direct document edit, selected text, attached Types menu, menu within viewport, actual type change preserving text, Escape, edits surviving document navigation. |
| `check-prd.cjs` | Four embedded images load, internal anchors exist, image/graph zoom, Escape, 24 requirements and priority filters, pane modes, phase accordions, narrow layout, print-to-PDF. |
| `check-previews.cjs` | All three committed standalone pages load and primary interactions work with zero runtime errors and zero HTTP(S) requests. |

Current shell and project editor checks cover widths 1024, 736, 390, and 320px without page overflow. The HTML plan is checked at desktop and 390px. These are not a complete accessibility or every-device certification.

Raw local outputs and screenshots are generated into ignored `test-results/`. A concise handoff result is committed in [validation.json](../evidence/validation.json). [artifact-manifest.json](../evidence/artifact-manifest.json) ties the generated delivery to its source bytes.

## Still unverified

Real Paper round trips, backend authorization, cross-environment runtime behavior, actual file saves/conflicts, production restart recovery, browser isolation, live search/media/graph access, provider cancellation, undo receipts, packaged application updates, multi-user editing, screen readers, IME, and 200% zoom need production integration evidence. See [acceptance scenarios](ACCEPTANCE.md).
