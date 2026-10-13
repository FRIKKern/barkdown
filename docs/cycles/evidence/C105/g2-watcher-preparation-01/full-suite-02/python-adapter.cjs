const fs=require('fs'),{spawnSync}=require('child_process');
const prefix="/c/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02",native="C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-watch-full-02";
const args=process.argv.slice(2).map(a=>a.replaceAll(prefix,native));
const input=args[0]==='-'?fs.readFileSync(0):undefined;
const r=spawnSync("C:/Users/Frikk/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",args,{input,windowsHide:true,maxBuffer:8e6,env:{...process.env,PYTHONPATH:native+'/python-packages',PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1'}});
if(r.stdout)process.stdout.write(r.stdout.toString("utf8").replaceAll("\r\n","\n"));
if(r.stderr)process.stderr.write(r.stderr);if(r.error)console.error(r.error.message);process.exitCode=r.status===null?97:r.status;
