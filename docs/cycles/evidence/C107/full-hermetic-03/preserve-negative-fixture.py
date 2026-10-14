import pathlib,json,subprocess
out=pathlib.Path('/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-54')
root=pathlib.Path((out/'owned-fixture.txt').read_text().strip())
assert root.parent==pathlib.Path('/tmp') and root.name.startswith('barkdown-g2-full-45.')
target=root/'repo'/'scripts'/'.rc26-mutant-verify.999999.sh'
assert target.is_file() and not target.is_symlink()
assert target.read_bytes()==b'owned refusal fixture\n'
tracked=subprocess.run(['git','-C',str(root/'repo'),'ls-files','--error-unmatch','--','scripts/'+target.name],capture_output=True)
assert tracked.returncode==1
dest=root/'recovered'/'guard-wrong-pid-refusal.sh'
assert not dest.exists()
target.rename(dest)
proof={'status':'preserved negative guard fixture','source':str(target),'destination':str(dest),'reason':'The guard proved wrong-PID refusal. Retain its exact temporary file outside source scripts so the later rc26 glob checks only suite-created mutants. No tracked source or check rule changed.'}
(out/'negative-fixture-preservation.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
