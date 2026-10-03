#!/bin/zsh
# The nightly schedule on this Mac (docs/RELEASE.md, "The schedule"): launchd runs this every two hours.
# The checkout is brought up to date only when nothing is in progress in it (on main, no tracked
# changes, a fast-forward); then release.mjs decides whether a nightly is due, chains the commit when
# it has no receipt, and cuts the nightly. Everything it prints goes to .release/nightly-tick.log.
set -u
cd "$(dirname "$0")/.." || exit 1
mkdir -p .release; exec >> .release/nightly-tick.log 2>&1
echo "== $(date '+%Y-%m-%dT%H:%M:%S%z') tick"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export GIT_TERMINAL_PROMPT=0   # never wait for a credential prompt that nobody can answer
export BARKDOWN_TEST_FOREGROUND=1 # bring each test window to the front: focus-dependent steps need it under launchd
export BARKDOWN_MOCK_KEYCHAIN=1 # a launchd process cannot answer a keychain prompt either; the chain's Electron runs use Chromium's mock keychain
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null
command -v node >/dev/null || { echo "skip: no node on PATH"; exit 0; }
# The chain opens and focuses Electron windows for ten minutes: only when nobody is at the Mac (no input for
# ten minutes) and no other chain is running (two chains at once made both flaky, 2026-10-03).
idle_ns=$(ioreg -c IOHIDSystem 2>/dev/null | awk '/HIDIdleTime/ { print $NF; exit }'); idle_s=$(( ${idle_ns:-0} / 1000000000 ))
[ "$idle_s" -ge 600 ] || { echo "skip: the Mac is in use (idle ${idle_s}s)"; exit 0; }
pgrep -f "scripts/chain.mjs" >/dev/null && { echo "skip: another chain is running"; exit 0; }
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "skip: the checkout is not on main"; exit 0; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "skip: the tree has tracked changes"; exit 0; }
git fetch origin --quiet || { echo "skip: fetch failed"; exit 0; }
git merge --ff-only --quiet origin/main || { echo "skip: main does not fast-forward to origin/main"; exit 0; }
node scripts/release.mjs nightly --if-due --chain < /dev/null
echo "== exit $?"
