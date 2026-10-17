const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root='C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown',base='C:/Users/Frikk/Documents/GitHub/barkdown/.git',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const packages=JSON.parse(fs.readFileSync(base+'/npm-consumer156-inputs.json'));
for(const pkg of packages){
 const dir=root+'/app/'+pkg.root,manifest=JSON.parse(fs.readFileSync(dir+'/package.json'));
 for(const key of ['type','bin','main','dependencies','optionalDependencies','repository'])if(manifest[key])pkg.manifest[key]=manifest[key];
 pkg.installedFiles=fs.readdirSync(dir,{recursive:true}).filter(f=>fs.statSync(path.join(dir,f)).isFile()).map(f=>{const b=fs.readFileSync(path.join(dir,f));return {path:pkg.root+'/'+f.replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};});
 const published=base+'/C106-app-notice-publishers-149/'+pkg.name.replaceAll('/','_').replace('@','')+'/original/package';
 for(const file of pkg.installedFiles)assert.deepEqual(fs.readFileSync(path.join(dir,file.path.slice(pkg.root.length+1))),fs.readFileSync(path.join(published,file.path.slice(pkg.root.length+1))));
 pkg.publisher={url:pkg.lock.resolved,integrity:pkg.lock.integrity,installedAllFilesExact:true,scope:'Every installed file matches retained exact npm publication; packaged manifest may be pruned, with projected runtime identity checked separately.'};
}
const pin={version:1,packages,limits:['Lazy-val original and broader package/embedded notices remain unresolved','Codex root originals qualified by version tag and exact launcher; no native platform or full source reproduction claim','Webhooks SDK library MIT original; repository Apache context retained separately, not substituted','No legal applicability/full source/CRT/clean-machine or A5 acceptance']};
fs.writeFileSync(root+'/scripts/windows-npm-notices-pin.json',JSON.stringify(pin,null,2)+'\n',{flag:'wx'});
const pub=root+'/docs/cycles/evidence/C106/npm-consumer-entry-01';fs.writeFileSync(pub+'/publisher-files.json',JSON.stringify({at:new Date().toISOString(),status:'passed',packages:packages.map(p=>({name:p.name,version:p.manifest.version,files:p.installedFiles.length,filesExact:true,publisher:p.publisher})),scope:'Actual whole installed files compared with preserved integrity-verified publisher tarballs; no source reproduction claim.'},null,2)+'\n');fs.copyFileSync(__filename,pub+'/publisher-producer.cjs');
console.log(JSON.stringify({packages:2,installedFiles:packages.reduce((n,p)=>n+p.installedFiles.length,0),codeFiles:5,originals:3}));
