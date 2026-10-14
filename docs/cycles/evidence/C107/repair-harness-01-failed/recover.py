import os,sys,json,time,pathlib,subprocess,re
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
    elif target.parent==repo/'scripts' and re.fullmatch(r'.rc26-mutant-verify.'+pid+r'(?:.hdr|.hdrold)?.sh',target.name):
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
    with (root/'recovery-full.jsonl').open('a') as f: f.write(json.dumps({'source':str(target),'destination':str(dest)})+'
')
