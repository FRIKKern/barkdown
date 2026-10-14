#!/usr/bin/env bash
set -uo pipefail
jq() { 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-toolchain/jq-1.8.2/jq-windows-amd64.exe' -b "$@"; }
python3() { node 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/python-adapter.cjs' "$@"; }
rm() { node 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/recover.cjs' "$@"; }
gh() {
  local d
  local IFS=:
  for d in $PATH; do
    case "$d" in '/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/tmp/'*)
      if [ -f "$d/gh" ]; then
        printf 'stub %s\n' "$d/gh" >> 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/gh-routing.log'
        bash "$d/gh" "$@"; return $?
      fi ;;
    esac
  done
  echo 'NATIVE_GH_BLOCKED: no owned test stub in PATH' >&2
  return 97
}
export -f jq python3 rm gh
export TMPDIR='/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/tmp'
python3 -c "import yaml; assert yaml.__version__ == '6.0.2'; print(yaml.__version__)" || exit $?
python3 -c "import yaml; yaml.safe_load(open('/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/tree/.github/workflows/main-gate-watch.yml')); print('actual workflow YAML readable')" || exit $?
gh api NEVER_REAL >/dev/null 2>'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/gh-guard-preflight.log'
[ $? -eq 97 ] || exit 1
bash 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/tree/scripts/main-gate-watch.test.sh'
