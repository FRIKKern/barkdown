const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process');const original=process.cwd().replaceAll('\\','/'),out=original+'/.git/G2-full-hermetic-37',unixOut='/mnt/c'+out.slice(2);fs.mkdirSync(out);const fixture=fs.readFileSync('.git/G2-accounting-linux-31/owned-fixture.txt','utf8').trim();assert(/^\/tmp\/barkdown-g2-accounting-30\.[A-Za-z0-9]+$/.test(fixture));
const recover=`import os,sys,json,time,pathlib,subprocess
root=pathlib.Path(os.environ['G2_ACCOUNTING_FIXTURE']).resolve(strict=True)
bound=(root/'tmp').resolve(strict=True)
pid=sys.argv[1]
assert pid.isdecimal()
prefixes=['anchors-enum','anchors-out','nc-anchors-enum','nc-anchors','doclinks-enum','doclinks','canon-uniq-enum','canon-uniq-iter','banners-enum','banners-out','cold-enum','rdc-doc','rdc-code']
for arg in sys.argv[2:]:
    if arg.startswith('-'):
        assert set(arg[1:])<=set('rf'),arg
        continue
    target=pathlib.Path(os.path.abspath(arg))
    if not target.exists() and not target.is_symlink(): continue
    in_owned=target.is_relative_to(bound) and target!=bound
    if not in_owned:
        assert target.parent==pathlib.Path('/tmp') and target.name in [p+'.'+pid for p in prefixes], 'Outside owned cleanup '+str(target)
        assert target.is_file() and target.stat().st_ctime>=float(os.environ['G2_CHECK_BEGAN'])-2
    else:
        current=target.parent
        while current!=bound:
            assert not current.is_symlink()
            current=current.parent
    dest=root/'recovered'/(str(time.time_ns())+'-'+str(os.getpid())+'-'+target.name)
    assert not dest.exists()
    target.rename(dest)
    with (root/'recovery-full.jsonl').open('a') as f: f.write(json.dumps({'source':str(target),'destination':str(dest)})+'\\n')
`;fs.writeFileSync(out+'/recover.py',recover);
const script=`#!/usr/bin/env bash
set -euo pipefail
fixture='${fixture}'
export G2_ACCOUNTING_FIXTURE="$fixture" G2_CHECK_BEGAN=$(date +%s)
export TMPDIR="$fixture/tmp"
mkdir -p "$fixture/bin"
cp -f '${unixOut}/recover.py' "$fixture/recover-full.py"
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
`;fs.writeFileSync(out+'/run.sh',script);fs.copyFileSync(__filename,out+'/producer.cjs');const began=Date.now(),fd=fs.openSync(out+'/hermetic.log','wx');let r;try{r=spawnSync('wsl.exe',['--distribution','Gitgood-CI-2404','--exec','/bin/bash','--noprofile','--norc',unixOut+'/run.sh'],{windowsHide:true,stdio:['ignore',fd,fd],timeout:3600000});}finally{fs.closeSync(fd);}const text=fs.readFileSync(out+'/hermetic.log','utf8'),tally=text.match(/required-checks: (\d+) passed, (\d+) failed, (\d+) blocked/);const result={at:new Date().toISOString(),status:r.status===0&&tally?'passed':'failed',exitCode:r.status,signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-began,fixture,tally:tally?{passed:Number(tally[1]),failed:Number(tally[2]),blocked:Number(tally[3])}:null,scope:'Native WSL full hermetic source mutation suite with exact source overlay, preserving bounded cleanup and refusing unmocked network/protection writes. Not full API/editor, G2 enforcement or clean-machine proof.'};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=result.status==='passed'?0:1;
