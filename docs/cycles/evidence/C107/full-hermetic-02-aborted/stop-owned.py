import os,pathlib,signal,json,subprocess
expected='/mnt/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-full-hermetic-47/run.sh'
rootpid=11
def cmd(pid):
    return pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes().replace(b'\0',b' ').decode()
assert cmd(rootpid).strip()=='/bin/bash --noprofile --norc '+expected
os.kill(rootpid,signal.SIGSTOP)
owned={rootpid}
for attempt in range(8):
    rows=subprocess.check_output(['ps','-eo','pid=,ppid='],text=True)
    pairs=[tuple(map(int,line.split())) for line in rows.splitlines()]
    changed=True
    while changed:
        changed=False
        for pid,parent in pairs:
            if parent in owned and pid not in owned:
                owned.add(pid);changed=True
                try: os.kill(pid,signal.SIGSTOP)
                except ProcessLookupError: pass
audit=[]
for pid in sorted(owned,reverse=True):
    try:
        audit.append({'pid':pid,'command':cmd(pid)})
        os.kill(pid,signal.SIGTERM);os.kill(pid,signal.SIGCONT)
    except (ProcessLookupError,FileNotFoundError): pass
print(json.dumps({'status':'terminated owned invalidated run','reason':'Exact source installed section33 is corrupt; do not spend a full run proving stale inputs. Not an observation timeout. Fresh corrected committed input must replace it.','rootCommand':expected,'processes':audit}))
