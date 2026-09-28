# Visual evidence and review rules

## What triggers review

The [coverage map](coverage.json) invalidates visual approval on what can move a pixel: renderer or shared code, the build, a dependency or Barkpark pin change, or the capture/comparison harness. Main-process code, behavior tests, helpers and fixtures are proven by their own tests and do not invalidate captures (narrowed 2026-09-28). New files count too. Every top-level `app/tests/*.live.mjs` and every capture helper/fixture under `app/tests/helpers/` or `app/tests/fixtures/` participates automatically, including new journeys; maintain no per-journey allowlist. This deliberately over-captures rather than guessing that a backend change cannot affect UI. `npm run check:visual` runs in root verification and CI. Capture from the branch being reviewed, with locked dependencies and disposable data.

## One approval per platform

Approvals are keyed by the capturing platform. The Windows source machine keeps `docs/visual/approved.json` and the primary gallery; macOS and Linux record `docs/visual/approved.<platform>.json` and `README.<platform>.md` beside it. `visual.mjs check` passes while at least one platform's approval matches the current inputs and names the platforms whose approval is stale, so a capture on one host never replaces another's pictures and a stale platform is visible rather than silently overwritten. Compare against the same platform's baseline only; a first approval on a new platform has no baseline and is reviewed as new coverage.

## Capture â†’ compare â†’ inspect â†’ accept

