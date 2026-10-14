const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process');const original=process.cwd().replaceAll('\\','/'),out=original+'/.git/G2-accounting-after-36',unixOut='/mnt/c'+out.slice(2),source='C:/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity',unixSource='/mnt/c'+source.slice(2);fs.mkdirSync(out);const fixture=fs.readFileSync('.git/G2-accounting-linux-31/owned-fixture.txt','utf8').trim();assert(/^\/tmp\/barkdown-g2-accounting-30\.[A-Za-z0-9]+$/.test(fixture));
const script=`#!/usr/bin/env bash
set -euo pipefail
fixture='${fixture}'
[ -d "$fixture/repo/.git" ] || exit 3
export G2_ACCOUNTING_FIXTURE="$fixture"
export TMPDIR="$fixture/tmp"
rm() { python3 "$G2_ACCOUNTING_FIXTURE/recover.py" "$@"; }
gh() { echo 'NETWORK REFUSED in accounting fixture' >&2; return 97; }
export -f rm gh
cd "$fixture/repo"
for file in .github/required-checks.json scripts/required-checks-generate.sh scripts/required-checks.test.sh docs/ops/merge-gates.md; do cp -f '${unixSource}/'"$file" "$file"; done
git diff --stat > '${unixOut}/overlay-stat.txt'
bash scripts/required-checks-verify.sh --spec .github/required-checks.json --readback "$fixture/readback.json" --runs "$fixture/runs.json" --sha probe > '${unixOut}/verify.log' 2>&1
export BARKPARK_CHECK_RUNS_LIB="$fixture/repo/scripts/lib/check-runs.sh"
export REPO_ROOT="$fixture/repo" SPEC="$fixture/repo/.github/required-checks.json" GEN="$fixture/repo/scripts/required-checks-generate.sh"
export TMP=$(mktemp -d)
PASS=0; FAIL=0; BLOCKED=0; GEN_EMIT_ERR=''
section() { printf '%s\\n' "$*"; }
ok() { PASS=$((PASS+1)); printf 'ok %s\\n' "$*"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL %s\\n' "$*"; }
blocked() { BLOCKED=$((BLOCKED+1)); printf 'BLOCKED %s\\n' "$*"; }
eval "$(sed -n '/^emit_spec() {/,/^}/p' scripts/required-checks.test.sh)"
eval "$(sed -n '/^why_emit() /p; /^fail_emit() /p' scripts/required-checks.test.sh)"
source '${'/mnt/c'+original.slice(2)}/.git/G2-scoped-accounting-test-34.sh'
printf 'scope: %s passed, %s failed, %s blocked\\n' "$PASS" "$FAIL" "$BLOCKED"
[ "$PASS" -eq 2 ] && [ "$FAIL" -eq 0 ] && [ "$BLOCKED" -eq 0 ]
`;fs.writeFileSync(out+'/run.sh',script);fs.copyFileSync(__filename,out+'/producer.cjs');const began=Date.now(),fd=fs.openSync(out+'/checks.log','wx');let r;try{r=spawnSync('wsl.exe',['--distribution','Gitgood-CI-2404','--exec','/bin/bash','--noprofile','--norc',unixOut+'/run.sh'],{windowsHide:true,stdio:['ignore',fd,fd],timeout:300000});}finally{fs.closeSync(fd);}const result={at:new Date().toISOString(),status:r.status===0?'passed':'failed',exitCode:r.status,signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-began,fixture,scope:'Exact current workflow tree, all full-object/prose/partial-accounting checks, actual generator/four-context floor and disarmed-hold mutation; no network or policy writes'};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=r.status===0?0:1;
