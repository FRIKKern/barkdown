import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { projectWorkspace, projectOwnedWorkspace } = require('../main/migration-workspace');
const { inventoryProfile, prepareMigration } = require('../main/migration-preflight');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-workspace-projection-')),profileId=crypto.randomUUID(),sourceDir=path.join(root,profileId);
  fs.mkdirSync(path.join(sourceDir,'documents'),{recursive:true});
  for(const id of ['alpha','beta']) fs.writeFileSync(path.join(sourceDir,'documents',id+'.json'),JSON.stringify({id,title:id.toUpperCase(),rev:4,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Owned '+id}]}]},history:[{rev:2,actor:'human'}]}));
  const chat=(id,extra={})=>({id,title:id,messages:[{role:'assistant',text:'alpha is still literal text',events:[{target:{kind:'doc',id:'alpha',source:'local'},revision:4}]}],events:[{target:{kind:'doc',id:'beta',source:'local'},revision:4}],tabs:[],active:null,closedTargets:['web:example.org'],runId:null,draft:'barkdown://doc/alpha must stay literal',draftImages:[{id:'image-1',path:'C:/retained/alpha.png'}],folder:'C:/writing',...extra});
  const ws={version:1,profileId,generation:7,chats:{main:chat('main',{tabs:[{id:'doc-path',type:'doc',source:'local',path:['alpha','beta'],title:'My label',scroll:123},{id:'cloud',type:'doc',source:'barkpark',path:['alpha'],title:'Different cloud Alpha'},{id:'side-tab',type:'chat',sideChatId:'side'},{id:'file',type:'project',file:'C:/writing/alpha.js',path:[]}],active:'doc-path'}),side:chat('side',{parent:'main',parentTitle:'main',side:true,draft:'Independent side draft',tabs:[{id:'side-doc',type:'doc',path:['beta'],title:'Beta'}],active:'side-doc'})},order:['side','main'],current:'main',mode:'document',directTab:{id:'direct-doc',type:'doc',path:['alpha'],source:'local',title:'Alpha'},favorites:[{id:'fav-local',label:'My alpha bookmark',chatId:'side',target:{kind:'doc',id:'alpha',source:'local',title:'Alpha'}},{id:'fav-cloud',target:{kind:'doc',id:'alpha',source:'barkpark'}},{id:'fav-side',target:{kind:'chat',id:'side'}}],pages:{layoutVersion:2,seeded:true,roots:['alpha','bp:alpha'],children:{alpha:['beta']},expanded:{alpha:true,beta:false,'bp:alpha':false},archiveOpen:true,archiveFilter:'alpha',cloudArchiveOpen:false,cloudArchiveFilter:'kept',cloudLayoutMigration:{previousRoots:['alpha','bp:alpha'],moved:['bp:alpha']}},ownership:{version:1,revision:8,attempts:{done:{driverFinished:true,history:[{text:'alpha'}],paperRevision:4}},deletedChats:{}},foreign:{path:['alpha'],source:'local'}};
  const options={profileId,sourceDir,destinationDir:path.join(root,'backup'),quiesced:true};
  const write=()=>fs.writeFileSync(path.join(sourceDir,'workspace.json'),JSON.stringify(ws));write();
  return {options,ws,write,id:id=>'local-'+digest(JSON.stringify([profileId,id])).slice(0,32)};
}

test('exact typed paths map while human order, cloud identity and opaque history remain intact',()=>{
  const f=fixture(),before=structuredClone(f.ws),source=inventoryProfile(f.options);prepareMigration(f.options);
  const actual=projectWorkspace(f.options),again=projectWorkspace(f.options);assert.deepEqual(actual,again);assert.equal(actual.status,'preview');assert.equal(actual.authority,'legacy');assert.equal(actual.activationAllowed,false);assert.equal(actual.sourceHash,source.sourceHash);
  const expected=structuredClone(before);expected.chats.main.tabs[0].source='barkpark';expected.chats.main.tabs[0].path=[f.id('alpha'),f.id('beta')];expected.chats.side.tabs[0].source='barkpark';expected.chats.side.tabs[0].path=[f.id('beta')];expected.directTab.source='barkpark';expected.directTab.path=[f.id('alpha')];expected.favorites[0].target.id=f.id('alpha');expected.favorites[0].target.source='barkpark';expected.pages.roots=['bp:'+f.id('alpha'),'bp:alpha'];expected.pages.children={['bp:'+f.id('alpha')]:['bp:'+f.id('beta')]};expected.pages.expanded={['bp:'+f.id('alpha')]:true,['bp:'+f.id('beta')]:false,'bp:alpha':false};
  assert.deepEqual(actual.workspace,expected);assert.deepEqual(f.ws,before);assert.match(actual.projectionHash,/^[a-f0-9]{64}$/);assert.equal(actual.workspaceHash,digest(source.files.find(x=>x.path==='workspace.json').data));assert.equal(actual.changes.length,11);
  for(const file of source.files){assert.deepEqual(fs.readFileSync(path.join(f.options.sourceDir,file.path)),file.data);assert.deepEqual(fs.readFileSync(path.join(f.options.destinationDir,'source',file.path)),file.data);}
});

test('empty document pickers stay empty; non-document paths and missing optional collections are not invented',()=>{
  const f=fixture();f.ws.chats.main.tabs.push({id:'picker',type:'doc',source:'local',path:[]});delete f.ws.chats.side.tabs;delete f.ws.favorites;delete f.ws.directTab;f.write();const p=projectWorkspace(f.options);assert.equal(p.status,'preview');assert.deepEqual(p.workspace.chats.main.tabs.at(-1),f.ws.chats.main.tabs.at(-1));assert.equal(Object.hasOwn(p.workspace,'favorites'),false);assert.equal(Object.hasOwn(p.workspace.chats.side,'tabs'),false);
});
test('a direct tab saved as its id, as the window saves it, passes through',()=>{const f=fixture();f.ws.directTab='direct-doc';f.write();const p=projectWorkspace(f.options);assert.equal(p.status,'preview');assert.equal(p.workspace.directTab,'direct-doc');});

test('profile-qualified projections never substitute another profile with matching slugs',()=>{
  const a=fixture(),b=fixture();const pa=projectWorkspace(a.options),pb=projectWorkspace(b.options);assert.notEqual(pa.projectionHash,pb.projectionHash);assert.notDeepEqual(pa.documentMap,pb.documentMap);b.ws.profileId=a.options.profileId;b.write();const rejected=projectWorkspace(b.options);assert.equal(rejected.status,'blocked');assert.match(rejected.issues[0].reason,/different profile/);
});

const refusals=[
 ['unknown ordered chat',f=>f.ws.order.push('missing'),/missing chat/],
 ['duplicate ordered chat',f=>f.ws.order.push('main'),/Duplicate conversation order/],
 ['omitted ordered chat',f=>f.ws.order=['main'],/order would be changed/],
 ['missing current chat',f=>f.ws.current='gone',/Current conversation is missing/],
 ['reserved chat key',f=>{f.ws.chats.constructor={id:'constructor',messages:[]};f.ws.order.push('constructor');},/Reserved conversation identity/],
 ['invalid chat key',f=>{f.ws.chats['bad/key']={id:'bad/key',messages:[]};f.ws.order.push('bad/key');},/Invalid destination identity/],
 ['unknown local tab',f=>f.ws.chats.main.tabs[0].path.push('gone'),/Missing local/],
 ['unknown favorite',f=>f.ws.favorites[0].target.id='gone',/Missing local/],
 ['missing Page',f=>f.ws.pages.roots.push('gone'),/Missing local/],
 ['source-less closed local',f=>f.ws.chats.main.closedTargets.push('doc:alpha'),/omits source/],
 ['source-less closed cloud',f=>f.ws.chats.main.closedTargets.push('doc:other-cloud'),/omits source/],
 ['unknown source',f=>f.ws.directTab.source='other',/Unknown document source/],
 ['malformed path',f=>f.ws.directTab.path='alpha',/ordered path/],
 ['duplicate placement',f=>f.ws.pages.roots.push('beta'),/more than one/],
 ['cycle',f=>{f.ws.pages.roots=['bp:alpha'];f.ws.pages.children={alpha:['beta'],beta:['alpha']};},/Cyclic/],
 ['orphan parent',f=>{f.ws.pages.roots=['bp:alpha'];},/Unplaced parent/],
 ['unknown layout',f=>f.ws.pages.layoutVersion=3,/initialized v2/],
 ['unseeded layout',f=>f.ws.pages.seeded=false,/initialized v2/],
 ['bad expansion',f=>f.ws.pages.expanded.alpha='true',/expansion\/archive state/],
 ['projected cloud collision',f=>f.ws.pages.roots.push('bp:'+f.id('alpha')),/collides/],
 ['expansion collision',f=>f.ws.pages.expanded['bp:'+f.id('alpha')]=false,/collide/],
 ['old pins',f=>f.ws.pins=[{id:'old',tabs:[]}],/Legacy pins/],
 ['recorded run',f=>f.ws.chats.main.runId='running',/recorded run/],
 ['unfinished attempt',f=>f.ws.ownership.attempts.done.driverFinished=false,/Unfinished attempt/],
 ['bad ownership',f=>f.ws.ownership='unknown',/ownership ledger/],
 ['dotted local tab',f=>f.ws.chats.main.tabs[0].path.push('drafts.alpha'),/Invalid destination identity/],
 ['dotted local favorite',f=>f.ws.favorites[0].target.id='drafts.alpha',/Invalid destination identity/],
 ['other dotted Paper id',f=>f.ws.chats.main.tabs[1].path=['notes.alpha'],/Invalid destination identity/],
 ['dotted Page key',f=>f.ws.pages.roots.push('bp:other.alpha'),/Invalid destination identity/],
 ['unplaced local archive',f=>{delete f.ws.pages.children.alpha;},/local-Paper archive adapter/],
];
for(const [name,mutate,reason] of refusals)test(name+' refuses without partial projection or filesystem mutation',()=>{
  const f=fixture();mutate(f);f.write();const before=inventoryProfile(f.options),value=projectWorkspace(f.options);assert.equal(value.status,'blocked');assert.match(value.issues[0].reason,reason);assert.equal(value.workspace,null);assert.deepEqual(value.changes,[]);assert.equal(value.projectionHash,undefined);assert.equal(inventoryProfile(f.options).sourceHash,before.sourceHash);assert.equal(fs.existsSync(f.options.destinationDir),false);
});

test('source content blockers are carried forward without a candidate',()=>{const f=fixture();const p=path.join(f.options.sourceDir,'documents/alpha.json');const d=JSON.parse(fs.readFileSync(p));d.content.content[0].attrs={custom:true};fs.writeFileSync(p,JSON.stringify(d));const value=projectWorkspace(f.options);assert.equal(value.status,'blocked');assert.equal(value.workspace,null);assert.ok(value.issues.some(i=>i.file==='documents/alpha.json'));});

test('archive marker keys preserve their exact state without moving unplaced cloud papers',()=>{const f=fixture();f.ws.pages.archived={alpha:false,'bp:unplaced-cloud':true};f.write();const value=projectWorkspace(f.options);assert.equal(value.status,'preview');assert.deepEqual(value.workspace.pages.archived,{['bp:'+f.id('alpha')]:false,'bp:unplaced-cloud':true});assert.deepEqual(value.workspace.pages.cloudLayoutMigration,f.ws.pages.cloudLayoutMigration);});

test('the implicit direct workspace may remain outside recent-chat order',()=>{const f=fixture();f.ws.chats.direct={id:'direct',messages:[],tabs:[structuredClone(f.ws.directTab)]};f.write();const p=projectWorkspace(f.options);assert.equal(p.status,'preview');assert.deepEqual(p.workspace.order,f.ws.order);assert.deepEqual(p.workspace.chats.direct.tabs[0],p.workspace.directTab);});

function ownedFixture() {
  const f = fixture();
  f.target = { profileId: f.options.profileId, runtimeId: 'owned-runtime', server: 'http://127.0.0.1:49152', dataset: 'production', token: 'private-fixture-token', assertOwned: async () => true };
  f.owner = require('../main/paper-evidence-owner').createPaperEvidenceOwner(require('../main/store').createStore(f.options.sourceDir, { create: false })).identify({ ...f.target, viaCli: false }, { create: true });
  f.key = id => 'bp:v1:' + f.owner + ':' + f.id(id);
  return f;
}

test('owned projection preserves nested Pages, Archive, labels and destination ownership without writes', async () => {
  const f = ownedFixture(), foreign = 'bp:v1:' + 'b'.repeat(64) + ':foreign';
  f.ws.pages.roots.push(foreign); f.ws.pages.labels = { alpha: 'Human title', beta: 'Archive label', [foreign]: 'Other library' };
  f.ws.pages.children.alpha = []; f.ws.pages.archived = { beta: true };
  f.write(); const before = inventoryProfile(f.options); prepareMigration(f.options);
  const p = await projectOwnedWorkspace(f.options, f.target);
  assert.equal(p.status, 'preview'); assert.equal(p.activationAllowed, false); assert.equal(p.authority, 'legacy');
  assert.deepEqual(p.workspace.pages.roots, [f.key('alpha'), 'bp:alpha', foreign]);
  assert.deepEqual(p.workspace.pages.children, { [f.key('alpha')]: [] });
  assert.deepEqual(p.workspace.pages.archived, { [f.key('beta')]: true });
  assert.deepEqual(p.workspace.pages.labels, { [f.key('alpha')]: 'Human title', [f.key('beta')]: 'Archive label', [foreign]: 'Other library' });
  for (const destination of [p.workspace.directTab, p.workspace.chats.main.tabs[0], p.workspace.chats.side.tabs[0], p.workspace.favorites[0].target]) assert.equal(destination.paperOwner, f.owner);
  assert.deepEqual(p.workspace.chats.main.tabs[1], f.ws.chats.main.tabs[1]);
  assert.deepEqual(p.workspace.favorites[1], f.ws.favorites[1]);
  assert.equal(JSON.stringify(p).includes(f.target.token), false);
  assert.equal(projectWorkspace(f.options).status, 'blocked');
  for (const file of before.files) {
    assert.deepEqual(fs.readFileSync(path.join(f.options.sourceDir, file.path)), file.data);
    assert.deepEqual(fs.readFileSync(path.join(f.options.destinationDir, 'source', file.path)), file.data);
  }
  f.ws.pages.children.alpha = ['beta']; f.write();
  const nested = await projectOwnedWorkspace(f.options, f.target);
  assert.deepEqual(nested.workspace.pages.children, { [f.key('alpha')]: [f.key('beta')] });
});

test('unknown ownership refuses without creating a key or backup', async () => {
  const f = fixture(), target = { profileId: f.options.profileId, runtimeId: 'owned', server: 'http://127.0.0.1:49152', token: 'private', dataset: 'production', assertOwned: async () => true };
  const before = inventoryProfile(f.options).sourceHash;
  await assert.rejects(projectOwnedWorkspace(f.options, target), /ownership is unknown/);
  assert.equal(inventoryProfile(f.options).sourceHash, before);
  assert.equal(fs.existsSync(path.join(f.options.sourceDir, 'agent-edits')), false);
  assert.equal(fs.existsSync(f.options.destinationDir), false);
});

test('lost lease and source changes during asynchronous ownership checks refuse', async () => {
  const f = ownedFixture(); let calls = 0;
  await assert.rejects(projectOwnedWorkspace(f.options, { ...f.target, assertOwned: async () => ++calls === 1 }), /ownership|owned|runtime/i);
  calls = 0;
  await assert.rejects(projectOwnedWorkspace(f.options, { ...f.target, assertOwned: async () => {
    if (++calls === 2) { f.ws.chats.main.draft = 'Later human draft'; f.write(); }
    return true;
  } }), /changed during projection/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.options.sourceDir, 'workspace.json'))).chats.main.draft, 'Later human draft');
});