```sh
# Initial setup or dependency repair only; otherwise reuse healthy locked installs.
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

## Before broad capture

Run one focused smoke journey through the changed UI first: confirmation, in-flight state, completed navigation, error/refusal, restart when claimed, and a narrow viewport. Inspect dialog padding and reachable actions. Assert completion through the real user action (for example, the recovery dialog closes and the intended copy is visible), not only through already-present content. Finish the harness and related code-area README edits before committing capture inputs. Then run all required native, standard and live captures; this preparation does not substitute for them or permit reusing invalidated evidence.

## Comparison contract

Keep dimensions, platform, OS release, Electron, device scale, fonts, fixtures and animation settings comparable. Captures record OS release, architecture and the configured body font alongside the viewport. Startup notices must expire naturally before the tour begins; never mask a toast to make a diff pass. Environment changes are flagged; recapture in the original environment before deciding a regression. The comparator detects resized frames, ignores small RGB noise (20/255), measures changed pixels and concentrated changes in 32px tiles, creates a difference image, and compares visible control geometry/labels. Small/local changes remain visible in the report; no similarity score auto-approves anything. Intermediate action frames are compared as well as final views.

The default Electron tour uses temporary local fixture data, blocked provider calls, reduced motion and hidden text caret in stills. Its GIFs are step-by-step recordings of actual UI actions, not fabricated UI or proof of live model behavior. Real streaming, editing animation and recovery need separate full-motion/video capture with reduced motion disabled, and real integration assertions. Keep raw frames and capture settings with the evidence. Never mask changed controls or content to get a pass; any future dynamic masks require documented bounded regions and review.

## Preserve evidence

Run folders and approvals are append-only history. Never overwrite an approved PNG/GIF, silently promote candidates, restamp old media as current, delete a prior baseline, or auto-update snapshots in CI. If repository size grows, design an explicitly reviewed retention/archive strategy with durable links. `visual:approve` archives every distinct attestation as `reviews/approval-<sha256>.json`, including the previous current approval, and appends area README changelogs linking that exact review. The SHA-256 covers the entire serialized attestation (reviewer, note, timestamp and evidence hashes). Only `approved.json` selects the latest review; its `reviewPath` and `reviewHash` must match the immutable record. Existing legacy `reviews/<manifestHash>.json` files remain readable and are never rewritten. Earlier tool versions overwrote same-candidate records; this change preserves surviving records but cannot reconstruct already-lost attestations.

The existing live `npm --prefix app run shots` remains a separate Paper/server evidence path. Run only against an explicitly selected disposable/test Barkpark; it writes a showcase paper and must not be aimed at a person's library. Commit app source before that capture; inspect media and commit evidence after. It retains prior hashed images and manifest history. A live capture failure is a gap, not permission to relabel a fixture as live.

## Presentation theme

Use dark mode by default for README heroes, screenshots, GIFs and video previews. Use light mode when it demonstrates something specific: a theme comparison, contrast check, print view or light-theme regression. State that purpose in the caption; avoid incidental bright galleries in otherwise dark documentation.

Capture the actual app theme; never recolor an image to imply a different capture. Prefer an applicable reviewed dark asset when selecting existing evidence. Keep required light/dark regression coverage and historical media intact; this presentation default does not bypass freshness checks or change capture fixtures automatically.

## READMEs are health views

[Visual health](README.md) links area READMEs for workspace, chat, side chat, local documents and Settings. Each carries a still, an interaction GIF, source provenance, comparison report and local changelog. Link these from code-area READMEs. New journeys require coverage-map entries, captures and descriptive captions before being described as covered. The coverage map and linked journey pages distinguish fixture, private-runtime and live-provider proof. Coverage of one recovery or profile scenario does not cover every related journey; keep each remaining gap explicit.

Each area README should let a reviewer answer these questions without reading implementation:

1. What currently works here, and what is still unsupported?
2. What does it look like? Embed a representative real still and, for interactions, a short GIF; link full recording and intermediate frames. Captions identify the action and data scope (fixture, private real server, live provider or fallback).
3. What proves it? Link source commit(s), platform/capture manifest, comparison, named review and behavior results. Clearly label older evidence that remains applicable; never imply a new capture date.
4. What changed? Keep concise dated entries describing user-visible changes or regressions, with cycle/evidence links. Keep detailed logs in run folders, not the README.

Use existing area pages as the visual authority; code-area READMEs embed or link those same assets rather than copy media. Root README is a representative overview, not a second evidence ledger. Do not add decorative screenshots to nonvisual modules or label a missing journey as covered. Distinguish latest capture from latest accepted capture; an unreviewed candidate cannot replace the accepted view.

Review all new/changed stills, differences and meaningful motion frames, including intermediate states, narrow geometry and failures. Automated comparison directs attention but does not approve differences. An unchanged capture still needs an applicability review; record what was actually inspected without inventing frame counts. Preserve raw motion and document excerpting so transitions are not hidden.

The present freshness rules remain conservative, including documentation under app source directories. Batch those README edits before captures. Narrower invalidation is a future tooling change requiring its own regression proof; this policy does not exempt files or bypass current checks.

A cycle's closing truth pass includes these pages. CI verifies source/artifact/review freshness and local links; the named reviewer verifies meaning. Main is the integration baseline, not proof that every P1â€“P5 journey is complete.

## README demo

The cycle owner keeps the root README GIF current. Refresh it in the same evidence commit whenever a change affects the layout, controls or interactions it shows, or when a new core workflow should replace the featured journey. For unrelated changes, record why the existing demo still applies in the handoff. Reuse that cycle's reviewed recording instead of running a second showcase suite.

Use a short dark-mode journey with readable text and visible actions: roughly 15-25 seconds, at least 8 fps, about 1120 pixels wide and under 5 MB. Show the result, not just menus. Keep a still-view option. Use disposable content, identify scripted model responses, and link the source manifest and full video. Retain exact excerpt times and encoding settings; never hide a failed action or fabricate motion. Inspect every output frame and the README-sized result before replacing the embed. Compare encoded background colors against source frames; palette conversion must not introduce color casts or patchy bands. Automated checks do not replace this review.

## Private Paper capture

For source-runtime verification, use `npm --prefix app run shots:isolated` with a built Barkpark checkout (`BARKDOWN_TEST_BP_SOURCE` may select it). It owns a temporary database, ephemeral ports and temporary CLI config, then stops its runtime. The manifest records the actual server and source baseline. This is the preferred way to satisfy the live Paper freshness gate without changing the person's active CLI or demo library. Temporary data is retained for diagnosis. Real provider calls may be attempted; the existing transcript fallback is explicitly marked in the manifest.

The live status GIF requires ImageMagick's `magick` executable on `PATH`. Its Floydâ€“Steinberg conversion preserves full-frame modal gradients within GIF's 256-colour limit; the capture fails rather than publishing the non-dithered halo artifacts produced by the prior encoder.

## CI review downloads

Visual CI packages the fresh candidate gallery, its manifests/comparison/media, the approved baseline and immutable review provenance. Direct media referenced by the baseline's own approval comparison is included so its recorded comparison remains inspectable; unrelated historical runs stay in Git. Open the artifact's root README, then its before/after/difference gallery. `bundle.json` inventories paths, byte sizes and SHA-256 hashes; `node scripts/ci-review-bundle.mjs verify <extracted-artifact>` checks every packaged file and review link.

The workflow records the pre-capture run inventory and source. A failed capture/comparison produces **diagnostic-only** output containing partial new-run data, never an old pending run presented as fresh. A stale candidate, changed approval, unsafe path, missing media or hash/link mismatch fails packaging. CI cannot approve a baseline. Source paths inside capture manifests describe repository inputs and do not imply that application source is bundled.

This changes transport packaging only: no existing history is deleted, and capture, comparison, approval fingerprints and behavior gates are unchanged. Packaging has its own tests and CI trigger; it does not alter captured pixels. Published bundle hashes detect corruption, not malicious replacement of both files and their index.
