#!/usr/bin/env bash
set -uo pipefail
jq() { 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-toolchain/jq-1.8.2/jq-windows-amd64.exe' -b "$@"; }
rm() { node 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-01/recover.cjs' "$@"; }
export -f jq rm
export TMPDIR='C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-01/tmp'
bash 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-01/tree/scripts/main-gate-watch.test.sh'
