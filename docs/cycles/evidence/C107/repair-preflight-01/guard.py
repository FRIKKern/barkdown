import os,pathlib,subprocess,json
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
