#!/usr/bin/env bash
set -euo pipefail
jq() { 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-toolchain/jq-1.8.2/jq-windows-amd64.exe' -b "$@"; }
python3() { node 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-older-head-checks-06/python-adapter.cjs' "$@"; }
rm() { node 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-older-head-checks-06/recover.cjs' "$$" "$@"; }
gh() { echo 'NETWORK REFUSED in canonical source check' >&2; return 97; }
export -f jq python3 rm gh
export TMPDIR='/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-older-head-checks-06/tmp'
cygpath -w /tmp > 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-older-head-checks-06/system-temp.txt'
cd 'C:/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity'
[ "$#" -eq 1 ] || exit 2
case "$1" in
  shape) bash scripts/workflow-job-shape-check.sh --selftest && bash scripts/workflow-job-shape-check.sh --dir .github/workflows ;;
  example) node --test scripts/barkdown-parity-dispatch.test.mjs ;;
  syntax) bash -n scripts/main-gate-watch.sh ;;
  budgets) bash scripts/check-doc-budgets.sh ;;
  anchors) bash scripts/docs-anchors-check.sh ;;
  *) echo 'Expected budgets or anchors' >&2; exit 2 ;;
esac
