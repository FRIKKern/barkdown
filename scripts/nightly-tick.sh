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
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null
command -v node >/dev/null || { echo "skip: no node on PATH"; exit 0; }
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "skip: the checkout is not on main"; exit 0; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "skip: the tree has tracked changes"; exit 0; }
git fetch origin --quiet || { echo "skip: fetch failed"; exit 0; }
git merge --ff-only --quiet origin/main || { echo "skip: main does not fast-forward to origin/main"; exit 0; }
node scripts/release.mjs nightly --if-due --chain < /dev/null
echo "== exit $?"
