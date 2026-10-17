const fs=require('fs'),assert=require('assert/strict'),http=require('http'),{spawn,execFileSync}=require('child_process');
const root='C:/Users/Frikk/Documents/GitHub/barkdown',source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',runtime=root+'/runtime/C109-full-current-303',out=__dirname+'/C108-cache-prototype420';
const {systemTool,systemRoot}=require('../app/main/windows-system-tools');const {createRuntimeRecord}=require('../app/main/runtime-orphan');
const git=a=>execFileSync('git',a,{cwd:source,encoding:'utf8',windowsHide:true}).trim();assert.equal(git(['rev-parse','HEAD']),'fce63d25ee134d11d9138ab369c3146e75b90f19');assert.equal(git(['status','--porcelain']),'');assert(!fs.existsSync(out));fs.mkdirSync(out);
const requests=[],pending=new Map();const payload=Buffer.from('Synthetic delayed cache bytes; no real media');
const respond=res=>{if(!res.destroyed){res.writeHead(200,{'content-type':'application/octet-stream','content-length':payload.length});res.end(payload);}};
const server=http.createServer((req,res)=>{
 const key=new URL(req.url,'http://127.0.0.1').pathname;
 if(key.startsWith('/control/release/')){const label=key.split('/').pop(),p=pending.get(label);if(!p){res.writeHead(409);return res.end();}requests.push({control:label,responseAlreadyDestroyed:p.destroyed});respond(p);pending.delete(label);res.writeHead(200);return res.end('released');}
 requests.push({method:req.method,path:key});
 if(req.method!=='GET'||!key.startsWith('/synthetic-cache-prototype/uploads/2026/10/')){res.writeHead(400);return res.end();}
 if(key.endsWith('/missing.svg')){res.writeHead(404);return res.end('synthetic missing');}
 const label=key.endsWith('/delayed.svg')?'delayed':key.endsWith('/interrupted.svg')?'interrupted':null;
 if(!label){res.writeHead(400);return res.end();}pending.set(label,res);fs.writeFileSync(out+'/'+label+'.arrived',JSON.stringify({at:new Date().toISOString()}));
});
server.listen(0,'127.0.0.1',()=>{
 const endpoint='http://127.0.0.1:'+server.address().port;
 const dirs=fs.readdirSync(runtime+'/lib',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>runtime+'/lib/'+d.name+'/ebin').filter(d=>fs.existsSync(d));
 const args=['-boot',runtime+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',runtime+'/lib','-pa',...dirs,'-noshell','-s','elixir','start_cli','-extra',__dirname+'/media-cache-prototype420.exs',out,endpoint];
 const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),TEMP:out,TMP:out,ERL_CRASH_DUMP:out+'/erl_crash.dump'};
 fs.writeFileSync(out+'/entry.json',JSON.stringify({at:new Date().toISOString(),source:git(['rev-parse','HEAD']),runtime,endpoint,scope:'Private physical-effect admission wrapper integration experiment only; actual compiled coordinator/S3. No production/source patch or complete repair.',budget:'Three bounded cache cases: held refusal/closing drain, owner death and coordinator restart, conservative controlled404.'},null,2));
 fs.copyFileSync(__filename,out+'/producer.cjs');fs.copyFileSync(__dirname+'/media-cache-prototype420.exs',out+'/fixture.exs');
 const fd=fs.openSync(out+'/process.raw-private','wx'),began=Date.now();const child=spawn(runtime+'/erts-16.4/bin/erl.exe',args,{cwd:out,env,windowsHide:true,stdio:['ignore',fd,fd]});
 const record={pid:child.pid,identity:child.pid?createRuntimeRecord.real(child.pid):'',status:'running'};fs.writeFileSync(out+'/process.json',JSON.stringify(record,null,2));
 child.on('error',e=>record.error=e.message);
 child.on('close',(code,signal)=>{fs.closeSync(fd);for(const res of pending.values())res.destroy();server.close();Object.assign(record,{status:code===0&&!signal&&!record.error?'completed':'failed',exitCode:code,signal,elapsedMs:Date.now()-began,requests,identityAfter:child.pid?createRuntimeRecord.real(child.pid):''});fs.writeFileSync(out+'/process.json',JSON.stringify(record,null,2));console.log(record);if(record.status!=='completed')process.exitCode=1;});
});
