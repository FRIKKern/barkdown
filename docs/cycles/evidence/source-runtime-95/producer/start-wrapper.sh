#!/bin/sh
# Playwright launches this as Electron; it goes through the source launcher, which passes the flags on.
cd "/Users/frikk.jarl/Documents/GitHub/barkdown.worktrees/source-runtime/app" && exec node scripts/start.mjs "$@"
