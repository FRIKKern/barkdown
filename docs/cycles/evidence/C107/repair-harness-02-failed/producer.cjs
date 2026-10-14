const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const root=process.cwd().replaceAll('\\','/'), source='C:/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity', out=root+'/.git/G2-full-hermetic-46', unixOut='/mnt/c'+out.slice(2);
fs.mkdirSync(out);const head=spawnSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).stdout.trim(),main=spawnSync('git',['rev-parse','origin/main'],{cwd:source,encoding:'utf8'}).stdout.trim();assert(/^[a-f0-9]{40}$/.test(head)&&/^[a-f0-9]{40}$/.test(main));
const recover=String.raw`import os,sys,json,time,pathlib,subprocess,re
root=pathlib.Path(os.environ['G2_ACCOUNTING_FIXTURE']).resolve(strict=True)
assert root.parent==pathlib.Path('/tmp') and root.name.startswith('barkdown-g2-full-45.')
bound=(root/'tmp').resolve(strict=True)
repo=(root/'repo').resolve(strict=True)
pid=sys.argv[1]
assert pid.isdecimal()
prefixes=['anchors-enum','anchors-out','nc-anchors-enum','nc-anchors','doclinks-enum','doclinks','canon-uniq-enum','canon-uniq-iter','banners-enum','banners-out','cold-enum','rdc-doc','rdc-code']
targets=[]
for arg in sys.argv[2:]:
    if arg.startswith('-'):
        assert set(arg[1:])<=set('rf'),arg
        continue
    target=pathlib.Path(os.path.abspath(arg))
    if not target.exists() and not target.is_symlink(): continue
    assert not target.is_symlink(), 'Linked target refused'
    if target.is_relative_to(bound) and target!=bound:
        stop=bound
    elif target.parent==repo/'scripts' and re.fullmatch(r'\.rc26-mutant-verify\.'+pid+r'(?:\.hdr|\.hdrold)?\.sh',target.name):
        assert target.is_file() and target.stat().st_ctime>=float(os.environ['G2_CHECK_BEGAN'])-2
        tracked=subprocess.run(['git','-C',str(repo),'ls-files','--error-unmatch','--',str(target.relative_to(repo))],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        assert tracked.returncode==1, 'Tracked source refused'
        stop=repo
    else:
        assert target.parent==pathlib.Path('/tmp') and target.name in [p+'.'+pid for p in prefixes], 'Outside owned cleanup '+str(target)
        assert target.is_file() and target.stat().st_ctime>=float(os.environ['G2_CHECK_BEGAN'])-2
        stop=pathlib.Path('/tmp')
    current=target.parent
    while current!=stop:
        assert not current.is_symlink(), 'Linked ancestor refused'
        current=current.parent
    targets.append(target)
for target in targets:
    dest=root/'recovered'/(str(time.time_ns())+'-'+str(os.getpid())+'-'+target.name)
    assert not dest.exists()
    target.rename(dest)
    with (root/'recovery-full.jsonl').open('a') as f: f.write(json.dumps({'source':str(target),'destination':str(dest)})+'\n')
`;fs.writeFileSync(out+'/recover.py',recover);
const guard=String.raw`import os,pathlib,subprocess,json
root=pathlib.Path(os.environ['G2_ACCOUNTING_FIXTURE']);repo=root/'repo';pid='424242';script=root/'recover-full.py'
def run(target): return subprocess.run(['python3',str(script),pid,'-f',str(target)],capture_output=True,text=True)
proof=[]
for suffix in ['.sh','.hdr.sh','.hdrold.sh']:
    p=repo/'scripts'/('.rc26-mutant-verify.'+pid+suffix);p.write_text('owned test fixture\n');r=run(p);assert r.returncode==0 and not p.exists(),r.stderr;proof.append('allowed '+suffix)
p=repo/'scripts'/('.rc26-mutant-verify.'+pid+'.sh');p.write_text('tracked fixture\n');subprocess.run(['git','-C',str(repo),'add','--',str(p.relative_to(repo))],check=True);r=run(p);assert r.returncode!=0 and p.exists();subprocess.run(['git','-C',str(repo),'restore','--staged','--',str(p.relative_to(repo))],check=True);p.rename(root/'recovered'/'guard-tracked.sh');proof.append('tracked refusal')
for p in [repo/'scripts'/'.rc26-mutant-verify.999999.sh', repo/'scripts'/'required-checks-verify.sh',root/'outside-test.sh']:
    if not p.exists(): p.write_text('owned refusal fixture\n')
    r=run(p);assert r.returncode!=0 and p.exists();proof.append('refused '+p.name)
p=root/'tmp'/'linked-test';p.symlink_to(repo/'scripts'/'required-checks-verify.sh');r=run(p);assert r.returncode!=0 and p.is_symlink();proof.append('linked target refusal')
print(json.dumps({'status':'passed','controls':proof}))
`;fs.writeFileSync(out+'/guard.py',guard);
const script=`#!/usr/bin/env bash
set -euo pipefail
fixture=$(mktemp -d /tmp/barkdown-g2-full-45.XXXXXX)
printf '%s\n' "$fixture" > '${unixOut}/owned-fixture.txt'
mkdir -p "$fixture/repo" "$fixture/tmp" "$fixture/recovered" "$fixture/bin"
git init -q "$fixture/repo"
printf '%s\n' '/mnt/c/Users/Frikk/Documents/GitHub/barkpark/.git/objects' > "$fixture/repo/.git/objects/info/alternates"
git -C "$fixture/repo" config core.autocrlf false
git -C "$fixture/repo" checkout -q --detach '${head}'
git -C "$fixture/repo" update-ref refs/remotes/origin/main '${main}'
git -C "$fixture/repo" rev-parse HEAD HEAD^{tree} > '${unixOut}/source-identity.txt'
export G2_ACCOUNTING_FIXTURE="$fixture" G2_CHECK_BEGAN=$(date +%s) TMPDIR="$fixture/tmp"
cp '${unixOut}/recover.py' "$fixture/recover-full.py"
python3 '${unixOut}/guard.py' > '${unixOut}/guard-result.json'
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
section() { printf '%s\n' "$*"; }
ok() { PASS=$((PASS+1));printf 'ok %s\n' "$*"; }
bad() { FAIL=$((FAIL+1));printf 'FAIL %s\n' "$*"; }
sed -n '/^section "24\./,/^section "25\./p' scripts/required-checks.test.sh | sed '$d' > "$fixture/scoped-arity.sh"
source "$fixture/scoped-arity.sh" > '${unixOut}/scoped-arity.log'
printf '{"passed":%s,"failed":%s,"blocked":%s}\n' "$PASS" "$FAIL" "$BLOCKED" > '${unixOut}/scoped-arity-result.json'
[ "$PASS" -gt 0 ] && [ "$FAIL" -eq 0 ] && [ "$BLOCKED" -eq 0 ]
bash scripts/required-checks.test.sh --hermetic
`;fs.writeFileSync(out+'/run.sh',script);fs.copyFileSync(__filename,out+'/producer.cjs');
const began=Date.now(),fd=fs.openSync(out+'/hermetic.log','wx');let r;try{r=spawnSync('wsl.exe',['--distribution','Gitgood-CI-2404','--exec','/bin/bash','--noprofile','--norc',unixOut+'/run.sh'],{windowsHide:true,stdio:['ignore',fd,fd],timeout:3600000});}finally{fs.closeSync(fd);}const log=fs.readFileSync(out+'/hermetic.log','utf8'),tally=log.match(/required-checks: (\d+) passed, (\d+) failed, (\d+) blocked/);const result={at:new Date().toISOString(),status:r.status===0&&tally?'passed':'failed',exitCode:r.status,signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-began,source:head,base:main,fixture:fs.existsSync(out+'/owned-fixture.txt')?fs.readFileSync(out+'/owned-fixture.txt','utf8').trim():null,tally:tally?{passed:+tally[1],failed:+tally[2],blocked:+tally[3]}:null,scope:'Fresh exact-commit native WSL hermetic source mutation suite; cleanup guard positives and tracked/outside/wrong-PID/link refusals checked before full run. No unmocked network or live protection writes.'};fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=result.status==='passed'?0:1;
