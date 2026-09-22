# Visual evidence and review rules

## What triggers review

The [coverage map](coverage.json) currently takes a conservative approach: every app main/renderer/shared change, dependency or Barkpark pin change, or capture/comparison harness change invalidates visual approval. New files count too. Every top-level `app/tests/*.live.mjs` and every capture helper/fixture under `app/tests/helpers/` or `app/tests/fixtures/` participates automatically, including new journeys; maintain no per-journey allowlist. This deliberately over-captures rather than guessing that a backend change cannot affect UI. `npm run check:visual` runs in root verification and CI. Capture from the branch being reviewed, with locked dependencies and disposable data.

## Capture → compare → inspect → accept

```sh
npm ci
npm --prefix app ci
npm run visual:capture
npm run visual:compare
# Open docs/visual/runs/<run>/README.md and view the actual images/GIF frames.
node scripts/visual.mjs approve --reviewer "Your name or agent" --note "What changed, what was checked, limits and behavior-test evidence"
npm run verify
```

Capture never updates approval. Comparison never decides whether a change is good. Approval is a named human/agent attestation, bound to the exact candidate manifest and report hashes. This is an engineering guard, not a security boundary against someone intentionally fabricating a review. Review every new/changed frame, not just the last screen. If a regression is found, fix it, recapture and compare again; do not bless it to clear CI. If uncertainty remains, leave approval blocked with a cycle checkpoint.

Review clipping, overlapping controls, missing content, theme contrast, menus, focus/selection, narrow layouts and unwanted movement. Pair this with behavior checks for saves, ownership, Undo, keyboard access and recovery. Screenshots cannot prove that data was preserved. Record actual commands/results and limitations in the cycle handoff and validation ledger.

## Comparison contract

Keep dimensions, platform, OS release, Electron, device scale, fonts, fixtures and animation settings comparable. Captures record OS release, architecture and the configured body font alongside the viewport. Startup notices must expire naturally before the tour begins; never mask a toast to make a diff pass. Environment changes are flagged; recapture in the original environment before deciding a regression. The comparator detects resized frames, ignores small RGB noise (20/255), measures changed pixels and concentrated changes in 32px tiles, creates a difference image, and compares visible control geometry/labels. Small/local changes remain visible in the report; no similarity score auto-approves anything. Intermediate action frames are compared as well as final views.

The default Electron tour uses temporary local fixture data, blocked provider calls, reduced motion and hidden text caret in stills. Its GIFs are step-by-step recordings of actual UI actions, not fabricated UI or proof of live model behavior. Real streaming, editing animation and recovery need separate full-motion/video capture with reduced motion disabled, and real integration assertions. Keep raw frames and capture settings with the evidence. Never mask changed controls or content to get a pass; any future dynamic masks require documented bounded regions and review.

## Preserve evidence

Run folders and approvals are append-only history. Never overwrite an approved PNG/GIF, silently promote candidates, restamp old media as current, delete a prior baseline, or auto-update snapshots in CI. If repository size grows, design an explicitly reviewed retention/archive strategy with durable links. `visual:approve` archives every distinct attestation as `reviews/approval-<sha256>.json`, including the previous current approval, and appends area README changelogs linking that exact review. The SHA-256 covers the entire serialized attestation (reviewer, note, timestamp and evidence hashes). Only `approved.json` selects the latest review; its `reviewPath` and `reviewHash` must match the immutable record. Existing legacy `reviews/<manifestHash>.json` files remain readable and are never rewritten. Earlier tool versions overwrote same-candidate records; this change preserves surviving records but cannot reconstruct already-lost attestations.

The existing live `npm --prefix app run shots` remains a separate Paper/server evidence path. Run only against an explicitly selected disposable/test Barkpark; it writes a showcase paper and must not be aimed at a person's library. Commit app source before that capture; inspect media and commit evidence after. It retains prior hashed images and manifest history. A live capture failure is a gap, not permission to relabel a fixture as live.

## READMEs are health views

[Visual health](README.md) links area READMEs for workspace, chat, side chat, local documents and Settings. Each carries a still, an interaction GIF, source provenance, comparison report and local changelog. Link these from code-area READMEs. New journeys require coverage-map entries, captures and descriptive captions before being described as covered. Paper has existing live evidence; agent edits, files/reviews, runtime recovery and future profiles still need dedicated motion tours. Keep those gaps visible.

A cycle's closing truth pass includes these pages. CI verifies source/artifact/review freshness and local links; the named reviewer verifies meaning. Main is the integration baseline, not proof that every P1–P5 journey is complete.

## Private Paper capture

For source-runtime verification, use `npm --prefix app run shots:isolated` with a built Barkpark checkout (`BARKDOWN_TEST_BP_SOURCE` may select it). It owns a temporary database, ephemeral ports and temporary CLI config, then stops its runtime. The manifest records the actual server and source baseline. This is the preferred way to satisfy the live Paper freshness gate without changing the person's active CLI or demo library. Temporary data is retained for diagnosis. Real provider calls may be attempted; the existing transcript fallback is explicitly marked in the manifest.

The live status GIF requires ImageMagick's `magick` executable on `PATH`. Its Floyd–Steinberg conversion preserves full-frame modal gradients within GIF's 256-colour limit; the capture fails rather than publishing the non-dithered halo artifacts produced by the prior encoder.
