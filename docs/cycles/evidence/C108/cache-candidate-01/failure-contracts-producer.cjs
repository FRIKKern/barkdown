const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),http=require('http'),{spawn,execFileSync}=require('child_process');
const root='C:/Users/Frikk/Documents/GitHub/barkdown',source='C:/Users/Frikk/Documents/GitHub/barkpark-windows-media-settlement',runtime=root+'/runtime/C109-full-current-303',out=__dirname+'/C108-cache-errors418';
const {systemTool,systemRoot}=require('../app/main/windows-system-tools');
const {createRuntimeRecord}=require('../app/main/runtime-orphan');
const git=a=>execFileSync('git',a,{cwd:source,encoding:'utf8',windowsHide:true}).trim();
assert.equal(git(['rev-parse','HEAD']),'fce63d25ee134d11d9138ab369c3146e75b90f19');assert.equal(git(['status','--porcelain']),'');
const differences=git(['diff','--name-only','ae3be838480c7910b23b9a9568c61d16c08b23a0','HEAD','--','api/lib','api/config','api/mix.exs','api/mix.lock']).split('\n').filter(Boolean);assert.deepEqual(differences,['api/lib/barkpark/media/storage/README.md']);
assert(!fs.existsSync(out));fs.mkdirSync(out);
const requests=[];
const server=http.createServer((req,res)=>{
 const key=new URL(req.url,'http://127.0.0.1').pathname; requests.push({method:req.method,path:key});
 if(req.method!=='GET'||!key.startsWith('/synthetic-cache-errors/uploads/2026/10/')){res.writeHead(400);return res.end();}
 if(key.endsWith('/missing.svg')){res.writeHead(404);return res.end('synthetic missing');}
 if(key.endsWith('/existing-directory.svg')){const body=Buffer.from('Synthetic download bytes for a Windows directory collision');res.writeHead(200,{'content-type':'application/octet-stream','content-length':body.length});return res.end(body);}
 res.writeHead(400);res.end();
});
server.listen(0,'127.0.0.1',()=>{
 const endpoint='http://127.0.0.1:'+server.address().port;
 const erl=runtime+'/erts-16.4/bin/erl.exe';assert(fs.statSync(erl).isFile());
 const dirs=fs.readdirSync(runtime+'/lib',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>runtime+'/lib/'+d.name+'/ebin').filter(d=>fs.existsSync(d));
 const args=['-boot',runtime+'/releases/0.1.0/start_clean','-boot_var','RELEASE_LIB',runtime+'/lib','-pa',...dirs,'-noshell','-s','elixir','start_cli','-extra',__dirname+'/media-cache-errors418.exs',out,endpoint];
 const env={PATH:[systemTool(''),systemRoot()].join(';'),SystemRoot:systemRoot(),WINDIR:systemRoot(),ComSpec:systemTool('cmd.exe'),TEMP:out,TMP:out,ERL_CRASH_DUMP:out+'/erl_crash.dump'};
 fs.writeFileSync(out+'/entry.json',JSON.stringify({at:new Date().toISOString(),source:git(['rev-parse','HEAD']),runtime,endpoint,productionInputsExact:true,scope:'Calibrate exact controlled S3 cache failure postconditions on disposable native Windows files; no source/app change or replay of HTTP406.',budget:'Two direct-helper network failures and retained review; no full backend, renderer, database or installer.'},null,2));
 fs.copyFileSync(__filename,out+'/producer.cjs');fs.copyFileSync(__dirname+'/media-cache-errors418.exs',out+'/fixture.exs');
 const fd=fs.openSync(out+'/process.raw-private','wx'),began=Date.now();const child=spawn(erl,args,{cwd:out,env,windowsHide:true,stdio:['ignore',fd,fd]});
 const record={pid:child.pid,identity:child.pid?createRuntimeRecord.real(child.pid):'',status:'running'};fs.writeFileSync(out+'/process.json',JSON.stringify(record,null,2));
 child.on('error',e=>record.error=e.message);
 child.on('close',(code,signal)=>{fs.closeSync(fd);server.close();Object.assign(record,{status:code===0&&!signal&&!record.error?'completed':'failed',exitCode:code,signal,elapsedMs:Date.now()-began,requests,identityAfter:child.pid?createRuntimeRecord.real(child.pid):''});fs.writeFileSync(out+'/process.json',JSON.stringify(record,null,2));console.log(record);if(record.status!=='completed')process.exitCode=1;});
});
