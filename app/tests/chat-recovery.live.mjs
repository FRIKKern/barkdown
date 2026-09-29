import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createAnthropicFixture } from './fixtures/anthropic-http.mjs';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chat-recovery-'));
const out = process.env.BARKDOWN_CHAT_RECOVERY_OUT || userData;
fs.mkdirSync(out, { recursive: true });
const transport = await createAnthropicFixture();
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
let app, page, passed = false;
async function boot() { app = await launch(); app.process().stderr?.on('data', chunk => { const text = String(chunk); if (/\[(recovery|owned)\]/.test(text)) process.stdout.write(text); }); page = await app.firstWindow(); await page.waitForFunction(() => window.__barkdown?.state.loaded); }
try {
  await boot();
  const chatId = await page.evaluate(async () => {
    await window.barkdown.settings.set({ provider: 'api', apiKey: 'fixture-unused' });
    const s = window.__barkdown.state, chat = s.chats[s.current]; chat.provider = 'api';
    await window.barkdown.state.save({ version: 1, profileId: s.profileId, generation: s.generation, chats: s.chats, order: s.order, current: s.current });
    return chat.id;
  });
  await page.locator('#bw-prompt').fill('Return fixture result 1'); await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.at(-1)?.text?.includes('started.'), chatId);
  await page.locator('#bw-prompt').fill('Draft after partial response');
  for (let i = 0; i < 100; i++) { if (await page.evaluate(async id => (await window.barkdown.state.load()).chats[id].draft === 'Draft after partial response', chatId)) break; await new Promise(r => setTimeout(r, 50)); }
  const before = await page.evaluate(() => window.barkdown.state.load());
  assert.equal(before.chats[chatId].draft, 'Draft after partial response', 'draft reached durable store before abrupt exit');
  const draftView = await page.evaluate(id => ({ memory: window.__barkdown.state.chats[id].draft, input: document.querySelector('#bw-prompt').value, current: window.__barkdown.state.current }), chatId);
  const mainPid = await app.evaluate(() => process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-owner.json'))).pid, mainPid);
  const exited = new Promise(resolve => app.process().once('exit', resolve)); process.kill(mainPid, 'SIGKILL'); await exited; app = null;
  await boot();
  const recovered = await page.evaluate(() => window.barkdown.state.load());
  const attempt = Object.values(recovered.ownership.attempts).find(a => a.chatId === chatId);
  fs.writeFileSync(path.join(userData, 'recovery-observed.json'), JSON.stringify({ before, draftView, recovered, requests: transport.requests.length }, null, 2));
  console.log('Retained ordinary recovery fixture: ' + userData);
  assert.equal(transport.requests.length, 1, 'restart cannot replay request');
  assert.equal(attempt.status, 'interrupted', 'restarted ordinary attempt must be truthful');
  assert.equal(recovered.chats[chatId].draft, 'Draft after partial response');
  assert.match(recovered.chats[chatId].messages.at(-1).text, /started/);
  assert.equal(recovered.chats[chatId].messages.at(-1).streaming, false);
  await page.locator('[data-recover="verify"]').waitFor();
  await page.locator('#bw-prompt').press('Enter');
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'Draft after partial response', 'blocked send preserves draft');
  await page.screenshot({ path: path.join(out, 'interrupted.png') });
  const said = []; page.on('console', m => { if (['error', 'warning'].includes(m.type())) said.push(m.text().slice(0, 300)); });
  await page.evaluate(() => { window.__toasts = []; new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) window.__toasts.push(n.textContent); }).observe(document.getElementById('bw-toasts'), { childList: true }); });
  await page.locator('[data-recover="verify"]').click();
  // A refused verification stays on screen; say what it said instead of timing out silently.
  await page.locator('[data-recover="review"]').waitFor().catch(async error => { throw new Error(`Review step never appeared. Recovery banner: ${await page.locator('[data-recovery]').textContent().catch(() => '(none)')}; toasts: ${JSON.stringify(await page.evaluate(() => window.__toasts).catch(() => null))}; console: ${said.join(' | ')}`, { cause: error }); });
  assert.equal(transport.requests.length, 1, 'checking shutdown cannot replay');
  await page.locator('[data-recovery-note]').fill('Reviewed partial response; this fixture changed no files.');
  await page.screenshot({ path: path.join(out, 'verified.png') });
  await page.locator('[data-recover="review"]').click();
  await page.locator('[data-recovery]').waitFor({ state: 'detached' });
  assert.equal(transport.requests.length, 1, 'review only releases a new turn');
  await page.locator('#bw-prompt').fill('Return fixture result 2'); await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.at(-1)?.text?.includes('Worker 2 started.'), chatId);
  transport.gates.get(2).release();
  await page.waitForFunction(id => !window.__barkdown.state.chats[id].messages.at(-1).streaming, chatId);
  await page.screenshot({ path: path.join(out, 'new-turn.png') });
  await page.locator('#bw-open-work').click(); await page.locator('[data-new="chat"]').click();
  const side = page.locator('.bw-side-chat'); await side.waitFor();
  const child = await page.evaluate(() => { const s = window.__barkdown.state, c = s.chats[s.current]; return c.tabs.find(t => t.id === c.active).sideChatId; });
  const folder = path.join(userData, 'owned-folder'); fs.mkdirSync(folder);
  await page.evaluate(({ child, folder }) => { const c = window.__barkdown.state.chats[child]; Object.assign(c, { folder, model: 'fixture-model', effort: 'low' }); window.__barkdown.render(); }, { child, folder });
  await side.locator('[data-composer="attach-input"]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII=', 'base64') });
  await side.locator('.bw-attachment').waitFor();
  await side.locator('textarea').fill('Return fixture result 3'); await side.locator('textarea').press('Enter');
  await page.waitForFunction(id => window.__barkdown.state.chats[id].messages.at(-1)?.text?.includes('Worker 3 started.'), child);
  await side.locator('textarea').fill('Side draft survives');
  for (let i = 0; i < 100; i++) { if (await page.evaluate(async id => (await window.barkdown.state.load()).chats[id].draft === 'Side draft survives', child)) break; await new Promise(r => setTimeout(r, 50)); }
  assert.equal((await page.evaluate(() => window.barkdown.state.load())).chats[child].draft, 'Side draft survives');
  const sidePid = await app.evaluate(() => process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-owner.json'))).pid, sidePid);
  const sideExit = new Promise(resolve => app.process().once('exit', resolve)); process.kill(sidePid, 'SIGKILL'); await sideExit; app = null;
  await boot();
  const sideSaved = (await page.evaluate(() => window.barkdown.state.load())).chats[child];
  assert.equal(sideSaved.parent, chatId); assert.equal(sideSaved.folder, folder); assert.equal(sideSaved.model, 'fixture-model');
  assert.equal(sideSaved.draft, 'Side draft survives'); assert.equal(sideSaved.messages[0].images.length, 1);
  assert.ok(fs.existsSync(sideSaved.messages[0].images[0].path)); assert.equal(sideSaved.messages.at(-1).streaming, false);
  await page.locator('.bw-side-chat [data-recover="verify"]').waitFor();
  await page.screenshot({ path: path.join(out, 'side-interrupted.png') });
  assert.equal(transport.requests.length, 3);
  await page.locator('.bw-side-chat [data-recover="verify"]').click();
  await page.locator('.bw-side-chat [data-recover="review"]').waitFor();
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.screenshot({ path: path.join(out, 'side-verified-narrow.png') });
  assert.equal(transport.requests.length, 3, 'side recovery cannot replay');
  passed = true;
  console.log('PASS actual abrupt ordinary chat exit preserves work and does not replay');
} finally {
  await app?.close(); await transport.close();
  const stopped = [];
  const profiles = path.join(userData, 'profile-data', 'profiles');
  if (fs.existsSync(profiles)) for (const profileId of fs.readdirSync(profiles)) {
    const storeDir = path.join(profiles, profileId), receipts = path.join(storeDir, 'goal-processes');
    if (!fs.existsSync(receipts)) continue;
    for (const file of fs.readdirSync(receipts).filter(f => f.endsWith('.receipt.json'))) {
      const attemptId = file.replace('.receipt.json', '');
      stopped.push({ profileId, attemptId, verified: await require('../main/goal-process').verifyOwnedWorker({ profileId, attemptId, storeDir }) });
    }
  }
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim());
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sourceCommit, sourceDirty, capturedAt: new Date().toISOString(), userData, passed, provider: 'Actual API SDK over local deterministic HTTP; no external model call', reducedMotion: false, viewport: '1424x835 then1000x800', capture: 'Playwright full-motion video; abrupt main exits may truncate terminal video frames', stopped }, null, 2));
  assert.ok(stopped.every(s => s.verified), 'all fixture-owned jobs verified stopped');
}
