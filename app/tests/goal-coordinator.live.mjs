import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createCoordinatorFixture } from './fixtures/coordinator-http.mjs';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url), appDir = path.resolve(import.meta.dirname, '..');
const crashRecovery = process.env.BARKDOWN_TEST_COORDINATOR_CRASH === '1';
const expectedTurns = crashRecovery ? 9 : 8;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-coordinator-live-'));
const out = path.join(appDir, crashRecovery ? 'test-results/goal-coordinator-recovery' : 'test-results/goal-coordinator'); fs.mkdirSync(out, { recursive: true });
const transport = await createCoordinatorFixture({ allowRetries: crashRecovery }), errors = [], shots = [];
let app, page;
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_GOAL_DIAGNOSTICS: '1', BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
  app.process().stderr?.on('data', chunk => { const text = String(chunk); if (text.includes('Goal scheduler halted:')) console.error(text.trim()); });
  page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded); await page.setViewportSize({ width: 1100, height: 800 });
};
async function waitFor(read, predicate, label) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error(`Timed out: ${label}; ${JSON.stringify(await read())}`);
}
async function openGoals() {
  try {
    await page.keyboard.press(`${MOD}+k`);
    const input = page.locator('#bw-palette-input');
    await input.fill('Conversation goals');
    await page.locator('#bw-palette-list [role="option"][aria-selected="true"]').filter({ hasText: 'Conversation goals' }).waitFor();
    // Electron restart can move focus between fill and the key. Address the
    // intended input, and prove the action opened the view before continuing.
    await input.press('Enter');
    await page.locator('.bw-goals').waitFor();
  } catch (error) {
    fs.writeFileSync(path.join(out, 'navigation-failure.json'), JSON.stringify(await page.evaluate(() => ({
      active: document.activeElement?.outerHTML,
      palette: document.querySelector('#bw-palette')?.outerHTML,
      profileId: window.__barkdown?.state.profileId,
      current: window.__barkdown?.state.current,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.outerHTML),
    })), null, 2));
    await page.screenshot({ path: path.join(out, 'navigation-failure.png') });
    throw error;
  }
}
async function capture(name) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ path: path.join(out, name + '.png') }); shots.push(name + '.png');
}
try {
  await launch();
  const owner = await page.evaluate(async () => {
    await window.barkdown.settings.set({ provider: 'api', apiKey: 'synthetic-coordinator-key' });
    const state = window.__barkdown.state, chat = state.chats[state.current]; chat.provider = 'api'; chat.draft = 'Preserve coordinator draft';
    await window.barkdown.state.save({ version: 1, profileId: state.profileId, generation: state.generation, chats: state.chats, order: state.order, current: state.current });
    return { profileId: state.profileId, generation: state.generation, chatId: chat.id };
  });
  const store = path.join(userData, 'profile-data/profiles', owner.profileId);
  const readGoal = () => { try { return JSON.parse(fs.readFileSync(path.join(store, 'goals.json'))).goals[0]; } catch { return null; } };
  await openGoals(); await page.locator('[name="objective"]').fill('Read three fixture inputs and verify the exact responses.');
  assert.equal(await page.locator('[name="planning"]').inputValue(), 'coordinated');
  await capture('new-goal'); await page.getByRole('button', { name: 'Plan and start', exact: true }).click();
  await waitFor(() => transport.gates.has('plan'), Boolean, 'plan stream');
  await page.getByText('Preparing the plan', { exact: true }).waitFor(); await capture('planning');
  let interruptedAttempt = null;
  if (crashRecovery) {
    interruptedAttempt = readGoal().tasks[0].attempts[0].id;
    const mainPid = await app.evaluate(() => process.pid);
    assert.equal(JSON.parse(fs.readFileSync(path.join(store, 'goals.lease'))).pid, mainPid);
    const exited = new Promise(resolve => app.process().once('exit', resolve));
    process.kill(mainPid, 'SIGKILL'); await exited; app = null;
    await launch(); owner.generation = await page.evaluate(() => window.__barkdown.state.generation);
    await openGoals();
    assert.equal(readGoal().status, 'paused'); assert.equal(readGoal().tasks[0].status, 'interrupted');
    assert.equal(transport.requests.length, 1); assert.equal(await page.locator('[data-command="start"]').isDisabled(), true);
    assert.equal(await page.locator('[data-review]').count(), 0); await capture('interrupted-planning');
    await page.locator('[data-command="reconcileTermination"]').click();
    await page.locator('[data-review="plan"]').waitFor({ state: 'attached' }); await capture('verified-shutdown');
    await page.locator('[data-task="plan"] .bw-goal-review > summary').click();
    await page.locator('[data-review="plan"] [name="note"]').fill('Inspected partial planning JSON. No worker assignments or tools were launched; owned job shutdown verified.');
    await page.locator('[data-review="plan"] [name="evidence"]').fill('Persisted coordinator partial response\nNative job absence verified for retained attempt');
    assert.equal(await page.locator('[data-review="plan"] [value="accept"]').count(), 0);
    await page.locator('[data-review="plan"] [value="retry"]').click();
    await page.locator('[data-task="plan"] [data-state="pending"]').waitFor(); await capture('reviewed-plan-retry');
    assert.equal(transport.requests.length, 1); await page.locator('[data-command="start"]').click();
    await waitFor(() => transport.requests.length, count => count === 2, 'explicit fresh plan attempt');
  }
  transport.gates.get('plan').release();
  await waitFor(() => [1, 2, 3].every(n => transport.gates.has(`worker-${n}`)), Boolean, 'three owned workers');
  const running = await waitFor(readGoal, goal => goal?.tasks.filter(task => task.role === 'worker' && task.status === 'running').length === 3, 'three running journal attempts');
  await page.locator('.bw-goals [data-state="running"]').nth(2).waitFor(); await capture('three-workers');
  const first = running.tasks.find(task => task.id === 'task-1'); await page.locator(`[data-chat="${first.chatId}"]`).click();
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('Worker 1 started.')); await capture('full-worker-chat');
  const second = await page.evaluate(async () => window.barkdown.profiles.create('Other profile'));
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, second.id);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, second.id);
  await page.evaluate(async () => { const ws = await window.barkdown.state.load(); ws.chats.other = { id: 'other', title: 'Other draft', draft: 'Keep profile B', messages: [], tabs: [] }; ws.order = ['other']; ws.current = 'other'; await window.barkdown.state.save(ws); });
  for (let n = 1; n <= 3; n++) transport.gates.get(`worker-${n}`).release();
  const complete = await waitFor(readGoal, goal => goal?.status === 'completed', 'background coordinator reviews and summary');
  assert.equal(transport.requests.length, expectedTurns); assert.equal(complete.review.actor, 'coordinator');
  const b = await page.evaluate(async () => window.barkdown.state.load()); assert.equal(b.chats.other.draft, 'Keep profile B'); assert.equal(Object.values(b.chats).filter(chat => chat.goalId).length, 0);
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, owner.profileId);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, owner.profileId);
  await page.evaluate(id => window.__barkdown.switchChat(id), owner.chatId);
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('All three fixture inputs'));
  await page.locator('#bw-transcript').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await capture('coordinator-summary');
  const saved = await page.evaluate(async () => window.barkdown.state.load());
  assert.equal(saved.chats[owner.chatId].draft, 'Preserve coordinator draft');
  assert.equal(saved.chats[owner.chatId].messages.length, crashRecovery ? 12 : 10);
  if (crashRecovery) {
    const plan = complete.tasks.find(task => task.role === 'plan'); assert.equal(plan.attempts.length, 2); assert.equal(plan.attempts[0].id, interruptedAttempt); assert.ok(plan.attempts[0].stoppedAt);
    assert.match(saved.ownership.attempts[interruptedAttempt].coordinatorResponse, /^\{"summary":/);
  }
  assert.ok(Object.values(saved.ownership.attempts).every(attempt => attempt.driverFinished));
  for (const task of complete.tasks.filter(task => task.role === 'worker')) {
    assert.equal(saved.chats[task.chatId].parent, owner.chatId); assert.match(saved.chats[task.chatId].messages.at(-1).text, /finished: observed/);
  }
  await openGoals(); await capture('completed'); await page.setViewportSize({ width: 390, height: 800 }); await capture('completed-narrow');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const receipts = fs.readdirSync(path.join(store, 'goal-processes')).filter(file => file.endsWith('.receipt.json')).map(file => JSON.parse(fs.readFileSync(path.join(store, 'goal-processes', file))));
  assert.equal(receipts.length, expectedTurns); assert.equal(receipts.filter(receipt => receipt.phase === 'stopped' && receipt.activeProcesses === 0).length, 8);
  await app.close(); app = null; await launch();
  const after = await page.evaluate(async () => window.barkdown.state.load()); assert.equal(after.chats[owner.chatId].draft, 'Preserve coordinator draft'); assert.equal(readGoal().status, 'completed'); assert.equal(transport.requests.length, expectedTurns);
  assert.deepEqual(errors, []);
  const git = args => execFileSync('git', args, { cwd: appDir, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sourceCommit: git(['rev-parse', 'HEAD']), sourceDirty: Boolean(git(['status', '--porcelain'])), capturedAt: new Date().toISOString(), userData, savedSyntheticCredential: true, environmentApiKey: false, transport: 'local deterministic Anthropic HTTP through default owned Windows jobs', turns: expectedTurns, stoppedReceipts: 8, interruptedPlanningReconciled: crashRecovery, shots, checks: ['objective-only creation', 'three concurrent saved worker chats', 'readable coordinator plan/reviews/summary', 'profile switch retains owner and drafts', 'eight stopped process receipts', 'restart without replay'] }, null, 2));
  console.log(JSON.stringify({ passed: crashRecovery ? 'actual Electron coordinator abrupt death, shutdown reconciliation and fresh plan retry' : 'actual Electron natural-language coordinator with eight owned SDK turns', userData, shots }));
} finally { if (app) await app.close(); await transport.close(); }
