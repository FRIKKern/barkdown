const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process');const source='C:/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity',out=process.cwd().replaceAll(String.fromCharCode(92),"/")+'/.git/G2-accounting-linux-31';fs.mkdirSync(out);const linuxOut='/mnt/c'+out.slice(2),head=spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim(),main=spawnSync('git',['rev-parse','origin/main'],{cwd:source,encoding:'utf8'}).stdout.trim();assert(/^[a-f0-9]{40}$/.test(head)&&/^[a-f0-9]{40}$/.test(main));
const p=JSON.parse(fs.readFileSync(source+'/.github/required-checks.json')).protection,readback={required_status_checks:p.required_status_checks,required_signatures:{enabled:false}};for(const key of ['enforce_admins','required_linear_history','allow_force_pushes','allow_deletions','block_creations','required_conversation_resolution','lock_branch','allow_fork_syncing'])readback[key]={enabled:p[key]};fs.writeFileSync(out+'/readback.json',JSON.stringify(readback));fs.writeFileSync(out+'/runs.json',JSON.stringify({check_runs:p.required_status_checks.checks.map(x=>({name:x.context,conclusion:'success',started_at:'2026-07-28T01:00:00Z'}))}));
const script=`#!/usr/bin/env bash
set -euo pipefail
fixture=$(mktemp -d /tmp/barkdown-g2-accounting-30.XXXXXX)
printf '%s\\n' "$fixture" > '${linuxOut}/owned-fixture.txt'
mkdir -p "$fixture/repo" "$fixture/tmp" "$fixture/recovered"
git init -q "$fixture/repo"
printf '%s\\n' '/mnt/c/Users/Frikk/Documents/GitHub/barkpark/.git/objects' > "$fixture/repo/.git/objects/info/alternates"
git -C "$fixture/repo" config core.autocrlf false
git -C "$fixture/repo" checkout -q --detach '${head}'
git -C "$fixture/repo" update-ref refs/remotes/origin/main '${main}'
git -C "$fixture/repo" rev-parse HEAD HEAD^{tree} > '${linuxOut}/source-identity.txt'
cp '${linuxOut}/readback.json' "$fixture/readback.json"
cp '${linuxOut}/runs.json' "$fixture/runs.json"
cat > "$fixture/recover.py" <<'PY'
import os,sys,json,time,pathlib
root=pathlib.Path(os.environ['G2_ACCOUNTING_FIXTURE']).resolve(strict=True)
bound=(root/'tmp').resolve(strict=True)
for arg in sys.argv[1:]:
    if arg.startswith('-'):
        assert set(arg[1:]) <= set('rf'), arg
        continue
    target=pathlib.Path(arg).absolute()
    if not target.exists(): continue
    assert target.is_relative_to(bound) and target != bound, 'Outside owned fixture: '+str(target)
    current=target
    while current != bound:
        assert not current.is_symlink(), 'Linked cleanup refused'
        current=current.parent
    dest=root/'recovered'/(str(time.time_ns())+'-'+str(os.getpid())+'-'+target.name)
    assert not dest.exists()
    target.rename(dest)
    with (root/'recovery.jsonl').open('a') as f: f.write(json.dumps({'source':str(target),'destination':str(dest)})+'\\n')
PY
export G2_ACCOUNTING_FIXTURE="$fixture"
export TMPDIR="$fixture/tmp"
rm() { python3 "$G2_ACCOUNTING_FIXTURE/recover.py" "$@"; }
gh() { echo 'NETWORK REFUSED in derived accounting fixture' >&2; return 97; }
export -f rm gh
cd "$fixture/repo"
bash scripts/required-checks-verify.sh --spec .github/required-checks.json --readback "$fixture/readback.json" --runs "$fixture/runs.json" --sha probe
`;fs.writeFileSync(out+'/run.sh',script,{flag:'wx'});fs.copyFileSync(__filename,out+'/producer.cjs');const start=Date.now(),fd=fs.openSync(out+'/verify.log','wx');let result;try{result=spawnSync('wsl.exe',['--distribution','Gitgood-CI-2404','--exec','/bin/bash','--noprofile','--norc',linuxOut+'/run.sh'],{windowsHide:true,stdio:['ignore',fd,fd],timeout:300000});}finally{fs.closeSync(fd);}const log=fs.readFileSync(out+'/verify.log','utf8'),report={at:new Date().toISOString(),source:head,base:main,exitCode:result.status,signal:result.signal,error:result.error?.message||null,elapsedMs:Date.now()-start,unaccounted:[...log.matchAll(/unaccounted: ([^\r\n]+)/g)].map(x=>x[1]),ownedFixture:fs.existsSync(out+'/owned-fixture.txt')?fs.readFileSync(out+'/owned-fixture.txt','utf8').trim():null,scope:'Native WSL Ubuntu24.04 Bash5.2 against exact Git objects; full simulated protection/readback/check-run fixtures, no network or protection writes. Source checkout and original data preserved.'};fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');assert.equal(result.status,1,log.slice(-1800));assert.ok(report.unaccounted.includes('Barkdown parity gate'));assert.ok(report.unaccounted.includes('Parity dispatch and dependency checks'));console.log(JSON.stringify(report));
