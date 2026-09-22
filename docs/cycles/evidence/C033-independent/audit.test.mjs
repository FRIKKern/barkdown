import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Frikk/.codex/worktrees/barkdown-integration-12h/app/tests/context-reservation.test.mjs');
const { createProfileRegistry } = require('../main/profile-registry'), { createProfileService } = require('../main/profile-service'), { createGoalProvider } = require('../main/goal-provider');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-context-reservation-')), registry = createProfileRegistry(root), profile = registry.createProfile({ name: 'Fixture' });
  let unblock, options, dispatches = 0, releases = 0;
  const settings = { provider: 'api', model: 'captured-default', barkpark: { local: { enabled: true } } };
  const folder = path.join(root, 'working'); fs.mkdirSync(folder);
  const agent = { async start(value) { dispatches++; options = value; return { runId: 'fixture-run' }; }, async waitForRunFinish() {
    options.send({ type: 'done', profileId: profile.id, chatId: 'worker', runId: 'fixture-run', provider: options.provider, sequence: 1, session: 'CAPTURED-A-SESSION' });
    await options.onFinish(); return { runId: 'fixture-run', profileId: profile.id, chatId: 'worker', status: 'succeeded' };
  }, cancel() {} };
  const profiles = createProfileService({ registry, settingsFor: () => settings, runtimePool: { acquire: () => new Promise(resolve => { unblock = () => resolve({ connection: { enabled: false }, release: async () => { releases++; } }); }) }, agent });
  const owner = profiles.view(); profiles.save(owner, { version: 1, chats: { main: { id: 'main', title: 'Goal', folder: 'C:/captured-A', provider: 'api', messages: [], draft: 'coordinator draft' } }, order: ['main'] });
  const goal = { id: crypto.randomUUID(), profileId: profile.id, chatId: 'main' };
  profiles.workspaces.stageWorkerChats(goal, [{ chatId: 'worker', title: 'Worker', folder: 'C:/captured-A', provider: 'api' }]);
  let ws = profiles.load(owner); ws.chats.worker.draft = 'human worker draft'; profiles.save(owner, ws);
  const request = { profileId: profile.id, chatId: 'worker', attemptId: crypto.randomUUID(), prompt: 'bounded fixture', images: [], provider: 'api', goalId: goal.id, taskId: 'task-1', coordinatorChatId: 'main', context: { folder: 'C:/captured-A', provider: 'api', model: null, effort: null, session: null }, deadline: Date.now() + 60000 };
  return { profiles, owner, request, agent, settings, folder, options: () => options, writeOwned: ws => registry.storeFor(profile.id).writeJson('workspace.json', ws), unblock: () => unblock(), ready: () => Boolean(unblock), dispatches: () => dispatches, releases: () => releases };
}

const cases = ['effort', 'raw-model', 'raw-effort', 'raw-provider', 'parent', 'delete-resurrect', 'delete-restage', 'settings-defaults', 'folder-missing', 'folder-recreated', 'model-away-back', 'effort-away-back', 'raw-default-no-change'];
for (const mode of ['ordinary', 'goal']) for (const change of cases) test(`${mode}: ${change}`, async () => {
 const f=fixture();
 let ws=f.profiles.load(f.owner); const c=ws.chats.worker;
 c.folder=f.folder;
 if (change.startsWith('folder-')) c.provider='codex';
 if (change.startsWith('raw-') || change==='settings-defaults') {c.provider=null;c.model=null;c.effort=null;}
 f.profiles.save(f.owner,ws);
 f.request.context={folder:f.folder,provider:c.provider || 'api',model:c.model || null,effort:c.effort || null,session:null};
 f.request.provider=f.request.context.provider;
 const pending=mode==='ordinary'?f.profiles.start(f.owner,{chatId:'worker',prompt:'offline controlled',provider:f.request.provider,attemptId:f.request.attemptId}):createGoalProvider({agent:f.agent,resolve:f.profiles.resolve,transcripts:f.profiles.workspaces}).execute(f.request,{signal:new AbortController().signal,progress(){}});
 assert(f.ready());
 ws=f.profiles.load(f.owner); const before=structuredClone(ws); ws.chats.worker.draft='newer retained draft';
 const changes={'effort':['effort','high'],'raw-model':['model','captured-default'],'raw-effort':['effort','high'],'raw-provider':['provider','api'],'parent':['parent',null],'model-away-back':['model','temporary'],'effort-away-back':['effort','temporary']};
 if(changes[change])ws.chats.worker[changes[change][0]]=changes[change][1];
 f.profiles.save(f.owner,ws);
 if(change.endsWith('away-back')){ws=f.profiles.load(f.owner);ws.chats.worker[changes[change][0]]=null;f.profiles.save(f.owner,ws);}
 if(change.startsWith('delete-')) {
  ws=f.profiles.load(f.owner);
  f.profiles.workspaces.command(f.request.profileId,{chatId:'worker',type:'delete-chat',expectedRevision:ws.ownership.revision});
  if(change==='delete-resurrect') f.profiles.save(f.owner,before);
  else assert.throws(()=>f.profiles.workspaces.stageWorkerChats({id:f.request.goalId,profileId:f.request.profileId,chatId:'main'},[{chatId:'worker'}]),/deleted/);
 }
 if(change==='settings-defaults') {f.settings.provider='claude';f.settings.model='new-default';f.settings.effort='high';}
 if(change.startsWith('folder-')) {fs.renameSync(f.folder,f.folder+'-preserved');if(change==='folder-recreated')fs.mkdirSync(f.folder);}
 f.unblock();
 const allowed=['settings-defaults','folder-recreated','model-away-back','effort-away-back','raw-default-no-change'].includes(change) || (mode==='goal'&&change==='folder-missing');
 if(allowed){const result=await pending;if(mode==='ordinary')await f.profiles.wait(f.owner,result.runId);assert.equal(f.dispatches(),1);}
 else await assert.rejects(pending,e=>e.code==='BARKDOWN_SEND_NOT_STARTED');
 await new Promise(r=>setImmediate(r));
 ws=f.profiles.load(f.owner);
 assert.equal(f.releases(),1);
 if(!allowed){assert.equal(f.dispatches(),0);assert.equal(Object.keys(ws.ownership.attempts).length,0);}
 if(change.startsWith('delete-')) assert.equal(ws.chats.worker,undefined);
 else assert.equal(ws.chats.worker.draft,'newer retained draft');
 if(change==='settings-defaults'){assert.equal(f.options().provider,'api');assert.equal(f.options().settings.model,'captured-default');}
 console.log(JSON.stringify({mode,change,dispatches:f.dispatches(),releases:f.releases(),attempts:Object.keys(ws.ownership.attempts).length,folder:f.folder}));
});
