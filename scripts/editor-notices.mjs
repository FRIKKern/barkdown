import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
// Reproduce exact notices from the editor's locked installed dependency closure.
// node scripts/editor-notices.mjs <upstream-worktree> [--verify]
const upstream=path.resolve(process.argv[2]||''),verify=process.argv.includes('--verify');
if(!process.argv[2])throw Error('Provide an isolated, npm-ci installed upstream worktree');
const editor=path.join(upstream,'api/assets/paper-editor'),out=path.resolve('docs/third-party/paper-editor');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifestPath=path.join(out,'manifest.json');
if(verify){
 const manifest=JSON.parse(fs.readFileSync(manifestPath));const expected=JSON.parse(fs.readFileSync('docs/editor-consumption-audit.json')).bundledPackages.map(p=>p.name+'@'+p.version).sort();
 if(JSON.stringify(expected)!==JSON.stringify(manifest.packages.map(p=>p.name+'@'+p.version).sort()))throw Error('Bundled package coverage mismatch');
 if(hash(fs.readFileSync(path.join(editor,'package-lock.json')))!==manifest.lockSha256)throw Error('Locked dependencies changed');
 if(hash(fs.readFileSync(path.join(upstream,'api/priv/static/assets/bp-paper-editor.bundle.js')))!==manifest.bundleSha256)throw Error('Editor bundle changed');
 for(const p of manifest.packages){if(hash(fs.readFileSync(path.join(editor,p.installedPackageJsonPath)))!==p.installedPackageJsonSha256)throw Error('Installed package changed '+p.name);for(const n of p.notices){if(hash(fs.readFileSync(path.join(out,n.file)))!==n.sha256)throw Error('Changed notice '+n.file);if(n.installedPath&&hash(fs.readFileSync(path.join(editor,n.installedPath)))!==n.sha256)throw Error('Installed notice differs '+n.file);}}
 for(const f of manifest.provenanceFiles)if(hash(fs.readFileSync(path.join(out,f.file)))!==f.sha256)throw Error('Changed provenance '+f.file);
 console.log('Verified notices for '+manifest.packages.length+' exact bundled package versions; all text and provenance hashes match.');process.exit(0);
}
const require=createRequire(path.join(editor,'package.json'));const {build}=require('esbuild');
const result=await build({absWorkingDir:editor,entryPoints:['src/index.js'],bundle:true,format:'iife',outfile:'../../priv/static/assets/bp-paper-editor.bundle.js',minify:true,write:false,metafile:true});
const bundled=result.outputFiles[0].contents,committed=fs.readFileSync(path.join(upstream,'api/priv/static/assets/bp-paper-editor.bundle.js'));if(!Buffer.from(bundled).equals(committed))throw Error('Generated bundle differs from committed source');
const packages=new Map();
for(const input of Object.keys(result.metafile.inputs).filter(p=>p.includes('node_modules/'))){let dir=path.dirname(path.resolve(editor,input)),p;while(path.dirname(dir)!==dir){if(fs.existsSync(path.join(dir,'package.json'))){p=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));if(p.name)break;}dir=path.dirname(dir);}if(!p?.name)throw Error(input);packages.set(p.name+'@'+p.version,{p,dir});}
fs.mkdirSync(out,{recursive:true});const provenanceFiles=[],records=[],tipCache=new Map();
async function fetchBytes(url){const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);return Buffer.from(await r.arrayBuffer());}
function recordFile(file,bytes){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest)&&!fs.readFileSync(dest).equals(bytes))throw Error('Refusing to overwrite different retained notice '+file);fs.writeFileSync(dest,bytes);return{file,sha256:hash(bytes)};}
const tags=execFileSync('git',['ls-remote','--tags','https://github.com/ueberdosis/tiptap.git'],{encoding:'utf8',maxBuffer:8e6});
for(const {p,dir} of [...packages.values()].sort((a,b)=>(a.p.name+'@'+a.p.version).localeCompare(b.p.name+'@'+b.p.version))){
 const id=p.name.replace(/^@/,'').replaceAll('/','--')+'@'+p.version,record={name:p.name,version:p.version,license:p.license,installedPackageJsonSha256:hash(fs.readFileSync(path.join(dir,'package.json'))),installedPackageJsonPath:path.relative(editor,path.join(dir,'package.json')).replaceAll('\\','/'),notices:[]};
 for(const name of fs.readdirSync(dir).filter(n=>/^(license|copying|notice)/i.test(n))){const file=path.join(dir,name);if(fs.statSync(file).isFile())record.notices.push({...recordFile(id+'/'+name,fs.readFileSync(file)),origin:'locked installed package',installedPath:path.relative(editor,file).replaceAll('\\','/')});}
 if(!record.notices.length&&p.name.startsWith('@tiptap/')){
  const registryUrl='https://registry.npmjs.org/'+encodeURIComponent(p.name)+'/'+p.version,raw=await fetchBytes(registryUrl),meta=JSON.parse(raw);if(meta.name!==p.name||meta.version!==p.version||!meta.gitHead)throw Error('Unbound package metadata');
  const tag='refs/tags/'+p.name+'@'+p.version,tagLine=tags.split('\n').find(l=>l.endsWith('\t'+tag+'^{}'))||tags.split('\n').find(l=>l.endsWith('\t'+tag));if(tagLine&&tagLine.split('\t')[0]!==meta.gitHead)throw Error('Official package tag disagrees with npm gitHead: '+tag);
  let sourcePackage=null;if(!tagLine){const packageUrl='https://raw.githubusercontent.com/ueberdosis/tiptap/'+meta.gitHead+'/'+meta.repository.directory+'/package.json';const bytes=await fetchBytes(packageUrl),sourceMeta=JSON.parse(bytes);if(sourceMeta.name!==p.name||sourceMeta.version!==p.version||sourceMeta.license!==p.license)throw Error('Published gitHead source version differs');sourcePackage={url:packageUrl,...recordFile(id+'/release-package.json',bytes)};provenanceFiles.push({file:sourcePackage.file,sha256:sourcePackage.sha256});}
  const sourceUrl='https://raw.githubusercontent.com/ueberdosis/tiptap/'+meta.gitHead+'/LICENSE.md';if(!tipCache.has(sourceUrl))tipCache.set(sourceUrl,await fetchBytes(sourceUrl));
  const evidence={name:p.name,version:p.version,registryUrl,repository:meta.repository,gitHead:meta.gitHead,tag:tagLine,licenseUrl:sourceUrl,dist:meta.dist,...(sourcePackage?{tagUnavailable:true,sourcePackage}:{} )};const file=recordFile(id+'/source.json',Buffer.from(JSON.stringify(evidence,null,2)+'\n'));provenanceFiles.push(file);
  record.notices.push({...recordFile(id+'/LICENSE.md',tipCache.get(sourceUrl)),origin:'official matching package release source',sourceUrl,sourceCommit:meta.gitHead,packageTag:tagLine?tag:null});
 }
 if(!record.notices.length)record.unavailable='No installed notice text and no verified exact source located';records.push(record);
}
const manifest={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:upstream,encoding:'utf8'}).trim(),bundleSha256:hash(committed),lockSha256:hash(fs.readFileSync(path.join(editor,'package-lock.json'))),method:'esbuild write:false exact committed bundle reproduction; installed notices copied byte-for-byte; missing Tiptap notices from npm release gitHead, matched to official package tag where present or exact source package version when no tag exists',packages:records,provenanceFiles};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log('Retained '+records.length+' bundled package notices; unavailable '+records.filter(p=>p.unavailable).length);
