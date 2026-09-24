// Actual Electron + SDK + owned Paper runtime; model responses are scripted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required');
const appDir = path.resolve('.'), root = path.resolve('..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-agent-note-native-'));
const out = path.join(root, process.env.BARKDOWN_EDITOR_CAPTURE === '1' ? 'docs/visual/agent-notes/runs' : 'app/test-results/agent-notes', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const manifest = { host: git(['rev-parse','HEAD']), upstream: git(['rev-parse','HEAD'],source), sourceDirty: git(['status','--porcelain','--','app']) !== '', model: 'Scripted SSE through actual API SDK; not live model proof', theme: 'dark', frames: [], results: [], errors: [], failure: null };
const requestId = crypto.randomUUID(), id = 'drafts.bd-note-' + requestId, title = 'A notebook we share';
const original = 'Saffron notes keep the words we wrote.', replacement = 'The assistant clarified this paragraph.';
const transport = await createToolFixture((body, index) => {
  const result = body.messages.at(-1).content?.find?.(b => b.type === 'tool_result');
  if ([1,3,4,6,7].includes(index)) assert(result && !result.is_error, JSON.stringify(result));
  if (index === 0) return { name:'create_document', input:{title, markdown:original, requestId} };
  if (index === 1) { assert.match(result.content, new RegExp('Created document bp:' + id)); return {text:'Your Paper note is ready.'}; }
  if (index === 2 || index === 5) return { name:'read_document', input:{id:'bp:'+id,format:'structured'} };
  if (index === 3) { assert.equal(JSON.parse(result.content).blocks[0].locked,true); return {name:'edit_document',input:{id:'bp:'+id,mode:'replace',markdown:replacement,summary:'Clarify the paragraph'}}; }
  if (index === 4) return {text:'The paragraph is updated. Undo is available.'};
  if (index === 6) return {name:'edit_document',input:{id:'bp:'+id,mode:'append',markdown:'One assistant addition.',summary:'Add one thought'}};
  if (index === 7) return {text:'Added one thought.'};
  throw Error('Unexpected model turn ' + index);
});
let app, page, video, owner, profileA;
const launch = async () => {
  app = await electron.launch({ executablePath:require('electron'), args:[appDir,'--profiles','--user-data='+userData], recordVideo:{dir:out,size:{width:1400,height:900}}, timeout:180000,
    env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:'',ANTHROPIC_BASE_URL:transport.url} });
  page=await app.firstWindow({timeout:180000}); video=page.video(); page.setDefaultTimeout(30000);
  page.on('pageerror',e=>manifest.errors.push(e.message));
  await page.waitForFunction(()=>window.__barkdown?.state.loaded,null,{timeout:180000});
  await page.setViewportSize({width:1400,height:900});
};
const close = async name => { await app.close(); app=null; if(video)fs.renameSync(await video.path(),path.join(out,name+'.webm')); };
const shot = async name => { assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark'); await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:path.join(out,name+'.png')}); manifest.frames.push(name+'.png'); };
const configure = () => page.evaluate(async source => { const b=window.__barkdown; b.state.settings=await window.barkdown.settings.set({theme:'dark',provider:'api',apiKey:'synthetic-fixture',barkpark:{enabled:true,writes:true,viaCli:false,local:{enabled:true,source}}}); b.state.chats[b.state.current].provider='api'; document.documentElement.dataset.theme='dark'; b.render(); },source);
const send = async text => { await page.waitForFunction(()=>!window.__barkdown.state.chats[window.__barkdown.state.current].runId); await page.locator('#bw-prompt').fill(text); await page.locator('#bw-prompt').press('Enter'); };
const editor = () => page.locator('.bw-paper-pane:not([hidden]) .ProseMirror');
const visible = async text => { await page.waitForFunction(text=>document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent.includes(text),text,{timeout:90000}); await page.waitForFunction(()=>!document.querySelector('[data-agent-phase]')); };
const read = () => page.evaluate(({id,owner})=>window.barkdown.barkpark.get(id,undefined,owner),{id,owner});
const select = async profileId => { await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(profileId); await page.locator('#profile-switch').click(); await page.waitForFunction(id=>window.__barkdown?.state.loaded&&window.__barkdown.state.profileId===id,profileId,{timeout:180000}); };
try {
  await launch(); await configure(); profileA=await page.evaluate(()=>window.__barkdown.state.profileId);
  await send('Create a Paper note for our shared notebook.');
  await visible(original); // Activity must open it; no openDirect helper repairs this assertion.
  const target=await page.evaluate(()=>{const s=window.__barkdown.state,c=s.chats[s.current];return c.tabs.find(t=>t.id===c.active);});
  assert.equal(target.path.at(-1),id); assert.equal(target.source,'barkpark'); owner=target.paperOwner; assert.match(owner,/^[a-f0-9]{64}$/);
  const before=await read(); assert.equal(before.title,title); assert(before.markdown.includes(original));
  await shot('01-created-through-chat');
  await send('Clarify the paragraph, preserving the title.'); await visible(replacement);
  await page.locator('.bw-paper-pane:not([hidden]) #agent-edit button').waitFor();
  assert.deepEqual((await read()).blocks[0],before.blocks[0]); await shot('02-agent-edit-with-undo');
  await page.setViewportSize({width:820,height:900}); await shot('03-narrow-agent-edit'); await page.setViewportSize({width:1400,height:900});
  const profileB=(await page.evaluate(()=>window.barkdown.profiles.create('Another notebook'))).id;
  await select(profileB); await configure();
  const twin=await page.evaluate(requestId=>window.barkdown.barkpark.createNote(requestId),requestId);
  assert.equal(twin.id,id); assert.notEqual(twin.paperOwner,owner); assert(!twin.markdown.includes(replacement));
  assert(await page.evaluate(async ({id,owner})=>{try{await window.barkdown.barkpark.get(id,undefined,owner);return false;}catch{return true;}},{id,owner}));
  await select(profileA); await visible(replacement); // Saved conversation restores its own tab.
  await page.waitForFunction(()=>!window.__barkdown.state.chats[window.__barkdown.state.current].runId);
  await close('create-edit-profile-switch');
  await launch(); assert.equal(await page.evaluate(()=>window.__barkdown.state.profileId),profileA);
  await visible(replacement); await shot('04-restarted-with-undo');
  await page.locator('.bw-paper-pane:not([hidden]) #agent-edit button').click(); await visible(original);
  assert.deepEqual((await read()).blocks,before.blocks); await shot('05-undone-after-restart');
  await send('Add one thought to the note.'); await visible('One assistant addition.');
  const saved=await read();
  const receipt=await page.evaluate(({id,binding})=>window.barkdown.docs.agentEdit('bp:'+id,binding),{id,binding:saved.binding});
  await editor().locator('p').last().click(); await page.keyboard.press('End'); await page.keyboard.type(' Human finishing touch.');
  await page.waitForFunction(()=>document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent.startsWith('Saved · rev')&&!document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')?.hasPendingChanges());
  const human=await read(); assert(human.markdown.includes('Human finishing touch.'));
  const refused=await page.evaluate(async ({id,editId,binding})=>{try{await window.barkdown.docs.undoAgentEdit('bp:'+id,editId,binding);return '';}catch(error){return error.message;}},{id,editId:receipt.id,binding:human.binding});
  assert.match(refused,/changed since it was read/); assert.deepEqual((await read()).blocks,human.blocks); await shot('06-human-edit-protected');
  assert.deepEqual(manifest.errors,[]); assert.deepEqual(transport.errors,[]); assert.equal(transport.requests.length,8);
  manifest.results.push('Actual SDK creates and opens the exact owned Paper note through chat activity; agent replacement preserves locked title',
    'Same-ID second profile remains isolated; return and restart preserve original note and durable Undo',
    'Native Undo after restart restores exact blocks; a later human edit blocks stale Undo without overwriting content');
  console.log('PASS',manifest.results);
} catch(error) { manifest.failure=error.stack; if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{}); throw error; }
finally {
  if(app)await close('restart-undo-human-edit'); await transport.close();
  manifest.artifacts=Object.fromEntries(fs.readdirSync(out).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')]));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n'); console.log('Native agent-note evidence:',out,'Retained data:',userData);
}
