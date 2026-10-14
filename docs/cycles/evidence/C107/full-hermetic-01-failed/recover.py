import os,sys,json,time,pathlib,subprocess
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
    with (root/'recovery-full.jsonl').open('a') as f: f.write(json.dumps({'source':str(target),'destination':str(dest)})+'\n')
