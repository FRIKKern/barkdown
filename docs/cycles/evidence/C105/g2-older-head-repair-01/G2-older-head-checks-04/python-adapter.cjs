const fs=require('fs'),{spawnSync}=require('child_process');
const pairs=[["/c/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity","C:/Users/Frikk/Documents/GitHub/barkpark-public-editor-parity"],["/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-older-head-checks-04","C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-older-head-checks-04"]];
const normalize=s=>s.split(/(s+)/).map(token=>pairs.reduce((v,[posix,native])=>v.startsWith(native)?posix+v.slice(native.length).split(String.fromCharCode(92)).join('/'):v,token)).join('');
const args=process.argv.slice(2).map(a=>pairs.reduce((s,[from,to])=>s.replaceAll(from,to),a));
const input=args[0]==='-'?fs.readFileSync(0):undefined;
const r=spawnSync("C:/Users/Frikk/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",args,{input,windowsHide:true,maxBuffer:16e6,env:{...process.env,PYTHONPATH:"C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02/python-packages",PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
if(r.stdout)process.stdout.write(normalize(r.stdout.toString("utf8")).replaceAll("\r\n","\n"));
if(r.stderr)process.stderr.write(r.stderr);if(r.error)console.error(r.error.message);process.exitCode=r.status===null?97:r.status;
