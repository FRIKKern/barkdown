#!/usr/bin/env bash
set -euo pipefail
fixture=$(mktemp -d /tmp/barkdown-g2-full-45.XXXXXX)
printf '%s
' "$fixture" > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/owned-fixture.txt'
mkdir -p "$fixture/repo" "$fixture/tmp" "$fixture/recovered" "$fixture/bin"
git init -q "$fixture/repo"
printf '%s
' '/mnt/c/Users/Frikk/Documents/GitHub/barkpark/.git/objects' > "$fixture/repo/.git/objects/info/alternates"
git -C "$fixture/repo" config core.autocrlf false
git -C "$fixture/repo" checkout -q --detach '9818ccc66aa1b660f71a234f66636ae288dceb75'
git -C "$fixture/repo" update-ref refs/remotes/origin/main 'a2ce7a468f88afaa09cb03a33c2aa7725368b00b'
git -C "$fixture/repo" rev-parse HEAD HEAD^{tree} > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/source-identity.txt'
export G2_ACCOUNTING_FIXTURE="$fixture" G2_CHECK_BEGAN=$(date +%s) TMPDIR="$fixture/tmp"
cp '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/recover.py' "$fixture/recover-full.py"
python3 '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/guard.py' > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/guard-result.json'
cat > "$fixture/bin/gh" <<'SH'
#!/usr/bin/env bash
echo 'UNMOCKED NETWORK REFUSED in hermetic source checks' >&2
exit 97
SH
chmod +x "$fixture/bin/gh"
export PATH="$fixture/bin:$PATH"
rm() { python3 "$G2_ACCOUNTING_FIXTURE/recover-full.py" "$$" "$@"; }
export -f rm
cd "$fixture/repo"
bash -n scripts/required-checks-generate.sh scripts/required-checks.test.sh scripts/required-checks-verify.sh
export REPO_ROOT="$fixture/repo" SPEC="$fixture/repo/.github/required-checks.json" GEN="$fixture/repo/scripts/required-checks-generate.sh" TMP=$(mktemp -d)
PASS=0;FAIL=0;BLOCKED=0
section() { printf '%s
' "$*"; }
ok() { PASS=$((PASS+1));printf 'ok %s
' "$*"; }
bad() { FAIL=$((FAIL+1));printf 'FAIL %s
' "$*"; }
sed -n '/^section "24./,/^section "25./p' scripts/required-checks.test.sh | sed '$d' > "$fixture/scoped-arity.sh"
source "$fixture/scoped-arity.sh" > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/scoped-arity.log'
printf '{"passed":%s,"failed":%s,"blocked":%s}
' "$PASS" "$FAIL" "$BLOCKED" > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/scoped-arity-result.json'
[ "$PASS" -gt 0 ] && [ "$FAIL" -eq 0 ] && [ "$BLOCKED" -eq 0 ]
export BARKPARK_CHECK_RUNS_LIB="$fixture/repo/scripts/lib/check-runs.sh"
eval "$(sed -n '/^emit_spec() {/,/^}/p' scripts/required-checks.test.sh)"
eval "$(sed -n '/^why_emit() /p; /^fail_emit() /p' scripts/required-checks.test.sh)"
GEN_EMIT_ERR=''
PASS=0;FAIL=0;BLOCKED=0
sed -n '/^section "33./,/^if [ "$HERMETIC" -eq 1 ]; then/p' scripts/required-checks.test.sh | sed '$d' > "$fixture/scoped-accounting.sh"
source "$fixture/scoped-accounting.sh" > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/scoped-accounting.log'
printf '{"passed":%s,"failed":%s,"blocked":%s}
' "$PASS" "$FAIL" "$BLOCKED" > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-53/scoped-accounting-result.json'
[ "$PASS" -eq 2 ] && [ "$FAIL" -eq 0 ] && [ "$BLOCKED" -eq 0 ]
bash scripts/required-checks.test.sh --hermetic
