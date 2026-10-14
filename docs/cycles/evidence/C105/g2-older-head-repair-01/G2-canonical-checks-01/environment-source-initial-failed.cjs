const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const original='C:/Users/Frikk/Documents/GitHub/barkdown',snapshot=original+'/.git/G2-canonical-source-01',out=original+'/.git/G2-canonical-checks-01',python='C:/Users/Frikk/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',modules=original+'/.git/G2-watch-full-02/python-packages';
for(const d of ['tmp','recovered','bin'])fs.mkdirSync(out+'/'+d);const scopes=[snapshot,out];const prefixPairs=scopes.map(x=>['/c'+x.slice(2),x]);
const adapter=["const fs=require('fs'),{spawnSync}=require('child_process');",'const pairs='+JSON.stringify(prefixPairs)+';',"const args=process.argv.slice(2).map(a=>pairs.reduce((s,[from,to])=>s.replaceAll(from,to),a));", "const input=args[0]==='-'?fs.readFileSync(0):undefined;", 'const r=spawnSync('+JSON.stringify(python)+',args,{input,windowsHide:true,maxBuffer:16e6,env:{...process.env,PYTHONPATH:'+JSON.stringify(modules)+",PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});",'if(r.stdout)process.stdout.write(r.stdout.toString("utf8").replaceAll('+JSON.stringify('\r\n')+','+JSON.stringify('\n')+'));', 'if(r.stderr)process.stderr.write(r.stderr);if(r.error)console.error(r.error.message);process.exitCode=r.status===null?97:r.status;'].join('\n')+'\n';fs.writeFileSync(out+'/python-adapter.cjs',adapter,{flag:'wx'});
const inputs=['scripts/docs-anchors-check.sh','scripts/roster-drift-check.sh','scripts/boundary-marker-check.sh','scripts/docblock-enumeration-check.sh','scripts/merge-gates-elixir-anchor-check.sh','scripts/no-inplace-bp-copy-check.sh'];const prefixes=[...new Set(inputs.flatMap(f=>[...fs.readFileSync(snapshot+'/'+f,'utf8').matchAll(/\/tmp\/([A-Za-z0-9_-]+)\.\$\$/g)].map(m=>m[1])))];fs.writeFileSync(out+'/cleanup-prefixes.json',JSON.stringify(prefixes,null,2)+'\n',{flag:'wx'});
const recover=`const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const out=${JSON.stringify(out)},snapshot=${JSON.stringify(snapshot)},temp=fs.realpathSync(out+'/tmp'),roots=[temp,fs.realpathSync(snapshot)],allowed=${JSON.stringify(prefixes)},system=fs.readFileSync(out+'/system-temp.txt','utf8').trim(),began=JSON.parse(fs.readFileSync(out+'/started.json')).atMs;
const args=process.argv.slice(2),pid=args.shift();assert(/^\\d+$/.test(pid));const targets=[];for(const a of args){if(a.startsWith('-'))assert(/^-[rf]+$/.test(a));else targets.push(a);}assert(targets.length);
const inside=(r,p)=>{const q=path.relative(r,p);return q&&!q.startsWith('..')&&!path.isAbsolute(q);};
for(const item of targets){const target=path.resolve(item);if(!fs.existsSync(target))continue;const localRoot=roots.find(r=>inside(r,target)),stat=fs.lstatSync(target);assert(!stat.isSymbolicLink());if(!localRoot){assert(inside(system,target),'Outside permitted temp directory '+target);assert(allowed.some(p=>path.basename(target)===p+'.'+pid),'Not this checker’s named temporary file '+target);assert(stat.isFile()&&stat.birthtimeMs>=began-2000,'Pre-existing temp is not owned '+target);}else{let parent=target;while(path.relative(localRoot,parent)!==''){assert(!fs.lstatSync(parent).isSymbolicLink());parent=path.dirname(parent);}if(localRoot===roots[1]){const rel=path.relative(snapshot,target).replaceAll('\\\\','/');const tracked=spawnSync('git',['ls-files','--',rel],{cwd:snapshot,encoding:'utf8',windowsHide:true});assert.equal(tracked.status,0);assert.equal(tracked.stdout.trim(),'','Refuse to archive tracked source '+target);}}
const resolved=fs.realpathSync(target),destination=path.resolve(out+'/recovered',Date.now()+'-'+process.pid+'-'+path.basename(target));assert(inside(fs.realpathSync(out+'/recovered'),destination));assert(!fs.existsSync(destination));fs.renameSync(resolved,destination);fs.appendFileSync(out+'/recovery.jsonl',JSON.stringify({at:new Date().toISOString(),source:resolved,destination})+'\\n');}
`;
fs.writeFileSync(out+'/recover.cjs',recover,{flag:'wx'});const msys='/c'+out.slice(2);
fs.writeFileSync(out+'/environment.sh',`#!/usr/bin/env bash
set -euo pipefail
jq() { 'C:/Users/Frikk/Documents/GitHub/barkdown/.git/G2-toolchain/jq-1.8.2/jq-windows-amd64.exe' -b "$@"; }
python3() { node '${out}/python-adapter.cjs' "$@"; }
rm() { node '${out}/recover.cjs' "$$" "$@"; }
gh() { echo 'NETWORK REFUSED in canonical source check' >&2; return 97; }
export -f jq python3 rm gh
export TMPDIR='${msys}/tmp'
cygpath -w /tmp > '${out}/system-temp.txt'
cd '${snapshot}'
case "${1:-}" in
  budgets) bash scripts/check-doc-budgets.sh ;;
  anchors) bash scripts/docs-anchors-check.sh ;;
  *) echo 'Expected budgets or anchors' >&2; exit 2 ;;
esac
`,{flag:'wx'});
fs.writeFileSync(out+'/started.json',JSON.stringify({at:new Date().toISOString(),atMs:Date.now(),owner:'Codex Public Parity',systemTemp:'Resolved by cygpath per invocation; only checker-owned suffix-pid names allowed',sourceSnapshot:snapshot},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,prefixes}));
