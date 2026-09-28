import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { createAnthropicFixture } from './fixtures/anthropic-http.mjs';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-goals-'));
const shots=path.resolve('test-results/profile-goals');fs.mkdirSync(shots,{recursive:true});
const transport = await createAnthropicFixture();
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN:'', ANTHROPIC_BASE_URL:transport.url } });
const page = await app.firstWindow(), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const owner = await page.evaluate(async () => {
    await window.barkdown.settings.set({ provider: 'api', apiKey: 'fixture-unused' });
    const state = window.__barkdown.state, chat = state.chats[state.current]; chat.provider = 'api'; chat.draft = 'Coordinator draft';
    const ws = { version: 1, profileId: state.profileId, generation: state.generation, chats: state.chats, order: state.order, current: state.current };
    await window.barkdown.state.save(ws);
    return { profileId: state.profileId, generation: state.generation, chatId: chat.id };
  });
  await page.keyboard.press(`${MOD}+k`); await page.locator('#bw-palette-input').fill('Conversation goals'); await page.keyboard.press('Enter');
  await page.locator('.bw-goals').waitFor();
  await page.locator('[name="objective"]').fill('Prove saved parallel worker conversations');
  await page.locator('[name="planning"]').selectOption('manual');
  for (let n = 1; n <= 3; n++) await page.locator(`[name="worker${n}"]`).fill(`Return fixture result ${n}`);
  await page.locator('[data-create] button').click();
  await page.locator('[data-command="start"]').click();
  await page.waitForFunction(() => Object.values(window.__barkdown.state.chats).filter(c => c.goalId).length === 3);
  const goal = await page.evaluate(async owner => (await window.barkdown.goals.list(owner))[0], owner);
  await page.locator(`[data-chat="${goal.tasks[0].chatId}"]`).click();
  await page.waitForFunction(id => window.__barkdown.state.current === id, goal.tasks[0].chatId);
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('started.'));
  transport.gates.get(1).text('Live update. ');
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('Live update.'));
  await page.screenshot({path:path.join(shots,'owned-worker-live.png')});
  for(let i=0;i<100&&transport.gates.size!==3;i++)await new Promise(r=>setTimeout(r,50));
  assert.equal(transport.gates.size, 3);
  const second = await page.evaluate(async () => window.barkdown.profiles.create('Background proof'));
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, second.id);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, second.id);
  await page.evaluate(async () => { const ws = await window.barkdown.state.load(); ws.chats.b = { id: 'b', title: 'B draft', draft: 'Untouched B', messages: [], tabs: [] }; ws.order = ['b']; ws.current = 'b'; await window.barkdown.state.save(ws); });
  for(const gate of transport.gates.values())gate.release();
  const aStore=path.join(userData,'profile-data','profiles',owner.profileId);
  for(let i=0;i<100;i++){const ws=JSON.parse(fs.readFileSync(path.join(aStore,'workspace.json')));if(Object.values(ws.ownership.attempts).every(a=>a.driverFinished))break;await new Promise(r=>setTimeout(r,50));}
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, owner.profileId);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, owner.profileId);
  const saved = await page.evaluate(async () => window.barkdown.state.load());
  for (const task of goal.tasks) {
    assert.equal(saved.chats[task.chatId].parent, owner.chatId);
    assert.match(saved.chats[task.chatId].messages.at(-1).text, /Finished/);
    assert.equal(saved.chats[task.chatId].runId, null);
  }
  assert.equal(saved.chats[owner.chatId].draft, 'Coordinator draft');
  assert.deepEqual(errors, []);
  await page.evaluate(id=>window.__barkdown.switchChat(id),owner.chatId);
  await page.keyboard.press(`${MOD}+k`);await page.locator('#bw-palette-input').fill('Conversation goals');await page.keyboard.press('Enter');
  await page.locator('.bw-goals').waitFor();
  await page.locator('.bw-goals').evaluate(node=>Promise.all(node.getAnimations().map(a=>a.finished.catch(()=>{}))));
  await page.screenshot({path:path.join(shots,'owned-results-review.png')});
  const receipts=fs.readdirSync(path.join(aStore,'goal-processes')).filter(f=>f.endsWith('.receipt.json')).map(f=>JSON.parse(fs.readFileSync(path.join(aStore,'goal-processes',f))));
  assert.equal(receipts.length,3);assert.ok(receipts.every(r=>r.phase==='stopped'&&r.activeProcesses===0));
  console.log(JSON.stringify({ passed: ['palette goal creation', 'three actual SDK loops in owned Windows jobs with deterministic HTTP', 'open worker live text', 'late A transcripts while B selected', 'saved parent and coordinator draft', 'three stopped process receipts'], userData }));
} finally { await app.close(); await transport.close(); }
