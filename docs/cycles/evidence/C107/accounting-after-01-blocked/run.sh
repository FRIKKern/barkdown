#!/usr/bin/env bash
set -euo pipefail
fixture='/tmp/barkdown-g2-accounting-30.FOtPV2'
[ -d "$fixture/repo/.git" ] || exit 3
export G2_ACCOUNTING_FIXTURE="$fixture"
export TMPDIR="$fixture/tmp"
rm() { python3 "$G2_ACCOUNTING_FIXTURE/recover.py" "$@"; }
gh() { echo 'NETWORK REFUSED in accounting fixture' >&2; return 97; }
export -f rm gh
cd "$fixture/repo"
for file in .github/required-checks.json scripts/required-checks-generate.sh scripts/required-checks.test.sh docs/ops/merge-gates.md; do cp -f '/mnt/c/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity/'"$file" "$file"; done
git diff --stat > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-accounting-after-35/overlay-stat.txt'
bash scripts/required-checks-verify.sh --spec .github/required-checks.json --readback "$fixture/readback.json" --runs "$fixture/runs.json" --sha probe > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-accounting-after-35/verify.log' 2>&1
export REPO_ROOT="$fixture/repo" SPEC="$fixture/repo/.github/required-checks.json" GEN="$fixture/repo/scripts/required-checks-generate.sh"
export TMP=$(mktemp -d)
PASS=0; FAIL=0; BLOCKED=0; GEN_EMIT_ERR=''
section() { printf '%s\n' "$*"; }
ok() { PASS=$((PASS+1)); printf 'ok %s\n' "$*"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$*"; }
blocked() { BLOCKED=$((BLOCKED+1)); printf 'BLOCKED %s\n' "$*"; }
eval "$(sed -n '/^emit_spec() {/,/^}/p' scripts/required-checks.test.sh)"
eval "$(sed -n '/^why_emit() /p; /^fail_emit() /p' scripts/required-checks.test.sh)"
source '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-scoped-accounting-test-34.sh'
printf 'scope: %s passed, %s failed, %s blocked\n' "$PASS" "$FAIL" "$BLOCKED"
[ "$PASS" -eq 2 ] && [ "$FAIL" -eq 0 ] && [ "$BLOCKED" -eq 0 ]
