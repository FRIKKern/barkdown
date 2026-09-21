const fs=require('fs'),path=require('path'),vm=require('vm'),cheerio=require('cheerio'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function fail(message){throw Error(message)}
for(const file of ['concepts/workspace.html','concepts/editor-study.html']){
 const text=read(file);if(Buffer.byteLength(text)>=1000000)fail(file+' too large');if(/<!doctype|<html[\s>]/i.test(text))fail(file+' must remain a fragment');
 const $=cheerio.load(text);$('script').each((i,e)=>new vm.Script($(e).html(),{filename:file+':script'+i}));
 if(/C:[/\\]Users[/\\]/.test(text))fail(file+' has a machine-specific path');
}
const source=cheerio.load(read('docs/prd.source.html'));
if(source('#requirements-table tbody tr').length!==24)fail('Requirement count changed');
if(source('#requirements-table tbody tr[data-priority="P0"]').length!==19)fail('P0 count changed');
const markdownFiles=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?markdownFiles(dir+'/'+e.name):e.name.endsWith('.md')?[dir+'/'+e.name]:[]);
for(const file of ['README.md','AGENTS.md',...markdownFiles('docs')]){
 const text=read(file);for(const match of text.matchAll(/\]\(([^)]+)\)/g)){const link=match[1].split('#')[0];if(!link||/^(?:https?:|mailto:)/.test(link))continue;const target=path.resolve(root,path.dirname(file),link);if(!target.startsWith(root+path.sep)||!fs.existsSync(target))fail('Broken local link in '+file+': '+link);}
}
for(const file of ['preview/index.html','preview/editor.html','preview/prd.html']){
 const $=cheerio.load(read(file));$('[src]').each((_,e)=>{const src=$(e).attr('src');if(src&&!src.startsWith('data:'))fail(file+' is not self-contained: '+src);});
}
const manifest=JSON.parse(read('evidence/artifact-manifest.json'));for(const item of manifest.files){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.file))).digest('hex');if(hash!==item.sha256)fail('Stale manifest: '+item.file);}
const refs=JSON.parse(read('evidence/source-references.json'));if(refs.repositories.some(repo=>repo.files.some(file=>!file.exists)))fail('Unresolved upstream file references');
// Status screenshots: the README shows the real app, from a capture no older than the last change to its UI.
// docs/images/status/manifest.json is written by `cd app && npm run shots`; every status image the README embeds
// must be listed there, and the manifest's commit must contain the last commit that touched app/renderer or
// app/main (so a UI change without fresh pictures fails here, not on a reader).
{
 const {execFileSync}=require('child_process');const git=a=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
 const readme=read('README.md');const embedded=[...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
 const status=embedded.filter(p=>p.startsWith('docs/images/status/'));
 if(!status.length)fail('README embeds no status screenshot (docs/images/status/*): run `cd app && npm run shots` and embed the real app');
 let manifest;try{manifest=JSON.parse(read('docs/images/status/manifest.json'))}catch{fail('docs/images/status/manifest.json is missing: run `cd app && npm run shots`')}
 const listed=new Set((manifest.shots||[]).map(s=>'docs/images/status/'+s.file));
 for(const p of status){if(!listed.has(p))fail('README embeds '+p+' but the status manifest does not list it (stale or hand-made): run `cd app && npm run shots`');if(!fs.existsSync(path.join(root,p)))fail('Missing status screenshot '+p);}
 const lastUi=git(['log','-1','--format=%H','--','app/renderer','app/main','app/shared']);
 let fresh=true;try{execFileSync('git',['merge-base','--is-ancestor',lastUi,manifest.barkdownCommit],{cwd:root,stdio:'ignore'})}catch{fresh=false}
 if(!fresh)fail('Status screenshots are older than the last UI change ('+lastUi.slice(0,9)+'; captured at '+String(manifest.barkdownCommit).slice(0,9)+'): commit the UI change, then `cd app && npm run shots`, then commit the pictures');
}
console.log('Source syntax, 24 requirements, local links, portable previews, source references, hashes, and fresh status screenshots passed.');
