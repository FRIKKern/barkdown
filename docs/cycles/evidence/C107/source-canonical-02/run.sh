#!/usr/bin/env bash
set -euo pipefail
fixture=$(mktemp -d /tmp/barkdown-g2-canonical-55.XXXXXX)
printf '%s\n' "$fixture" > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-canonical-current-55/owned-fixture.txt'
mkdir -p "$fixture/repo" "$fixture/tmp" "$fixture/recovered"
git init -q "$fixture/repo"
printf '%s\n' '/mnt/c/Users/Frikk/Documents/GitHub/barkpark/.git/objects' > "$fixture/repo/.git/objects/info/alternates"
git -C "$fixture/repo" config core.autocrlf false
git -C "$fixture/repo" checkout -q --detach '9818ccc66aa1b660f71a234f66636ae288dceb75'
cp -f '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-canonical-current-55/recover.py' "$fixture/recover.py"
export G2_ACCOUNTING_FIXTURE="$fixture" G2_CHECK_BEGAN=$(date +%s)
export TMPDIR="$fixture/tmp"
rm() { python3 "$G2_ACCOUNTING_FIXTURE/recover.py" "$$" "$@"; }
gh() { echo 'NETWORK REFUSED in canonical source checks' >&2; return 97; }
export -f rm gh
cd "$fixture/repo"
bash scripts/check-doc-budgets.sh > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-canonical-current-55/budgets.log' 2>&1
bash scripts/docs-anchors-check.sh > '/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-canonical-current-55/anchors.log' 2>&1
