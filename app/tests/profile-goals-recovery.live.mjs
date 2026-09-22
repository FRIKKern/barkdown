import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createAnthropicFixture } from './fixtures/anthropic-http.mjs';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-goal-ui-recovery-'));
const shots = path.resolve('test-results/profile-goals-recovery');
fs.mkdirSync(shots, { recursive: true });
const transport = await createAnthropicFixture();
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: 'fixture-unused', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
let app, page;
const errors = [];
async function boot() {
  app = await launch(); page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
}
async function openGoals() {
  await page.keyboard.press('Control+k');
  await page.locator('#bw-palette-input').fill('Conversation goals');
  await page.keyboard.press('Enter');
  await page.locator('.bw-goals').waitFor();
}
async function capture(name) {
  await page.locator('.bw-goals').evaluate(node => Promise.all(node.getAnimations().map(a => a.finished.catch(() => {}))));
  await page.screenshot({ path: path.join(shots, name + '.png') });
}
async function waitGoal(owner, predicate) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const goal = await page.evaluate(async owner => (await window.barkdown.goals.list(owner))[0], owner);
    if (goal && predicate(goal)) return goal;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Goal did not reach expected durable state');
}
try {
  await boot();
  const owner = await page.evaluate(async () => {
    await window.barkdown.settings.set({ provider: 'api', apiKey: 'fixture-unused' });
    const s = window.__barkdown.state, chat = s.chats[s.current];
    chat.provider = 'api'; chat.draft = 'Human coordinator draft before abrupt exit';
    await window.barkdown.state.save({ version: 1, profileId: s.profileId, generation: s.generation, chats: s.chats, order: s.order, current: s.current });
    return { profileId: s.profileId, generation: s.generation, chatId: chat.id };
  });
  await openGoals();
  await page.locator('[name="objective"]').fill('Recover interrupted workers without replay');
  for (let n = 1; n <= 3; n++) await page.locator(`[name="worker${n}"]`).fill(`Return fixture result ${n}`);
  await page.locator('[data-create] button').click();
  await page.locator('[data-command="start"]').click();
  await waitGoal(owner, goal => goal.tasks.length === 3 && goal.tasks.every(t => t.attempts.at(-1)?.progress?.text?.includes('started.')));
  assert.equal(transport.requests.length, 3);
  const before = await page.evaluate(async owner => (await window.barkdown.goals.list(owner))[0], owner);
  const native = app.process();
  const mainPid = await app.evaluate(() => process.pid);
  const lease = JSON.parse(fs.readFileSync(path.join(userData, 'profile-data', 'profiles', owner.profileId, 'goals.lease')));
  assert.equal(mainPid, lease.pid, 'Kill target must own this disposable journal');
  const exited = new Promise(resolve => native.once('exit', resolve));
  process.kill(mainPid, 'SIGKILL'); await exited; app = null;
  // Reopening must recover the journal without a single new SDK request.
  await boot();
  owner.generation = await page.evaluate(() => window.__barkdown.state.generation);
  await openGoals();
  const recovered = await page.evaluate(async owner => (await window.barkdown.goals.list(owner))[0], owner);
  assert.equal(recovered.status, 'paused');
  assert.ok(recovered.tasks.every(t => t.status === 'interrupted' && !t.attempts.at(-1).stoppedAt));
  assert.equal(transport.requests.length, 3);
  assert.equal(await page.locator('[data-command="start"]').isDisabled(), true);
  assert.equal(await page.locator('[data-review]').count(), 0);
  await capture('interrupted-before-shutdown-check');
  for (const task of recovered.tasks) {
    const article = page.locator(`[data-task="${task.id}"]`);
    await article.locator('[data-command="reconcileTermination"]').click();
    await article.locator('[data-review]').waitFor({ state: 'attached' });
  }
  await capture('shutdown-verified-review-required');
  assert.equal(transport.requests.length, 3);
  for (const task of recovered.tasks) {
    const article = page.locator(`[data-task="${task.id}"]`);
    await article.locator('.bw-goal-review > summary').click();
    await article.locator('[name="note"]').fill('Read partial saved reply; no completed result. Owned job shutdown verified. Retry remaining assignment.');
    await article.locator('[name="evidence"]').fill('Persisted partial assistant reply\nNative stopped job receipt');
    await article.locator('[value="retry"]').click();
    await article.locator('[data-state="pending"]').waitFor();
  }
  assert.equal(await page.locator('[data-command="start"]').isEnabled(), true);
  assert.equal(transport.requests.length, 3);
  await capture('reviewed-retry-ready');
  await page.locator('[data-command="start"]').click();
  await waitGoal(owner, goal => goal.tasks.every(t => t.attempts.length === 2 && t.attempts.at(-1).progress?.text?.includes('started.')));
  assert.equal(transport.requests.length, 6);
  for (const gate of transport.gates.values()) gate.release();
  await waitGoal(owner, goal => goal.tasks.every(t => t.status === 'review'));
  const result = await page.evaluate(async owner => ({ goal: (await window.barkdown.goals.list(owner))[0], workspace: await window.barkdown.state.load() }), owner);
  for (const [i, task] of result.goal.tasks.entries()) {
    assert.equal(task.attempts[0].id, before.tasks[i].attempts[0].id);
    assert.ok(task.attempts[0].stoppedAt);
    assert.notEqual(task.attempts[0].id, task.attempts[1].id);
    const worker = result.workspace.chats[task.chatId];
    assert.equal(worker.parent, owner.chatId);
    assert.equal(worker.messages.length, 4);
    assert.match(worker.messages[1].text, /started/);
    assert.match(worker.messages[3].text, /Finished/);
    assert.equal(worker.runId, null);
  }
  assert.equal(result.workspace.chats[owner.chatId].draft, 'Human coordinator draft before abrupt exit');
  assert.deepEqual(errors, []);
  await capture('retry-results-preserved');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('retry-results-narrow');
  fs.writeFileSync(path.join(shots, 'manifest.json'), JSON.stringify({
    source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    transport: 'Local deterministic Anthropic HTTP; actual SDK and owned Windows workers',
    credentials: 'Synthetic environment key; encrypted-key restart is not covered',
    capturedAt: new Date().toISOString(),
    frames: ['interrupted-before-shutdown-check', 'shutdown-verified-review-required', 'reviewed-retry-ready', 'retry-results-preserved', 'retry-results-narrow'],
  }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: ['actual Electron abrupt exit', 'no replay on reopen', 'trusted visible shutdown reconciliation', 'explicit reviewed retry', 'partial replies and draft retained', 'three second attempts completed'], userData }));
} finally {
  if (app) await app.close();
  await transport.close();
}
