#!/usr/bin/env bash
set -euo pipefail
jq() { 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-toolchain/jq-1.8.2/jq-windows-amd64.exe' -b "$@"; }
python3() { 'C:/Users/Frikk/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' "$@"; }
export -f jq python3
jq --version
jq -e '.protection.required_status_checks.checks | length == 4' .github/required-checks.json >/dev/null
bash scripts/required-checks-generate.sh --sha ab6569646383ed13f8c76ee6b9e89febe934e7c3 --sha 7a34dca393e8b2059a9f4c3e617bb27cfdbf57f4 --expect-unrendered 'PR references an active task' --out C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-required-checks-candidate-03.json
