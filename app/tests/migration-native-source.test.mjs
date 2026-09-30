import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
// The legacy editor (Tiptap 3, retired in C087) persisted these attribute defaults; libraries written by it still hold them.
const {markdownToDoc}=require('../shared/markdown'),{pmDocToBlocks}=require('../shared/portabledoc'),{inspectContent,prepareMigration}=require('../main/migration-preflight'),{stageMigration}=require('../main/migration-staging');
function native(content){
  const walk=node=>{
    if(!node||typeof node!=='object')return node;
    if(Array.isArray(node))return node.map(walk);
    const out={...node};
    if(out.marks)out.marks=out.marks.map(mark=>mark.type==='link'?{...mark,attrs:{href:mark.attrs?.href||null,target:'_blank',rel:'noopener noreferrer nofollow',class:null,title:null}}:mark);
    if(out.type==='orderedList')out.attrs={start:out.attrs?.start??1,type:null};
    if(out.type==='tableCell'||out.type==='tableHeader')out.attrs={colspan:1,rowspan:1,colwidth:null,...(out.attrs||{})};
    if(out.type==='taskItem')out.attrs={checked:Boolean(out.attrs?.checked)};
    if(out.content)out.content=walk(out.content);
    return out;
  };
  return walk(structuredClone(content));
}
const markdown='# Native defaults\n\n[A link](https://example.org) and **rich** text.\n\n1. First\n2. Second\n\n> A quote\n\n| Header | Value |\n| --- | --- |\n| Cell | More |\n\n- [x] Done\n\n```js\nconst value=1;\n```';
function fixture(content){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-native-source-')),profileId=crypto.randomUUID(),sourceDir=path.join(root,profileId),destinationDir=path.join(root,'backup');fs.mkdirSync(path.join(sourceDir,'documents'),{recursive:true});
  const doc={id:'note',title:'Native defaults',rev:3,content};fs.writeFileSync(path.join(sourceDir,'documents/note.json'),JSON.stringify(doc));fs.writeFileSync(path.join(sourceDir,'workspace.json'),JSON.stringify({version:1,chats:{main:{draft:'Do not alter'}},pages:{roots:['note']}}));
  return {profileId,sourceDir,destinationDir,quiesced:true,metadata:{note:{description:'Native persisted defaults proof preserves semantic content and exact source bytes',tags:[{tag:'nativeproof',strength:95}]}}};
}
test('actual configured legacy schema defaults prepare without changing native content or backup bytes',()=>{
  const parsed=markdownToDoc(markdown),source=native(parsed),before=structuredClone(source);
  assert.deepEqual(source.content[1].content[0].marks[0].attrs,{href:'https://example.org',target:'_blank',rel:'noopener noreferrer nofollow',class:null,title:null});
  assert.deepEqual(source.content[2].attrs,{start:1,type:null});
  assert.deepEqual(inspectContent(parsed),[]);assert.deepEqual(inspectContent(source),[]);
  assert.deepEqual(pmDocToBlocks(source),pmDocToBlocks(parsed));assert.deepEqual(source,before);
  const f=fixture(source),file=path.join(f.sourceDir,'documents/note.json'),bytes=fs.readFileSync(file),m=prepareMigration(f);assert.equal(m.status,'prepared');assert.deepEqual(fs.readFileSync(file),bytes);assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/documents/note.json')),bytes);
});
test('default link attributes resolve canonical internal references without mutating the source',()=>{
  const source=native(markdownToDoc('[Self link](barkdown://doc/note)')),f=fixture(source),before=fs.readFileSync(path.join(f.sourceDir,'documents/note.json'));
  const m=prepareMigration(f);assert.equal(m.status,'prepared');assert.deepEqual(m.documents[0].references,[{sourceId:'note',targetId:m.documents[0].targetId,target:'Native defaults'}]);assert.deepEqual(fs.readFileSync(path.join(f.sourceDir,'documents/note.json')),before);
});
test('custom link values are retained in blocked backups and staging performs no target access',async()=>{
  for(const [key,value] of [['target','_self'],['target',null],['rel','nofollow'],['rel',null],['class','special'],['class',''],['title','A meaningful tooltip'],['title',''],['download',true]]){
    const source=native(markdownToDoc('[Keep link](https://example.org)'));source.content[0].content[0].marks[0].attrs[key]=value;
    const f=fixture(source),file=path.join(f.sourceDir,'documents/note.json'),bytes=fs.readFileSync(file);let accesses=0;
    await assert.rejects(stageMigration(f,{profileId:f.profileId,runtimeId:'private',server:'http://127.0.0.1:1',dataset:'production',token:'not-used',assertOwned(){accesses++;return true;}}),{code:'preflight_blocked'});
    assert.equal(accesses,0,key);assert.deepEqual(fs.readFileSync(file),bytes);assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/documents/note.json')),bytes);
  }
});
test('null list marker type is eligible recursively; custom or malformed markers never disappear',()=>{
  const source=native(markdownToDoc('1. First\n2. Second'));assert.deepEqual(inspectContent(source),[]);
  const nested={type:'doc',content:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Parent'}]},source.content[0]]}]}]};assert.deepEqual(inspectContent(nested),[]);
  for(const value of ['1','a','A','i','I','',false,1,{},[]]){const changed=structuredClone(nested);changed.content[0].content[0].content[1].attrs.type=value;assert.ok(inspectContent(changed).some(i=>/marker type/.test(i.reason)),JSON.stringify(value));}
  const changed=structuredClone(source);changed.content[0].attrs.start=7;assert.ok(inspectContent(changed).some(i=>/List start/.test(i.reason)));
});
test('foreign attributes and non-link mark metadata still refuse even when values are null',()=>{
  const source=native(markdownToDoc('**Keep bold**'));source.content[0].content[0].marks[0].attrs={class:null};assert.ok(inspectContent(source).some(i=>/Unmapped mark/.test(i.reason)));
  const linked=native(markdownToDoc('[Link](https://example.org)'));linked.content[0].content[0].marks[0].attrs.foreign=null;assert.ok(inspectContent(linked).some(i=>/foreign/.test(i.reason)));
});
