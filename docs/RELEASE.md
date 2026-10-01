# Releasing Barkdown — proposed workflow

Status: phase 1 in use since 2026-10-01 (`scripts/chain.mjs`, `scripts/release.mjs`); nightlies [v0.6.0-nightly.20261001.1](https://github.com/FRIKKern/barkdown/releases/tag/v0.6.0-nightly.20261001.1) and [v0.6.0-nightly.20261001.2](https://github.com/FRIKKern/barkdown/releases/tag/v0.6.0-nightly.20261001.2) (the first with the updater feed); phases 2–4 pending. Learned from T3 Code's release pipeline; the reading and the reasoning are in the paper [Nightly Is the Release Candidate](https://guerrilla.barkpark.cloud/papers/nightly-is-the-release-candidate).

## The idea

A stable release is never a fresh build of `main`. It is the commit of the latest nightly, the one the owner already ran, rebuilt under a stable version and promoted. Verification happens on a real install, not in a staging environment.

## Constraints today

One Mac (arm64). A private repository whose Actions runs start with zero jobs (budget), so `npm run check` and the full desktop chain on this Mac are the gates. No signing identity yet: the disk image is ad hoc signed and Gatekeeper refuses it elsewhere. Windows arrives about 2026-10-05.

## Phase 1 — a release script with the invariants (this Mac)

`node scripts/chain.mjs` runs `npm run check` and the full `npm test` on the exact commit at HEAD, stdin closed, and writes a receipt to `.release/chain/<sha>.json` (ignored; the release uploads it). `node scripts/release.mjs <nightly|stable>` then:

1. refuse a dirty tree and a commit without a green full-chain receipt in the cycle evidence;
2. build the runtime stamp, `Barkdown.app` and the disk image (`scripts/build-mac-app.mjs --dmg`);
3. run `test:app-dmg` (install, uninstall, reinstall, failed-upgrade rollback) and `test:daily-use`;
4. write `SHA256SUMS` from the final bytes about to be uploaded;
5. generate notes against the previous tag in the same channel, with the cycle record's evidence links;
6. tag that commit and create the GitHub Release with `gh`: nightly as `vX.Y.Z-nightly.<date>.<n>` (prerelease, never latest), stable as `vX.Y.Z` on a nightly's commit (latest, `--from <nightly tag>` to choose one). `app/package.json` holds the *next* stable version; after a stable release it moves to the next patch on `main`. The rehearsal results and the chain receipt are uploaded beside the image.

No dry run: every run of the script is a real release. The script says so.

## The schedule (this Mac, since 2026-10-02)

A launchd agent runs `scripts/nightly-tick.sh` every two hours (`node scripts/nightly-schedule.mjs install | remove | status`; the agent is `~/Library/LaunchAgents/no.guerrilla.barkdown.nightly.plist`, written from `scripts/launchd/`). A tick does nothing unless the checkout is idle — on `main`, no tracked changes, and `origin/main` fast-forwards — then runs `release.mjs nightly --if-due --chain`: not due (no new commits, or the last nightly is under six hours old) means exit 0 and one log line; due means the chain runs first when the commit has no receipt (about twenty minutes of Electron windows opening and closing on this Mac), and the nightly is cut from a passing receipt. A commit whose chain failed is not retried; the next commit gets its own chain. Log: `.release/nightly-tick.log`. The GitHub Actions workflow (`.github/workflows/release.yml`) has the same cron for the day a self-hosted runner exists; until then this agent is the schedule.

## Phase 2 — signature and notarization (when a Developer ID exists)

Built in, idle until the secrets exist: with `CSC_NAME` (a Developer ID Application identity in the login keychain) and `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` in the environment, `build-mac-app.mjs` signs with that identity, enables the hardened runtime and notarizes through electron-builder; without them it signs ad hoc. Still to do once an identity exists: a Gatekeeper assessment (`spctl`) in the install rehearsal.

## Phase 3 — the updater

Built in (`app/main/updates.js`, Settings › About): `electron-updater` with the GitHub provider against the running channel's feed (`nightly-mac.yml` for a nightly build, `latest-mac.yml` for a stable), which every release now carries beside the image with the zip and its blockmap. A background check a minute after launch and every six hours; one click to download; one to restart; never on its own. While the application is signed ad hoc the install is refused with the reason (Squirrel.Mac validates the new bundle's signature against the running one), so the step is exercised only after phase 2. `BARKDOWN_UPDATE_URL` points the updater at any static feed for a rehearsal (`npm run test:updates`). Note: a private repository cannot serve the GitHub feed to an installed app without a token; the feed must be public or hosted elsewhere before updates reach anyone but the owner. Still to do: an export of the profile (C085) as the snapshot before an install, restored if the new version fails to start.

## Phase 4 — Windows, then the graph

`.github/workflows/release.yml` exists and is inert: it runs the same two commands (`chain.mjs`, then `release.mjs`) on a self-hosted macOS runner, by hand for either channel or every two hours as a nightly gated by `--if-due` (new commits on `main` since the last nightly and six hours passed). A self-hosted runner spends no Actions minutes, so registering a Mac makes it live despite the exhausted budget; nothing is registered yet. Windows: NSIS on the Windows machine as a second runner, per-arch manifests merged.

## Not copied

npm packages and a `curl | sh` installer, AUR, Vercel, a relay, Discord, the preview train, six targets. None has an audience here yet.