test('projection identity binds runtime and connection; foreign profile refuses', async () => {
  const f = ownedFixture(), a = await projectOwnedWorkspace(f.options, f.target);
  const b = await projectOwnedWorkspace(f.options, { ...f.target, runtimeId: 'replacement' });
  assert.notEqual(a.projectionHash, b.projectionHash); assert.equal(a.paperOwner, b.paperOwner);
  const c = await projectOwnedWorkspace(f.options, { ...f.target, token: 'other-library' });
  assert.notEqual(a.paperOwner, c.paperOwner); assert.notEqual(a.projectionHash, c.projectionHash);
  await assert.rejects(projectOwnedWorkspace(f.options, { ...f.target, profileId: crypto.randomUUID() }), /profile/i);
});

test('owned state-map collisions and uninitialized Pages refuse instead of auto-organizing', async () => {
  const f = ownedFixture(); f.ws.pages.labels = { alpha: 'One', [f.key('alpha')]: 'Two' }; f.write();
  let p = await projectOwnedWorkspace(f.options, f.target); assert.equal(p.status, 'blocked'); assert.match(p.issues[0].reason, /collide/);
  delete f.ws.pages; f.write(); p = await projectOwnedWorkspace(f.options, f.target);
  assert.equal(p.status, 'blocked'); assert.match(p.issues[0].reason, /initialized Pages/);
});

// A note created on the local runtime before the switch is drafts.<id>: it stays a Paper destination (C096).
test('Paper notes on the local runtime (drafts.<id>) in tabs, favorites and Pages project unchanged',()=>{
  const f=fixture();
  f.ws.chats.main.tabs.push({id:'draft-tab',type:'doc',source:'barkpark',path:['drafts.note-1']});
  f.ws.favorites.push({id:'fav-draft',target:{kind:'doc',id:'drafts.note-1',source:'barkpark'}});
  f.ws.pages.roots.push('bp:drafts.note-1','bp:v1:'+'a'.repeat(64)+':drafts.note-2');
  f.write();prepareMigration(f.options);
  const value=projectWorkspace(f.options);
  assert.equal(value.status,'preview',JSON.stringify(value.issues));
  assert.deepEqual(value.workspace.chats.main.tabs.at(-1).path,['drafts.note-1']);
  assert.equal(value.workspace.favorites.at(-1).target.id,'drafts.note-1');
  assert.ok(value.workspace.pages.roots.includes('bp:drafts.note-1'));
  assert.ok(value.workspace.pages.roots.includes('bp:v1:'+'a'.repeat(64)+':drafts.note-2'));
});
