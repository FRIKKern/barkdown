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
for(const file of ['README.md','AGENTS.md',...fs.readdirSync(path.join(root,'docs')).filter(f=>f.endsWith('.md')).map(f=>'docs/'+f)]){
 const text=read(file);for(const match of text.matchAll(/\]\(([^)]+)\)/g)){const link=match[1].split('#')[0];if(!link||/^(?:https?:|mailto:)/.test(link))continue;const target=path.resolve(root,path.dirname(file),link);if(!target.startsWith(root+path.sep)||!fs.existsSync(target))fail('Broken local link in '+file+': '+link);}
}
for(const file of ['preview/index.html','preview/editor.html','preview/prd.html']){
 const $=cheerio.load(read(file));$('[src]').each((_,e)=>{const src=$(e).attr('src');if(src&&!src.startsWith('data:'))fail(file+' is not self-contained: '+src);});
}
const manifest=JSON.parse(read('evidence/artifact-manifest.json'));for(const item of manifest.files){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.file))).digest('hex');if(hash!==item.sha256)fail('Stale manifest: '+item.file);}
const refs=JSON.parse(read('evidence/source-references.json'));if(refs.repositories.some(repo=>repo.files.some(file=>!file.exists)))fail('Unresolved upstream file references');
console.log('Source syntax, 24 requirements, local links, portable previews, source references, and hashes passed.');
