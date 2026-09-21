import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-goals-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow(), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await app.evaluate(({ app }) => {
    const fixtureRequire = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
    const agent = fixtureRequire('./main/agent');
    globalThis.workerGates = [];
    agent.setClientFactory(() => ({ messages: { stream(params) {
      const handlers = {}, number = globalThis.workerGates.length + 1;
      let release; const gate = new Promise(resolve => { release = resolve; });
      globalThis.workerGates.push({ release, text: text => handlers.text?.(text) });
      return { on(name, fn) { handlers[name] = fn; return this; }, async finalMessage() {
        handlers.text(`Worker ${number} started. `); await gate; handlers.text(`Finished ${number}.`);
        return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: `Worker ${number} started. Finished ${number}.` }] };
      } };
    } } }));
  });
  const owner = await page.evaluate(async () => {
    await window.barkdown.settings.set({ provider: 'api', apiKey: 'fixture-unused' });
    const state = window.__barkdown.state, chat = state.chats[state.current]; chat.provider = 'api'; chat.draft = 'Coordinator draft';
    const ws = { version: 1, profileId: state.profileId, generation: state.generation, chats: state.chats, order: state.order, current: state.current };
    await window.barkdown.state.save(ws);
    return { profileId: state.profileId, generation: state.generation, chatId: chat.id };
  });
  await page.keyboard.press('Control+k'); await page.locator('#bw-palette-input').fill('Conversation goals'); await page.keyboard.press('Enter');
  await page.locator('.bw-goals').waitFor();
  await page.locator('[name="objective"]').fill('Prove saved parallel worker conversations');
  for (let n = 1; n <= 3; n++) await page.locator(`[name="worker${n}"]`).fill(`Return fixture result ${n}`);
  await page.locator('[data-create] button').click();
  await page.locator('[data-command="start"]').click();
  await page.waitForFunction(() => Object.values(window.__barkdown.state.chats).filter(c => c.goalId).length === 3);
  const goal = await page.evaluate(async owner => (await window.barkdown.goals.list(owner))[0], owner);
  await page.locator(`[data-chat="${goal.tasks[0].chatId}"]`).click();
  await page.waitForFunction(id => window.__barkdown.state.current === id, goal.tasks[0].chatId);
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('started.'));
  await app.evaluate(() => { globalThis.workerGates[0].text('Live update. '); });
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('Live update.'));
  assert.equal(await app.evaluate(() => globalThis.workerGates.length), 3);
  const second = await page.evaluate(async () => window.barkdown.profiles.create('Background proof'));
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, second.id);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, second.id);
  await page.evaluate(async () => { const ws = await window.barkdown.state.load(); ws.chats.b = { id: 'b', title: 'B draft', draft: 'Untouched B', messages: [], tabs: [] }; ws.order = ['b']; ws.current = 'b'; await window.barkdown.state.save(ws); });
  await app.evaluate(() => { globalThis.workerGates.forEach(gate => gate.release()); });
  await page.waitForTimeout(150);
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
  console.log(JSON.stringify({ passed: ['palette goal creation', 'three provider loops', 'open worker live text', 'late A transcripts while B selected', 'saved parent and coordinator draft'], userData }));
} finally { await app.close(); }
