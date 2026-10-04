# C093 — The pin moves to six heading levels

**Why.** The owner ruled six heading levels on 2026-10-03 and pull request #66 changed the row 14 test to expect them. Barkdown still carried Barkpark `9f1874235`, 526 commits before `944a57a1e`, the upstream commit that adds them, so main's parity matrix went to 19 of 20. Issue #13 (the Tiptap retirement row) cannot close while a row is red.

```
 upstream 944a57a1e ──► editor bundle (rebuilt, byte-identical) + stylesheet ──► app/renderer/vendor
                    ──► dependency lock changed (Tiptap 2 → 3)            ──► notices regenerated (45 packages)
                    ──► mix release + Postgres 15.18                       ──► runtime/barkpark-944a57a1e-darwin-arm64
```

## Done

- **Editor upgrade.** A fresh worktree at the commit (`barkpark-worktrees/pin-944a57a1e`), `npm ci`, the bundle rebuilt with the upstream build flags: byte-identical to the committed one. `scripts/editor-notices.mjs` regenerated the notices; the 35 superseded notice folders were removed from `docs/third-party/paper-editor` and from `app/renderer/vendor/paper-editor-notices`; `scripts/bump-barkpark-ref.mjs --editor-upgrade` wrote the pin, the provenance, the consumption audit and both manifests.
- **Runtime.** `scripts/build-runtime-release.mjs` built the release from that worktree and added the carried Postgres.

## To do

The parity matrix and the app's test chain against the new runtime; whatever breaks; the pictures; chain; nightly; close #13.

## Task board

"C093 Move the Barkpark pin", worker `claude-barkdown-c093`.
