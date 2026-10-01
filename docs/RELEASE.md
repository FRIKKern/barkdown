# Releasing Barkdown — proposed workflow

Status: phase 1 in use since 2026-10-01 (`scripts/chain.mjs`, `scripts/release.mjs`); phases 2–4 pending. Learned from T3 Code's release pipeline; the reading and the reasoning are in the paper [Nightly Is the Release Candidate](https://guerrilla.barkpark.cloud/papers/nightly-is-the-release-candidate).

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

## Phase 2 — signature and notarization (when a Developer ID exists)

`notarytool` in the same script; the rehearsal gains a Gatekeeper assessment (`spctl`) on the copied application.

## Phase 3 — the updater

`electron-updater` with the GitHub provider, `latest-mac.yml` and `nightly-mac.yml` from the same releases, blockmaps kept. The T3 Code behaviour: a background check, one click to download, one to restart, never on its own. Before a trial, an export of the profile (C085) is the snapshot; a failed trial restores it.

## Phase 4 — Windows, then the graph

NSIS on the Windows machine as a self-hosted runner, per-arch manifests merged. When there is a place to run it, `release.yml` with `resolve_commit`, `preflight`, quality, build, publish and finalize, serialised per channel, the version bump committed by a GitHub App after a stable release.

## Not copied

npm packages and a `curl | sh` installer, AUR, Vercel, a relay, Discord, the preview train, six targets. None has an audience here yet.
