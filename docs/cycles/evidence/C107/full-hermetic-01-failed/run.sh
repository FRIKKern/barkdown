#!/usr/bin/env bash
set -euo pipefail
fixture='/tmp/barkdown-g2-accounting-30.FOtPV2'
export G2_ACCOUNTING_FIXTURE="$fixture" G2_CHECK_BEGAN=$(date +%s)
export TMPDIR="$fixture/tmp"
mkdir -p "$fixture/bin"
cp -f '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-37/recover.py' "$fixture/recover-full.py"
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
bash scripts/required-checks.test.sh --hermetic
