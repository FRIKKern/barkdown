// Real Electron + SDK + controlled HTTP; no Barkpark runtime or model requests.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { createIsolationTransport } from './fixtures/profile-isolation-http.mjs';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-api-cancel-ui-'));
const transport = await createIsolationTransport();
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
const page = await app.firstWindow();
const scenario = process.env.BARKDOWN_CANCEL_SCENARIO || 'cancel';
let closed = false;
try {
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  const started = await page.evaluate(async () => {
    await window.barkdown.settings.set({ provider: 'api', apiKey: 'fixture-unused' });
    const s = window.__barkdown.state, chat = s.chats[s.current]; chat.provider = 'api';
    await window.barkdown.state.save({ version: 1, profileId: s.profileId, generation: s.generation, chats: s.chats, order: s.order, current: s.current });
    return window.barkdown.agent.start(chat.id, [{ role: 'user', content: 'Wait for cancellation' }], {}, 'api', null, 'Wait for cancellation', []);
  });
  for (let n = 0; n < 100 && !transport.held; n++) await new Promise(resolve => setTimeout(resolve, 50));
  assert(transport.held, 'actual SDK did not open controlled stream');
  const b = await page.evaluate(() => window.barkdown.profiles.create('Cancellation B'));
  await page.evaluate(async id => { await window.barkdown.profiles.select(id); location.reload(); }, b.id);
  await page.waitForFunction(id => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id, b.id);
  if (scenario === 'disconnect') transport.disconnect();
  if (scenario === 'quit') {
    const receipt = path.join(userData, 'driver-finished.json');
    await app.evaluate(({ app }, { id, receipt }) => {
      const r = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js');
      r('./agent').waitForRunFinish(id).then(result => r('node:fs').writeFileSync(receipt, JSON.stringify(result)));
    }, { id: started.runId, receipt });
    await Promise.race([app.close().then(() => { closed = true; }), new Promise((_, reject) => setTimeout(() => reject(new Error('App quit did not drain held API stream')), 5000))]);
    assert.equal(JSON.parse(fs.readFileSync(receipt)).cancelled, true);
    console.log('Actual Electron quit cancelled and drained background API stream before HTTP fixture release.');
  } else {
  const completion = await app.evaluate(async ({ app }, id) => {
    const agent = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js')('./agent');
    agent.cancel(id);
    return Promise.race([agent.waitForRunFinish(id), new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 3000))]);
  }, started.runId);
  assert.equal(completion.timeout, undefined, 'cancelled API stream must reach driver finalization without server release');
  assert.equal(completion.cancelled, true);
  assert.notEqual(completion.status, 'completed');
  console.log(`Actual Electron background API ${scenario} reached driver finish before HTTP fixture release.`);
  }
} finally {
  await transport.close();
  if (!closed) await app.close();
}
