const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process');const original=process.cwd().replaceAll('\\','/'),out=original+'/.git/G2-canonical-current-39',unixOut='/mnt/c'+out.slice(2),source='C:/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity';fs.mkdirSync(out);const head=spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim();assert.equal(head,'0c35d928f42c4561319b4354be5b08e56e45ebee');fs.copyFileSync('.git/G2-full-hermetic-37/recover.py',out+'/recover.py');
const script=`#!/usr/bin/env bash
set -euo pipefail
fixture=$(mktemp -d /tmp/barkdown-g2-canonical-39.XXXXXX)
printf '%s\\n' "$fixture" > '${unixOut}/owned-fixture.txt'
mkdir -p "$fixture/repo" "$fixture/tmp" "$fixture/recovered"
git init -q "$fixture/repo"
printf '%s\\n' '/mnt/c/Users/Frikk/Documents/GitHub/barkpark/.git/objects' > "$fixture/repo/.git/objects/info/alternates"
git -C "$fixture/repo" config core.autocrlf false
git -C "$fixture/repo" checkout -q --detach '${head}'
cp -f '${unixOut}/recover.py' "$fixture/recover.py"
export G2_ACCOUNTING_FIXTURE="$fixture" G2_CHECK_BEGAN=$(date +%s)
export TMPDIR="$fixture/tmp"
rm() { python3 "$G2_ACCOUNTING_FIXTURE/recover.py" "$$" "$@"; }
gh() { echo 'NETWORK REFUSED in canonical source checks' >&2; return 97; }
export -f rm gh
cd "$fixture/repo"
bash scripts/check-doc-budgets.sh > '${unixOut}/budgets.log' 2>&1
bash scripts/docs-anchors-check.sh > '${unixOut}/anchors.log' 2>&1
`;fs.writeFileSync(out+'/run.sh',script);fs.copyFileSync(__filename,out+'/producer.cjs');const begin=Date.now(),fd=fs.openSync(out+'/runner.log','wx');let r;try{r=spawnSync('wsl.exe',['--distribution','Gitgood-CI-2404','--exec','/bin/bash','--noprofile','--norc',unixOut+'/run.sh'],{windowsHide:true,stdio:['ignore',fd,fd],timeout:600000});}finally{fs.closeSync(fd);}const result={at:new Date().toISOString(),source:head,status:r.status===0?'passed':'failed',exitCode:r.status,signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-begin,scope:'Actual committed source in separate native WSL snapshot; canonical budgets/anchors, preserving bounded cleanup and no network/policy writes. Independent semantic doc review remains pending.'};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=r.status===0?0:1;
